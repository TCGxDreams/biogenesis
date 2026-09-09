// @ts-nocheck -- DOM event wiring moved verbatim from main.js in T4.2.
//                Typed once the controller layer is rewired (see T3.2 note).
// ============================================
// BioGenesis — Tool event bindings
// ============================================
//
// Listeners for the interactive tools. These need application state, so they
// are created through a factory that receives the controller's context rather
// than importing the store directly — that keeps the registry in tools.js free
// of controller wiring and makes these testable in isolation.

import { editedSequenceCopy } from './editorActions.js';
import { documentFromReport, writeTree } from './documentImport.js';
import { computeAndRenderAlignment } from '../components/SequenceAlignment.js';
import { computeAndRenderTree } from '../components/PhyloTree.js';
import { computeDotPlot } from '../components/DotPlot.js';
import { computeMotifSearch } from '../components/MotifFinder.js';
import { renderDigestResult } from '../components/RestrictionAnalysis.js';
import { renderPrimerResults } from '../components/PrimerDesign.js';
import { renderCodonAnalysis } from '../components/CodonOptimization.js';
import { runBlast } from '../components/BlastSearch.js';

/**
 * @typedef {Object} BindingContext
 * @property {Object} state The live application state, for reads.
 * @property {(seq: import('../core/types.js').Sequence) => void} [addEditedSequence]
 * @property {(seq: import('../core/types.js').Sequence, topology: 'linear'|'circular') => void} [setSequenceTopology]
 * @property {(doc: import('./documentImport.js').AnalysisDocument) => void} [saveAnalysisDocument]
 * @property {(message: string) => void} setStatus
 * @property {(seq: Object) => void} showAnnotationDialog Opens the annotation
 *   editor; owned by the controller because it drives the shared modal.
 */

/**
 * Build the per-tool event binders for a given controller context.
 *
 * @param {BindingContext} context
 * @returns {{[toolId: string]: (seq: Object|null) => void}} Binders keyed by
 *   tool id, ready to be merged into the tool registry.
 */
/** @type {Object} Live application state, assigned by createToolBindings(). */
let state;
let saveAnalysisDocument;
let editContext;

/** @type {(message: string) => void} */
let setStatus;

/** @type {(seq: Object) => void} */
let showAnnotationDialog;

/**
 * Build the per-tool event binders for a given controller context.
 *
 * @param {BindingContext} context
 * @returns {{[toolId: string]: (seq: Object|null) => void}} Binders keyed by
 *   tool id, ready to be merged into the tool registry.
 */
export function createToolBindings(context) {
    editContext = context;
    ({ state, setStatus, showAnnotationDialog, saveAnalysisDocument } = context);
    return {
        alignment: bindAlignmentEvents,
        dotplot: bindDotPlotEvents,
        phylo: bindPhyloEvents,
        motif: bindMotifEvents,
        restriction: bindRestrictionEvents,
        primer: bindPrimerEvents,
        codon: bindCodonEvents,
        blast: bindBlastEvents,
        editor: bindEditorEvents,
    };
}

function bindAlignmentEvents() {
    document.getElementById('run-alignment-btn')?.addEventListener('click', () => {
        const checks = document.querySelectorAll('.align-seq-check:checked');
        const selectedSeqs = Array.from(checks)
            .map(c => state.sequences[parseInt(c.value)])
            .filter(Boolean);

        const algo = document.getElementById('align-algo')?.value || 'msa';
        const resultDiv = document.getElementById('alignment-result');

        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Computing Alignment...</p>';
            setTimeout(() => {
                let report;
                resultDiv.innerHTML = computeAndRenderAlignment(selectedSeqs, algo, value => { report = value; });
                if (report) bindSaveReport(resultDiv, report, selectedSeqs);

                // Setup export button
                const exportBtn = document.getElementById('align-export-btn');
                if (exportBtn && resultDiv.querySelector('.alignment-container')) {
                    exportBtn.style.display = 'inline-block';
                    exportBtn.onclick = async () => {
                        const { alignmentToFasta } =
                            await import('../core/alignment-report.js');
                        const fas = alignmentToFasta(report);
                        const blob = new Blob([fas], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'alignment.fasta';
                        a.click();
                        URL.revokeObjectURL(url);
                    };
                } else if (exportBtn) {
                    exportBtn.style.display = 'none';
                }
            }, 50);
        }
    });

    // Track selection count
    document.querySelectorAll('.align-seq-check').forEach(chk => {
        chk.addEventListener('change', () => {
            const count = document.querySelectorAll('.align-seq-check:checked').length;
            const lbl = document.getElementById('align-sel-count');
            if (lbl) lbl.textContent = `${count} selected`;
        });
    });
}

function bindDotPlotEvents() {
    document.getElementById('run-dotplot-btn')?.addEventListener('click', () => {
        const s1 = document.getElementById('dotplot-seq1');
        const s2 = document.getElementById('dotplot-seq2');
        const win = document.getElementById('dotplot-window');
        const thr = document.getElementById('dotplot-threshold');
        if (!s1 || !s2) return;
        const seq1 = state.sequences[parseInt(s1.value)];
        const seq2 = state.sequences[parseInt(s2.value)];
        const resultDiv = document.getElementById('dotplot-result');
        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Computing dot plot...</p>';
            setTimeout(() => {
                resultDiv.innerHTML = computeDotPlot(
                    seq1,
                    seq2,
                    parseInt(win?.value || 10),
                    parseInt(thr?.value || 70)
                );
            }, 50);
        }
    });
}

function bindPhyloEvents() {
    document.getElementById('build-tree-btn')?.addEventListener('click', async () => {
        const checks = document.querySelectorAll('.phylo-seq-check:checked');
        const seqs = Array.from(checks).map(c => state.sequences[parseInt(c.value)]);
        const algo = document.getElementById('phylo-algo')?.value || 'nj';
        const resultDiv = document.getElementById('phylo-result');

        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Building tree...</p>';
            setTimeout(async () => {
                let report;
                resultDiv.innerHTML = computeAndRenderTree(seqs, algo, value => { report = value; });
                if (report) bindSaveReport(resultDiv, report, seqs);

                // Setup exporters
                const svgBtn = document.getElementById('phylo-export-svg-btn');
                const newickBtn = document.getElementById('phylo-export-newick-btn');
                const svgEl = resultDiv.querySelector('.phylo-svg');

                if (svgEl && svgBtn && newickBtn) {
                    svgBtn.style.display = 'inline-block';
                    newickBtn.style.display = 'inline-block';

                    const newickStr = writeTree(report.tree) + ';';

                    svgBtn.onclick = () => {
                        const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'phylo_tree.svg';
                        a.click();
                        URL.revokeObjectURL(url);
                    };

                    newickBtn.onclick = () => {
                        const blob = new Blob([newickStr], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'phylo_tree.nwk';
                        a.click();
                        URL.revokeObjectURL(url);
                    };
                } else {
                    if (svgBtn) svgBtn.style.display = 'none';
                    if (newickBtn) newickBtn.style.display = 'none';
                }
            }, 50);
        }
    });

    // Track selection count
    document.querySelectorAll('.phylo-seq-check').forEach(chk => {
        chk.addEventListener('change', () => {
            const count = document.querySelectorAll('.phylo-seq-check:checked').length;
            const lbl = document.getElementById('phylo-sel-count');
            if (lbl) lbl.textContent = `${count} selected`;
        });
    });
}

function bindMotifEvents(seq) {
    // Quick shortcuts
    document.querySelectorAll('.motif-shortcut').forEach(el => {
        el.addEventListener('click', () => {
            const input = document.getElementById('motif-pattern');
            if (input) input.value = el.dataset.motif;
        });
    });

    document.getElementById('run-motif-btn')?.addEventListener('click', () => {
        const pattern = document.getElementById('motif-pattern')?.value;
        const mode = document.getElementById('motif-mode')?.value || 'exact';
        const strand = document.getElementById('motif-strand')?.value || 'both';
        if (!pattern) return;
        const resultDiv = document.getElementById('motif-result');
        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Searching...</p>';
            setTimeout(() => {
                resultDiv.innerHTML = computeMotifSearch(seq, pattern, mode, strand);
            }, 50);
        }
    });
}

function bindRestrictionEvents(seq) {
    const selectedEnzymes = new Set();

    function getChecked() {
        return [...document.querySelectorAll('.enzyme-check:checked')].map(el => el.dataset.enzyme);
    }

    function updateGel() {
        const names = getChecked();
        selectedEnzymes.clear();
        names.forEach(n => selectedEnzymes.add(n));
        const gelDiv = document.getElementById('gel-result');
        if (gelDiv) {
            gelDiv.innerHTML = renderDigestResult(seq, [...selectedEnzymes]);
        }
    }

    function applyFilters() {
        const groupVal = document.getElementById('re-filter-group')?.value || 'all';
        const cutsVal = document.getElementById('re-filter-cuts')?.value || 'all';
        document.querySelectorAll('.enzyme-row').forEach(row => {
            const check = row.querySelector('.enzyme-check');
            if (!check) return;
            const enzyme = check.dataset.enzyme;
            // Group filter — we check via data attribute on row
            const rowGroup = row.dataset.group || 'common';
            const groupOk = groupVal === 'all' || rowGroup === groupVal;
            // Cuts filter
            const cutsText = row.querySelector('.cuts-badge')?.textContent || '0';
            const cuts = parseInt(cutsText) || 0;
            let cutsOk = true;
            if (cutsVal === '1') cutsOk = cuts === 1;
            else if (cutsVal === '2-3') cutsOk = cuts >= 2 && cuts <= 3;
            else if (cutsVal === 'many') cutsOk = cuts >= 4;
            row.style.display = groupOk && cutsOk ? '' : 'none';
        });
    }

    // Attach group/site to rows (needed for filter)
    document.querySelectorAll('.enzyme-row').forEach(row => {
        const name = row.dataset.enzyme;
        // We assign group from the enzyme data
        const { findRestrictionSites, RESTRICTION_ENZYMES_UNIQUE } =
            window.__restrictionUtils || {};
        const enzyme = (RESTRICTION_ENZYMES_UNIQUE || []).find(e => e.name === name);
        if (enzyme) row.dataset.group = enzyme.group || 'common';
    });

    // Enzyme checkbox toggle
    document.querySelectorAll('.enzyme-check').forEach(chk => {
        chk.addEventListener('change', updateGel);
    });

    // TR click → toggle checkbox
    document.querySelectorAll('.enzyme-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.type === 'checkbox') return; // let checkbox handle itself
            const chk = row.querySelector('.enzyme-check');
            if (chk) {
                chk.checked = !chk.checked;
                chk.dispatchEvent(new Event('change'));
            }
        });
    });

    // Filter dropdowns
    document.getElementById('re-filter-group')?.addEventListener('change', applyFilters);
    document.getElementById('re-filter-cuts')?.addEventListener('change', applyFilters);

    // Select unique button
    document.getElementById('re-select-unique')?.addEventListener('click', () => {
        document.querySelectorAll('.enzyme-row').forEach(row => {
            const chk = row.querySelector('.enzyme-check');
            if (!chk) return;
            const badge = row.querySelector('.cuts-unique');
            if (badge && row.style.display !== 'none') {
                chk.checked = true;
            } else chk.checked = false;
        });
        updateGel();
    });

    // Clear all
    document.getElementById('re-clear-all')?.addEventListener('click', () => {
        document.querySelectorAll('.enzyme-check').forEach(c => (c.checked = false));
        selectedEnzymes.clear();
        updateGel();
    });
}

function bindPrimerEvents(seq) {
    document.getElementById('run-primer-btn')?.addEventListener('click', () => {
        const minTm = parseFloat(document.getElementById('primer-tm-min')?.value) || 55;
        const maxTm = parseFloat(document.getElementById('primer-tm-max')?.value) || 65;
        const minLen = parseInt(document.getElementById('primer-len-min')?.value) || 18;
        const maxLen = parseInt(document.getElementById('primer-len-max')?.value) || 24;
        const tStart = document.getElementById('primer-target-start')?.value;
        const tEnd = document.getElementById('primer-target-end')?.value;

        // Convert to 0-indexed for logic, but UI is 1-indexed
        const targetStart = tStart ? parseInt(tStart) - 1 : null;
        const targetEnd = tEnd ? parseInt(tEnd) : null;

        const settings = { minTm, maxTm, minLen, maxLen, targetStart, targetEnd };
        const resultDiv = document.getElementById('primer-results-area');

        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Designing primers (Nearest-Neighbor Thermodynamics)...</p>';
            setTimeout(() => {
                resultDiv.innerHTML = renderPrimerResults(seq.sequence, settings);

                // Setup export button
                const exportBtn = document.getElementById('primer-export-btn');
                if (exportBtn && resultDiv.querySelector('.primer-stat')) {
                    exportBtn.style.display = 'inline-block';
                    exportBtn.onclick = async () => {
                        const { designPrimerPairs } = await import('../components/PrimerDesign.js');
                        const pairs = designPrimerPairs(seq.sequence, settings);
                        let csv = 'Name,Sequence,Length,Tm,GC%,Start,End,Hairpin\n';
                        pairs.forEach((p, i) => {
                            csv += `Fwd_${i + 1},${p.fwd.sequence},${p.fwd.sequence.length},${p.fwd.tm.toFixed(1)},${p.fwd.gc.toFixed(1)},${p.fwd.start + 1},${p.fwd.end},${p.fwd.hairpin}\n`;
                            csv += `Rev_${i + 1},${p.rev.sequence},${p.rev.sequence.length},${p.rev.tm.toFixed(1)},${p.rev.gc.toFixed(1)},${p.rev.start + 1},${p.rev.end},${p.rev.hairpin}\n`;
                        });
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${seq.name.replace(/\s+/g, '_')}_primers.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                    };
                } else if (exportBtn) {
                    exportBtn.style.display = 'none';
                }
            }, 100);
        }
    });
}

function bindCodonEvents(seq) {
    document.getElementById('run-codon-btn')?.addEventListener('click', () => {
        const org = document.getElementById('codon-organism')?.value || 'ecoli';
        const resultDiv = document.getElementById('codon-result');
        if (resultDiv) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Optimizing...</p>';
            setTimeout(() => {
                resultDiv.innerHTML = renderCodonAnalysis(seq.sequence, org);
            }, 50);
        }
    });
}

function bindBlastEvents() {
    document.getElementById('run-blast-btn')?.addEventListener('click', async () => {
        const query = document.getElementById('blast-query')?.value;
        const program = document.getElementById('blast-program')?.value || 'blastn';
        const db = document.getElementById('blast-db')?.value || 'nt';
        if (!query || query.trim().length < 10) {
            setStatus('Query too short (min 10 chars)');
            return;
        }
        const resultDiv = document.getElementById('blast-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
        <div style="text-align:center;padding:40px;">
          <div class="spinner"></div>
          <p id="blast-status-text" style="color:var(--text-secondary);margin-top:12px;font-weight:500;">Submitting BLAST query to NCBI...</p>
          <div style="width:100%;max-width:300px;height:4px;background:var(--bg-tertiary);border-radius:2px;margin:12px auto;overflow:hidden;">
            <div id="blast-progress-bar" style="width:5%;height:100%;background:var(--accent-blue);transition:width 0.3s ease;"></div>
          </div>
          <p style="color:var(--text-muted);font-size:11px;margin-top:4px;">This typically takes 30-90 seconds</p>
        </div>
      `;
            try {
                const html = await runBlast(query, program, db, (msg, progressPct) => {
                    const statusEl = document.getElementById('blast-status-text');
                    const barEl = document.getElementById('blast-progress-bar');
                    if (statusEl) statusEl.textContent = msg;
                    if (barEl)
                        barEl.style.width = Math.max(5, Math.min(100, progressPct * 100)) + '%';
                });
                resultDiv.innerHTML = html;
                setStatus('BLAST search complete');
            } catch (err) {
                resultDiv.innerHTML = `<div class="empty-state"><span class="empty-state-icon">❌</span><p class="empty-state-text" style="color:#ef4444;">Error: ${err.message}</p></div>`;
                setStatus('BLAST search failed');
            }
        }
    });
}

function bindEditorEvents(seq) {
    const input = document.getElementById('editor-sequence-text');
    const save = document.getElementById('editor-save-copy');
    const reset = document.getElementById('editor-reset');
    const feedback = document.getElementById('editor-feedback');
    const refresh = () => {
        const changed = input.value.replace(/\s/g,'').toUpperCase() !== seq.sequence.toUpperCase();
        save.disabled = !changed; reset.disabled = input.value !== seq.sequence;
    };
    input?.addEventListener('input', refresh);
    reset?.addEventListener('click', () => { input.value = seq.sequence; refresh(); feedback.textContent = ''; });
    save?.addEventListener('click', () => {
        try { editContext.addEditedSequence(editedSequenceCopy(seq,input.value)); }
        catch (error) { feedback.textContent = error.message; }
    });
    document.querySelectorAll('[data-editor-topology]').forEach(button => button.addEventListener('click', () => {
        editContext.setSequenceTopology(seq,button.dataset.editorTopology);
        document.querySelectorAll('[data-editor-topology]').forEach(item => { const active = item.dataset.editorTopology === seq.topology; item.classList.toggle('active',active); item.setAttribute('aria-pressed',String(active)); });
    }));
    document.getElementById('add-annotation-btn')?.addEventListener('click', () => {
        showAnnotationDialog(seq);
    });
}

function bindSaveReport(container, report, inputs) {
    const saved = documentFromReport(report, inputs);
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.dataset.vi = 'Lưu kết quả vào tài liệu';
    button.dataset.en = 'Save result to documents';
    button.textContent = button.dataset.vi;
    button.addEventListener('click', () => {
        saveAnalysisDocument?.(saved);
        button.disabled = true;
    });
    container.prepend(button);
}
