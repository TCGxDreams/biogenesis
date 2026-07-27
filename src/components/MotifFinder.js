// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Motif Finder Component
// ============================================

import { getNucleotideClass } from '../utils/bioUtils.js';
import { findMotifs } from '../core/motif.js';
import { BioError } from '../core/errors.js';

export function renderMotifFinder(seq) {
    return `
    <div class="panel active">
      <div class="panel-header">
        <h2>Motif Finder</h2>
        <p>Search for sequence motifs, patterns, or specific subsequences in ${escapeHtml(seq.name)}</p>
      </div>
      <div class="panel-controls" style="flex-direction:column;align-items:stretch;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="flex:1;min-width:200px;">
            <label class="form-label">Search Pattern</label>
            <input class="form-input" id="motif-pattern" type="text" placeholder="e.g., TATA, ATG, GAATTC, or regex: AT[CG]{2,3}T" />
          </div>
          <div class="form-group">
            <label class="form-label">Search Mode</label>
            <select class="form-select" id="motif-mode">
              <option value="exact">Exact match</option>
              <option value="regex">Regex</option>
              <option value="iupac">IUPAC ambiguity</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Strand</label>
            <select class="form-select" id="motif-strand">
              <option value="both">Both strands</option>
              <option value="forward">Forward only</option>
              <option value="reverse">Reverse only</option>
            </select>
          </div>
          <button class="btn btn-primary" id="run-motif-btn">Search</button>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
          Common motifs: 
          <span class="motif-shortcut" data-motif="TATAAA" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">TATA box</span>
          <span class="motif-shortcut" data-motif="GAATTC" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">EcoRI</span>
          <span class="motif-shortcut" data-motif="GGATCC" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">BamHI</span>
          <span class="motif-shortcut" data-motif="AAGCTT" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">HindIII</span>
          <span class="motif-shortcut" data-motif="ATG" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">Start codon</span>
          <span class="motif-shortcut" data-motif="T(AA|AG|GA)" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">Stop codons</span>
          <span class="motif-shortcut" data-motif="CCAAT" style="cursor:pointer;color:var(--accent-cyan);margin:0 4px;">CAAT box</span>
        </div>
      </div>
      <div class="panel-body" id="motif-result">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M20 21l-4.35-4.35"/><circle cx="10" cy="10" r="7"/><line x1="8" y1="10" x2="12" y2="10"/><line x1="10" y1="8" x2="10" y2="12"/></svg>
          <p class="empty-state-text" style="margin-top:12px;">Enter a search pattern to find motifs in the sequence</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the motif search result panel.
 *
 * All computation lives in `src/core/motif.js`; this function only turns the
 * returned object — or a thrown BioError — into markup.
 *
 * @param {{ sequence: string, type: string }} seq
 * @param {string} pattern
 * @param {'exact'|'regex'|'iupac'} [mode]
 * @param {'both'|'forward'|'reverse'} [strand]
 * @returns {string} HTML
 */
export function computeMotifSearch(seq, pattern, mode = 'exact', strand = 'both') {
    let result;
    try {
        result = findMotifs(seq.sequence, pattern, { mode, strand, type: seq.type });
    } catch (e) {
        if (e instanceof BioError) {
            return `<div class="empty-state"><p class="empty-state-text">${escapeHtml(e.message)}</p></div>`;
        }
        throw e;
    }

    const { matches, sequenceLength, forwardCount, reverseCount } = result;

    if (matches.length === 0) {
        return `<div class="empty-state"><p class="empty-state-text">No matches found for "${escapeHtml(pattern)}"</p></div>`;
    }

    // Stats
    let html = `
    <div class="stats-grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-title">Total Matches</div><div class="stat-value">${matches.length}</div></div>
      <div class="stat-card"><div class="stat-title">Forward (+)</div><div class="stat-value">${forwardCount}</div></div>
      <div class="stat-card"><div class="stat-title">Reverse (-)</div><div class="stat-value">${reverseCount}</div></div>
      <div class="stat-card"><div class="stat-title">Pattern</div><div class="stat-value" style="font-size:14px;font-family:var(--font-mono);">${escapeHtml(pattern)}</div></div>
    </div>
  `;

    // Match map
    html += `
    <div style="margin-bottom:16px;">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Match Distribution</h3>
      <div style="position:relative;height:40px;background:var(--bg-tertiary);border-radius:var(--radius-md);padding:0;border:1px solid var(--border-muted);overflow:hidden;">
        <div style="position:absolute;top:18px;left:0;right:0;height:2px;background:var(--text-muted);opacity:0.3;"></div>
        ${matches.slice(0, 100).map(m => {
        const pct = (m.position / sequenceLength * 100).toFixed(2);
        const color = m.strand === '+' ? 'var(--accent-cyan)' : 'var(--accent-orange)';
        return `<div style="position:absolute;top:12px;left:${pct}%;width:2px;height:16px;background:${color};opacity:0.8;" title="${m.strand} strand, pos ${m.position + 1}"></div>`;
    }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:2px;">
        <span>1</span><span>${sequenceLength}</span>
      </div>
    </div>
  `;

    // Results list
    html += `
    <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Matches (${matches.length})</h3>
    <div style="overflow-x:auto;">
      <table class="blast-results-table">
        <thead><tr><th>#</th><th>Strand</th><th>Position</th><th>Match</th><th>Context (10bp flanking)</th></tr></thead>
        <tbody>
          ${matches.slice(0, 50).map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="color:${m.strand === '+' ? 'var(--accent-cyan)' : 'var(--accent-orange)'};font-weight:600;">${m.strand}</td>
              <td style="font-family:var(--font-mono);">${m.position + 1}..${m.position + m.length}</td>
              <td style="font-family:var(--font-mono);font-weight:600;">${colorCodeSeq(m.match)}</td>
              <td style="font-family:var(--font-mono);font-size:11px;">${renderContext(m)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${matches.length > 50 ? `<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Showing first 50 of ${matches.length} matches</p>` : ''}
  `;

    return html;
}

/** @param {import('../core/motif.js').MotifMatch} m */
function renderContext(m) {
    return `<span style="color:var(--text-muted);">${m.contextBefore}</span><span class="motif-match">${m.forwardSlice}</span><span style="color:var(--text-muted);">${m.contextAfter}</span>`;
}

function colorCodeSeq(seq) {
    return seq.split('').map(c => `<span class="${getNucleotideClass(c)}">${c}</span>`).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
