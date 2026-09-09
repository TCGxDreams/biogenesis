/** Split NEXUS commands outside quoted labels and nested comments.
 * @param {string} text @returns {string[]}
 */
function commands(text) {
    const result = [];
    let current = '', quote = false, comment = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (comment) { if (c === '[') comment++; if (c === ']') comment--; continue; }
        if (!quote && c === '[') { comment++; current += ' '; continue; }
        if (c === "'") {
            if (quote && text[i + 1] === "'") { current += "''"; i++; continue; }
            quote = !quote;
        }
        if (!quote && c === ';') { result.push(current.trim()); current = ''; }
        else current += c;
    }
    if (quote || comment || current.trim()) throw new Error('Unclosed NEXUS command, label or comment.');
    return result;
}

/** Supported subset: labelled, non-interleaved molecular matrices and trees without TRANSLATE.
 * Unknown blocks are refused rather than silently omitted.
 * @param {string} text
 * @returns {{alignments:import('../core/types.js').Sequence[][], trees:Array<{name:string,newick:string}>}}
 */
export function readNexus(text) {
    if (!/^\s*#NEXUS\b/i.test(text)) throw new Error('NEXUS header required.');
    const result = {alignments:/** @type {import('../core/types.js').Sequence[][]} */([]), trees:/** @type {Array<{name:string,newick:string}>} */([])};
    let block = '', nchar = 0, ntax = 0, globalNtax = 0;
    let datatype = '', gap = '-', missing = '?';
    let matrices = 0;
    /** @type {string[]} */
    let taxlabels = [];
    for (const command of commands(text.replace(/^\s*#NEXUS\b/i,''))) {
        const begin = command.match(/^begin\s+(\w+)$/i);
        if (begin) {
            if (block) throw new Error('Nested NEXUS blocks are not supported.');
            block = begin[1].toLowerCase();
            if (!['taxa','characters','data','trees'].includes(block)) throw new Error(`NEXUS block ${block} is not supported; export FASTA or Newick.`);
            nchar = 0; ntax = globalNtax; datatype = ''; gap = '-'; missing = '?'; matrices = 0;
            continue;
        }
        if (/^end(?:block)?$/i.test(command)) { block = ''; continue; }
        if (/^dimensions\s/i.test(command) && ['taxa','characters','data'].includes(block)) {
            nchar = Number(command.match(/\bnchar\s*=\s*(\d+)/i)?.[1] || 0);
            ntax = Number(command.match(/\bntax\s*=\s*(\d+)/i)?.[1] || ntax);
            if (block === 'taxa') globalNtax = ntax;
            continue;
        }
        if (block === 'taxa' && /^taxlabels\s/i.test(command)) {
            const labels = command.replace(/^taxlabels\s*/i,'').match(/'(?:[^']|'')*'|[^\s']+/g) || [];
            taxlabels = labels.map(label => label.startsWith("'") ? label.slice(1,-1).replace(/''/g,"'") : label.replace(/_/g,' '));
            if ((ntax && taxlabels.length !== ntax) || new Set(taxlabels).size !== taxlabels.length) throw new Error('NEXUS TAXLABELS do not match NTAX.');
            continue;
        }
        if (['characters','data'].includes(block) && /^format\s/i.test(command)) {
            if (/\b(interleave|transpose|matchchar|equate|symbols|tokens|nolabels)\b/i.test(command)) throw new Error('This NEXUS matrix format is not supported; export aligned FASTA.');
            datatype = command.match(/datatype\s*=\s*(\w+)/i)?.[1].toLowerCase() || '';
            if (!['dna','rna','protein'].includes(datatype)) throw new Error('Only DNA, RNA and protein NEXUS matrices are supported.');
            gap = command.match(/\bgap\s*=\s*(\S)/i)?.[1] || '-';
            missing = command.match(/\bmissing\s*=\s*(\S)/i)?.[1] || '?';
            if (gap !== '-' || missing !== '?') throw new Error('Use NEXUS gap=- and missing=? or export aligned FASTA.');
            continue;
        }
        if (['characters','data'].includes(block) && /^matrix\s/i.test(command)) {
            if (++matrices > 1 || !datatype || !nchar) throw new Error('NEXUS matrix needs FORMAT and NCHAR.');
            const rows = command.replace(/^matrix\s*/i,'').split(/\r?\n/).filter(line => line.trim()).map(line => {
                const match = line.trim().match(/^(?:'((?:[^']|'')+)'|(\S+))\s+([A-Za-z*?\-\s]+)$/);
                if (!match) throw new Error('Use a non-interleaved NEXUS matrix with one labelled row per line.');
                const name = match[1] ? match[1].replace(/''/g,"'") : match[2].replace(/_/g,' ');
                const sequence = match[3].replace(/\s/g,'').toUpperCase();
                const alphabet = datatype === 'protein' ? /^[A-Z*?-]+$/ : datatype === 'rna' ? /^[ACGURYSWKMBDHVN?-]+$/ : /^[ACGTRYSWKMBDHVN?-]+$/;
                if (sequence.length !== nchar || !alphabet.test(sequence)) throw new Error('NEXUS row length or alphabet does not match FORMAT/DIMENSIONS.');
                return {name, sequence, type:/** @type {import('../core/types.js').SequenceType} */(datatype), description:'Imported NEXUS alignment'};
            });
            if ((ntax && rows.length !== ntax) || new Set(rows.map(r => r.name)).size !== rows.length) throw new Error('NEXUS taxon count or row labels are inconsistent.');
            if (taxlabels.length && rows.some(r => !taxlabels.includes(r.name))) throw new Error('NEXUS matrix names do not match TAXLABELS.');
            result.alignments.push(rows);
            continue;
        }
        if (block === 'trees') {
            const tree = command.match(/^(?:u?tree)\s+(?:\*\s*)?('(?:[^']|'')*'|[^=\s]+)\s*=\s*([\s\S]+)$/i);
            if (tree) {
                result.trees.push({name:tree[1].replace(/^'|'$/g,'').replace(/''/g,"'"), newick:tree[2] + ';'});
                continue;
            }
        }
        throw new Error('Unsupported NEXUS command (including TRANSLATE). Export aligned FASTA or Newick with full taxon names.');
    }
    if (block) throw new Error('NEXUS block is not closed.');
    if (!result.alignments.length && !result.trees.length) throw new Error('No supported NEXUS documents found.');
    return result;
}
