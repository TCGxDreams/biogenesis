// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Toolbar and tool navigation
// ============================================
//
// The top toolbar, the sidebar tool list, and the file import/export actions.

import {
    parseFasta,
    parseGenBank,
    detectSequenceType,
    toFasta,
    downloadFile,
    reverseComplement,
    fetchUniProtId,
} from '../utils/bioUtils.js';
import { autoAnnotate } from '../utils/autoAnnotate.js';

/**
 * The application context, assigned by createToolbar(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the toolbar and navigation bindings.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createToolbar(context) {
    app = context;
    return {
        bindToolNav,
        bindToolbar,
        switchTool,
        handleReverseComplement,
        handleFileImport,
        handleExport,
    };
}

function bindToolNav() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            app.setState({ activeTool: btn.dataset.tool });
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            app.renderToolPanel();
        });
    });
}

function bindToolbar() {
    document
        .getElementById('btn-import')
        ?.addEventListener('click', () => document.getElementById('file-input')?.click());
    document.getElementById('btn-export')?.addEventListener('click', handleExport);
    document.getElementById('btn-new-seq')?.addEventListener('click', app.showNewSequenceDialog);
    document.getElementById('btn-align')?.addEventListener('click', () => switchTool('alignment'));
    document.getElementById('btn-blast')?.addEventListener('click', () => switchTool('blast'));
    document.getElementById('btn-rc')?.addEventListener('click', handleReverseComplement);
    document
        .getElementById('btn-translate')
        ?.addEventListener('click', () => switchTool('translation'));
    document.getElementById('file-input')?.addEventListener('change', handleFileImport);

    // Debounced search for performance with many sequences
    let searchTimer = null;
    document.getElementById('global-search')?.addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const q = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.file-item');
            items.forEach(item => {
                const name = item.querySelector('.file-name')?.textContent.toLowerCase() || '';
                item.style.display = name.includes(q) ? '' : 'none';
            });
        }, 150); // 150ms debounce
    });
}

function switchTool(toolName) {
    app.setState({ activeTool: toolName });
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === toolName);
    });
    app.renderToolPanel();
}

function handleReverseComplement() {
    if (app.state.activeSequenceIdx < 0) return;
    const seq = app.state.sequences[app.state.activeSequenceIdx];
    if (seq.type === 'protein') {
        app.setStatus('Cannot reverse complement a protein sequence');
        return;
    }
    const rc = reverseComplement(seq.sequence);
    const newSeq = {
        name: seq.name + '_RC',
        sequence: rc,
        type: seq.type,
        annotations: [],
        description: `Reverse complement of ${seq.name}`,
    };
    app.setState({ sequences: [...app.state.sequences, newSeq] });
    app.renderFileTree();
    app.openSequence(app.state.sequences.length - 1);
    app.setStatus(`Created reverse complement: ${newSeq.name}`);
}

function handleFileImport(e) {
    const files = e.target.files;
    if (!files.length) return;
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = evt => {
            const text = evt.target.result;
            let parsed = [];
            if (file.name.match(/\.(gb|gbk|genbank)$/i)) {
                const gbSeq = parseGenBank(text);
                if (gbSeq) parsed = [gbSeq];
            } else if (file.name.match(/\.(fasta|fa|fna|faa|seq)$/i)) {
                parsed = parseFasta(text);
            } else {
                const clean = text.replace(/\s/g, '');
                parsed = [
                    {
                        name: file.name,
                        sequence: clean,
                        type: detectSequenceType(clean),
                        annotations: [],
                        description: '',
                    },
                ];
            }
            if (parsed.length) {
                parsed.forEach(seq => {
                    autoAnnotate(seq);

                    if (seq.type === 'protein') {
                        const uniprotRegex =
                            /([A-NR-Z][0-9][A-Z0-9]{3}[0-9]|[O,P,Q][0-9][A-Z0-9]{3}[0-9])/i;
                        const upMatch =
                            seq.name.match(uniprotRegex) ||
                            (seq.description && seq.description.match(uniprotRegex));

                        if (upMatch) {
                            seq.uniprotId = upMatch[1];
                        } else {
                            // Try resolving accession (e.g. if name is NP_000537)
                            fetchUniProtId(seq.name).then(resolved => {
                                if (resolved) {
                                    seq.uniprotId = resolved;
                                    if (app.state.sequences[app.state.activeSequenceIdx] === seq)
                                        app.renderToolPanel();
                                }
                            });
                        }
                    }
                });

                app.setState({ sequences: [...app.state.sequences, ...parsed] });
                app.renderFileTree();
                app.openSequence(app.state.sequences.length - parsed.length);
                app.setStatus(`Imported ${parsed.length} sequence(s) from ${file.name}`);
            }
        };
        reader.readAsText(file);
    }
    e.target.value = '';
}

function handleExport() {
    if (app.state.activeSequenceIdx < 0) {
        app.setStatus('No sequence selected');
        return;
    }
    const seq = app.state.sequences[app.state.activeSequenceIdx];
    const fasta = toFasta(seq.name, seq.sequence);
    downloadFile(fasta, `${seq.name}.fasta`);
    app.setStatus(`Exported ${seq.name}.fasta`);
}
