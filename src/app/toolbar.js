// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Toolbar and tool navigation
// ============================================
//
// The top toolbar, the sidebar tool list, and the file import/export actions.

import {
    toFasta,
    downloadFile,
    reverseComplement,
    fetchUniProtId,
} from '../utils/bioUtils.js';
import { initResponsiveLayout, openResponsiveSidebar } from './responsive.js';
import { initSidebar, showSidebarTab } from './sidebar.js';
import { exportAnalysisDocument, importDocuments } from './documentImport.js';
import { TOOLS, toolUnavailableReason } from './tools.js';
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
            switchTool(btn.dataset.tool);
        });
    });
}

function bindToolbar() {
    initSidebar();
    initResponsiveLayout();
    document.getElementById('workspace-home-btn')?.addEventListener('click', () => {
        app.setState({ activeSequenceIdx: -1, activeTabId: null, activeAnalysisId: null });
        app.updateFileTreeActive(-1);
        app.renderTabs();
        app.renderWelcomeScreen();
        showSidebarTab('documents');
    });
    document
        .getElementById('btn-import')
        ?.addEventListener('click', () => {
            app.showModal(`<h2 data-vi="Nhập dữ liệu" data-en="Import data">Nhập dữ liệu</h2><p data-vi="Chọn cách sử dụng dữ liệu FASTA. Cây Newick được nhận theo định dạng tệp." data-en="Choose how to use FASTA data. Newick trees are detected by file format.">Chọn cách sử dụng dữ liệu FASTA. Cây Newick được nhận theo định dạng tệp.</p><label for="import-kind" data-vi="Loại dữ liệu FASTA" data-en="FASTA document type">Loại dữ liệu FASTA</label><select class="form-select" id="import-kind"><option value="auto" data-vi="Tự nhận alignment khi có gap" data-en="Detect alignment when gaps are present">Tự nhận alignment khi có gap</option><option value="sequences" data-vi="Các trình tự riêng" data-en="Separate sequences">Các trình tự riêng</option><option value="alignment" data-vi="Alignment (kể cả không có gap)" data-en="Alignment (including gapless)">Alignment (kể cả không có gap)</option></select><label for="import-molecule" data-vi="Loại phân tử (alignment FASTA)" data-en="Molecule type (FASTA alignment)">Loại phân tử (alignment FASTA)</label><select class="form-select" id="import-molecule"><option value="auto" data-vi="Tự nhận (có thể cần chỉnh với protein ngắn)" data-en="Detect (short proteins may need an override)">Tự nhận (có thể cần chỉnh với protein ngắn)</option><option value="dna">DNA</option><option value="rna">RNA</option><option value="protein">Protein</option></select><p>FASTA · GenBank · Newick (.tree / .nwk / .newick) · NEXUS (.nex)</p><button class="btn btn-secondary" id="cancel-import" data-vi="Hủy" data-en="Cancel">Hủy</button><button class="btn btn-primary" id="choose-import-file" data-vi="Chọn tệp" data-en="Choose files">Chọn tệp</button>`);
            document.getElementById('cancel-import').onclick = app.hideModal;
            document.getElementById('choose-import-file').onclick = () => {
                const input = document.getElementById('file-input');
                input.dataset.importMode = document.getElementById('import-kind').value;
                input.dataset.molecule = document.getElementById('import-molecule').value;
                app.hideModal();
                input.click();
            };
        });
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
            const input = document.getElementById('document-search');
            if (input) {
                input.value = e.target.value;
                input.dispatchEvent(new Event('input'));
                showSidebarTab('documents');
                openResponsiveSidebar();
            }
        }, 150); // 150ms debounce
    });
}

function switchTool(toolName) {
    const tool = TOOLS[toolName];
    if (!tool) { app.setStatus('Unknown tool'); return; }
    const reason = toolUnavailableReason(tool,app.state);
    if (reason) { app.setStatus(reason); return; }
    app.setState({ activeTool: toolName, activeAnalysisId: null });
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
    const mode = e.target.dataset.importMode || 'auto';
    const molecule = e.target.dataset.molecule || 'auto';
    for (const file of files) {
        if (file.size > 10_000_000) { app.setStatus(`Import failed (${file.name}): maximum 10 MB.`); continue; }
        const reader = new FileReader();
        reader.onload = evt => {
            const text = evt.target.result;
            let parsed;
            try {
                const imported = importDocuments(file.name, text, mode, molecule);
                if (imported.documents.length) {
                    app.setState({analysisDocuments:[...app.state.analysisDocuments, ...imported.documents]});
                    app.openAnalysisDocument(imported.documents[0].id);
                    app.setStatus(`Imported ${imported.documents.length} analysis document(s) from ${file.name}`);
                    return;
                }
                parsed = imported.sequences;
            } catch (error) {
                app.setStatus(`Import failed (${file.name}): ${error.message}`);
                return;
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
                const aligned = parsed.some(seq => /[-.]/.test(seq.sequence));
                app.setStatus(`Imported ${parsed.length} sequence(s) from ${file.name}${aligned ? ' — gaps preserved; imported as separate sequences, not an alignment document.' : ''}`);
            }
        };
        reader.onerror = () => app.setStatus(`Could not read ${file.name}`);
        reader.readAsText(file);
    }
    e.target.value = '';
}

function handleExport() {
    const doc = app.state.analysisDocuments.find(d => d.id === app.state.activeAnalysisId);
    if (doc) { const output = exportAnalysisDocument(doc); downloadFile(output.text, output.filename); return; }

    if (app.state.activeSequenceIdx < 0) {
        app.setStatus('No sequence selected');
        return;
    }
    const seq = app.state.sequences[app.state.activeSequenceIdx];
    const fasta = toFasta(seq.name, seq.sequence);
    downloadFile(fasta, `${seq.name}.fasta`);
    app.setStatus(`Exported ${seq.name}.fasta`);
}
