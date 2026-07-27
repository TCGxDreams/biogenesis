// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Phylogenetic Tree Component
// ============================================

import { renderTreeSVG } from '../utils/phylo.js';
import { buildTree } from '../core/phylo-report.js';
import { BioError } from '../core/errors.js';

export function renderPhyloTree(sequences) {
  const allSeqs = sequences;

  if (allSeqs.length < 3) {
    return `
        <div class="panel active">
          <div class="panel-header"><h2>Phylogenetic Tree</h2><p>Evolutionary relationships and distances</p></div>
          <div class="panel-body"><div class="empty-state"><span class="empty-state-icon">🌳</span><p class="empty-state-text">Please import at least 3 sequences to build a tree.</p></div></div>
        </div>`;
  }

  const checkboxes = allSeqs.map((s, i) => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-tertiary);border-radius:4px;border:1px solid var(--border-muted);cursor:pointer;">
      <input type="checkbox" class="phylo-seq-check form-checkbox" value="${i}" ${i < 5 ? 'checked' : ''}>
      <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">
         <span style="font-weight:600;color:var(--text-primary);">${escapeHtml(s.name)}</span>
         <span style="color:var(--text-muted);">(${s.sequence.length} ${s.type === 'protein' ? 'aa' : 'bp'})</span>
      </div>
    </label>
  `).join('');

  return `
    <div class="panel active">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>Phylogenetic Tree</h2>
          <p>Construct a Neighbor-Joining tree from selected sequences</p>
        </div>
        <div style="display:flex;gap:8px;" id="phylo-export-group">
            <button class="btn btn-secondary" id="phylo-export-svg-btn" style="font-size:11px;padding:6px 14px;display:none;">↓ Export SVG</button>
            <button class="btn btn-secondary" id="phylo-export-newick-btn" style="font-size:11px;padding:6px 14px;display:none;">↓ Export Newick</button>
        </div>
      </div>
      
      <div class="panel-controls" style="display:flex;gap:20px;align-items:stretch;">
        
        <div style="flex:1;">
          <label class="form-label" style="display:flex;justify-content:space-between;">
            Select Sequences (min. 3)
            <span style="font-size:10px;color:var(--text-muted);font-weight:normal;" id="phylo-sel-count">Selected</span>
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:120px;overflow-y:auto;padding-right:5px;border:1px solid var(--border-muted);border-radius:var(--radius-md);padding:8px;background:var(--bg-elevated);">
            ${checkboxes}
          </div>
        </div>

        <div style="width:280px;display:flex;flex-direction:column;gap:12px;">
            <div class="form-group" style="margin:0;">
                <label class="form-label">Algorithm</label>
                <select class="form-select" id="phylo-algo">
                    <option value="nj" selected>Neighbor-Joining (NJ)</option>
                    <option value="upgma">UPGMA (Average Linkage)</option>
                </select>
            </div>
            <button class="btn btn-primary" id="build-tree-btn" style="margin-top:auto;width:100%;padding:8px;">▶ Build Tree</button>
        </div>
      </div>
      
      <div class="panel-body" id="phylo-result" style="padding-top:10px;">
        <div class="empty-state">
          <p class="empty-state-text">Select at least 3 sequences and click "Build Tree"</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the phylogenetic tree result. Tree inference lives in
 * `src/core/phylo-report.js`; this function only draws the report.
 *
 * @param {Array<{name: string, sequence: string}>} seqs
 * @param {'nj'|'upgma'} [algo]
 * @returns {string} HTML
 */
export function computeAndRenderTree(seqs, algo = 'nj') {
  try {
    const { tree, distanceMatrix: matrix, names } = buildTree(seqs, { algorithm: algo });

    const height = Math.max(400, seqs.length * 40);
    const svg = renderTreeSVG(tree, 800, height);

    // Distance matrix
    let matrixHtml = `
            <div style="background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-muted);padding:14px;margin-top:16px;">
            <h3 style="font-size:12px;font-weight:700;margin:0 0 12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Distance Matrix</h3>
            <div style="overflow-x:auto;">
            <table class="blast-results-table"><thead><tr><th style="background:transparent;border:none;"></th>`;
    for (const n of names) matrixHtml += `<th title="${escapeHtml(n)}">${escapeHtml(n.substring(0, 10))}</th>`;
    matrixHtml += '</tr></thead><tbody>';
    for (let i = 0; i < names.length; i++) {
      matrixHtml += `<tr><td style="font-weight:600;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(names[i])}">${escapeHtml(names[i])}</td>`;
      for (let j = 0; j < names.length; j++) {
        const val = matrix[i][j];
        const bg = i === j ? 'transparent' : `rgba(0,212,232,${Math.min(val * 1.5, 0.4)})`;
        matrixHtml += `<td style="background:${bg};font-family:var(--font-mono);font-size:11px;color:${i === j ? 'var(--text-muted)' : 'var(--text-primary)'}">${val.toFixed(3)}</td>`;
      }
      matrixHtml += '</tr>';
    }
    matrixHtml += '</tbody></table></div></div>';

    return `
      <div class="phylo-container" style="background:var(--bg-primary);border-radius:var(--radius-md);border:1px solid var(--border-muted);padding:20px;display:flex;justify-content:center;overflow-x:auto;">
         ${svg}
      </div>
      ${matrixHtml}
    `;
  } catch (e) {
    if (e instanceof BioError && e.code === 'TOO_FEW_SEQUENCES') {
      return `<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-orange);">${escapeHtml(e.message)}</p></div>`;
    }
    return `<div class="empty-state"><span class="empty-state-icon">❌</span><p class="empty-state-text" style="color:#ef4444;">Error building tree: ${e.message}</p></div>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
