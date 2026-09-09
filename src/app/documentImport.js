import { parseFasta } from '../utils/bioUtils.js';
import { readNexus } from './nexusImport.js';
import { parseSequenceImport } from './sequenceImport.js';

/** @typedef {import('../core/types.js').Sequence} Sequence */
/** @typedef {import('../core/types.js').TreeNode} TreeNode */
/**
 * @typedef {Object} AnalysisDocument
 * @property {string} id
 * @property {1} schemaVersion
 * @property {'alignment'|'tree'} kind
 * @property {string} name
 * @property {{filename:string, format:string, importedAt:string, originalText:string, importId?:string}} source
 * @property {Sequence[]} [rows] Aligned residues, never realigned during import.
 * @property {TreeNode} [tree]
 * @property {string} [newick]
 */

/** Strict Newick reader. Preserves source separately; comments are not interpreted.
 * @param {string} text
 * @returns {Array<{tree:TreeNode,newick:string}>}
 */
export function readTrees(text) {
    let i = 0;
    let nodes = 0;
    const fail = () => { throw new Error(`Invalid Newick near character ${i + 1}.`); };
    function skip() {
        while (i < text.length) {
            if (/\s/.test(text[i])) { i++; continue; }
            if (text[i] !== '[') break;
            let level = 1; i++;
            while (i < text.length && level) {
                if (text[i] === '[') level++;
                if (text[i] === ']') level--;
                i++;
            }
            if (level) fail();
        }
    }
    function label() {
        skip();
        let value = '';
        if (text[i] === "'") {
            i++;
            while (i < text.length) {
                if (text[i] === "'") {
                    i++;
                    if (text[i] !== "'") return value;
                }
                value += text[i++];
            }
            fail();
        }
        while (i < text.length && !/[\s()[\],:;']/.test(text[i])) value += text[i++];
        return value.replace(/_/g, ' ');
    }
    /** @param {number} depth @returns {TreeNode} */
    function node(depth) {
        if (depth > 200 || ++nodes > 10000) throw new Error('Tree exceeds 200 levels or 10,000 nodes.');
        skip();
        /** @type {TreeNode} */
        const value = { name: '' };
        if (text[i] === '(') {
            i++;
            value.children = [node(depth + 1)];
            skip();
            while (text[i] === ',') { i++; value.children.push(node(depth + 1)); skip(); }
            if (text[i++] !== ')') fail();
        }
        value.name = label();
        if (!value.children && !value.name) fail();
        skip();
        if (text[i] === ':') {
            i++; skip();
            const match = text.slice(i).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
            if (!match) fail();
            const number = match?.[0] || '';
            value.length = Number(number);
            if (!Number.isFinite(value.length)) fail();
            i += number.length;
        }
        skip();
        return value;
    }
    const result = [];
    while (i < text.length) {
        const start = i;
        skip();
        if (i === text.length) break;
        const tree = node(0);
        if (text[i++] !== ';') fail();
        result.push({tree, newick:text.slice(start, i).trim()});
    }
    if (!result.length) throw new Error('No trees found.');
    return result;
}

/** @param {Sequence[]} rows */
export function validateAlignment(rows) {
    if (rows.length < 2) throw new Error('An alignment needs at least two rows.');
    if (rows.some(r => r.sequence.length !== rows[0].sequence.length)) throw new Error('Alignment rows must have equal lengths, including gaps.');
    if (new Set(rows.map(r => r.type)).size !== 1) throw new Error('Alignment rows must have the same molecule type.');
    return rows;
}

/** @param {string} name @param {string} text @param {'sequences'|'alignment'|'auto'} [mode] @param {'auto'|'dna'|'rna'|'protein'} [molecule]
 * @returns {{sequences:Sequence[], documents:AnalysisDocument[]}}
 */
export function importDocuments(name, text, mode = 'auto', molecule = 'auto') {
    if (text.length > 10_000_000) throw new Error('File exceeds the 10 MB import limit.');
    const ext = name.split('.').at(-1)?.toLowerCase() || '';
    const source = { importId:crypto.randomUUID(), filename:name, format:ext, importedAt:new Date().toISOString(), originalText:text };
    /** @param {'alignment'|'tree'} kind @param {string} title @returns {AnalysisDocument} */
    const base = (kind, title) => ({id:crypto.randomUUID(), schemaVersion:1, kind, name:title, source});
    if (['nex','nxs','nexus'].includes(ext)) {
        const parsed = readNexus(text);
        return {sequences:[], documents:[
            ...parsed.alignments.map((rows, i) => ({...base('alignment', `${name} · alignment ${i + 1}`), rows:validateAlignment(rows)})),
            ...parsed.trees.map(entry => ({...base('tree', `${name} · ${entry.name}`), ...readTrees(entry.newick)[0]})),
        ]};
    }
    if (['tree','nwk','newick'].includes(ext)) {
        return {sequences:[], documents:readTrees(text).map((r, i) => ({...base('tree', `${name} · ${i + 1}`), ...r}))};
    }
    const isFasta = ['fasta','fa','fna','faa'].includes(ext);
    const candidateRows = isFasta ? parseFasta(text.replace(/^\uFEFF/,'')) : [];
    const aligned = isFasta && (mode === 'alignment' || (mode === 'auto' && candidateRows.length > 1 && candidateRows.some(r => /[-.]/.test(r.sequence))));
    if (aligned) {
        if (!text.trim().replace(/^\uFEFF/,'').startsWith('>')) throw new Error('FASTA header required.');
        const letters = candidateRows.map(r => r.sequence).join('').replace(/[-.?]/g,'').toUpperCase();
        const inferred = /^[ACGTRYSWKMBDHVN]+$/.test(letters) ? 'dna' : /^[ACGURYSWKMBDHVN]+$/.test(letters) ? 'rna' : 'protein';
        const type = molecule === 'auto' ? (ext === 'faa' ? 'protein' : inferred) : molecule;
        const alphabet = type === 'dna' ? /^[ACGTRYSWKMBDHVN?.-]+$/i : type === 'rna' ? /^[ACGURYSWKMBDHVN?.-]+$/i : /^[A-Z*?.-]+$/i;
        if (!letters || candidateRows.some(r => !alphabet.test(r.sequence))) throw new Error('Alignment contains empty rows or invalid residues for the selected molecule type.');
        const rows = candidateRows.map(r => ({...r, type, sequence:r.sequence.toUpperCase()}));
        return {sequences:[], documents:[{...base('alignment', name), rows:validateAlignment(rows)}]};
    }
    return {sequences:parseSequenceImport(name, text), documents:[]};
}

/** Original import can always be downloaded without dropping comments or precision.
 * @param {AnalysisDocument} doc
 */
export function exportAnalysisDocument(doc) {
    if (doc.kind === 'tree') return {filename:`${doc.name}.nwk`, text:doc.newick || ''};
    return {filename:`${doc.name}.fasta`, text:(doc.rows || []).map(r => `>${r.name}${r.description ? ` ${r.description}` : ''}\n${r.sequence}\n`).join('')};
}

/** @param {TreeNode} node @returns {string} */
export function writeTree(node) {
    const label = node.name ? `'${node.name.replace(/'/g,"''")}'` : '';
    return `${node.children?.length ? `(${node.children.map(writeTree).join(',')})` : ''}${label}${node.length === undefined ? '' : `:${node.length}`}`;
}

/** Save the exact report shown by a tool, together with its input snapshot.
 * @param {import('../core/types.js').AlignmentReport | import('../core/types.js').TreeReport} report
 * @param {Array<{name:string,sequence:string,type?:string}>} inputs
 * @returns {AnalysisDocument}
 */
export function documentFromReport(report, inputs) {
    const alignment = 'rows' in report;
    const name = `${alignment ? 'Alignment' : 'Tree'} · ${report.algorithm.toUpperCase()} · ${inputs[0]?.name || 'Analysis'}`;
    const saved = structuredClone({report, inputs, maxInputLength:alignment ? 3000 : 800});
    return {
        id:crypto.randomUUID(), schemaVersion:1, kind:alignment ? 'alignment' : 'tree', name,
        source:{filename:`${name}.json`, format:'biogenesis-report', importedAt:new Date().toISOString(), originalText:JSON.stringify(saved,null,2)},
        ...(alignment ? {rows:report.rows.map(r => ({name:r.name, sequence:r.aligned, type:/** @type {import('../core/types.js').SequenceType} */(report.isProtein ? 'protein' : inputs[0]?.type === 'rna' ? 'rna' : 'dna'), description:''}))} : {tree:structuredClone(report.tree), newick:writeTree(report.tree) + ';'}),
    };
}
