// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Dot Plot Analysis Component
// ============================================

import { computeDotMatrix } from '../core/dotplot.js';
import { BioError } from '../core/errors.js';

export function renderDotPlot(sequences, activeIdx) {
    const options = sequences.map((s, i) =>
        `<option value="${i}" ${i === activeIdx ? 'selected' : ''}>${escapeHtml(s.name)} (${s.sequence.length} ${s.type === 'protein' ? 'aa' : 'bp'})</option>`
    ).join('');

    const secondIdx = activeIdx < sequences.length - 1 ? activeIdx + 1 : 0;
    const options2 = sequences.map((s, i) =>
        `<option value="${i}" ${i === secondIdx ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    ).join('');

    return `
    <div class="panel active">
      <div class="panel-header">
        <h2>Dot Plot Analysis</h2>
        <p>Compare two sequences using a dot matrix to identify regions of similarity, repeats, and inversions</p>
      </div>
      <div class="panel-controls">
        <div class="form-group">
          <label class="form-label">Sequence X (horizontal)</label>
          <select class="form-select" id="dotplot-seq1">${options}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Sequence Y (vertical)</label>
          <select class="form-select" id="dotplot-seq2">${options2}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Window Size</label>
          <select class="form-select" id="dotplot-window">
            <option value="1">1 (exact)</option>
            <option value="5">5</option>
            <option value="10" selected>10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Threshold (%)</label>
          <select class="form-select" id="dotplot-threshold">
            <option value="60">60%</option>
            <option value="70" selected>70%</option>
            <option value="80">80%</option>
            <option value="90">90%</option>
            <option value="100">100%</option>
          </select>
        </div>
        <button class="btn btn-primary" id="run-dotplot-btn">Generate Dot Plot</button>
      </div>
      <div class="panel-body" id="dotplot-result">
        <div class="empty-state">
          <span class="empty-state-icon" style="font-size:32px;opacity:0.3;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="10" cy="10" r="1" fill="currentColor"/><circle cx="13" cy="13" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>
          </span>
          <p class="empty-state-text">Select two sequences and click "Generate Dot Plot"</p>
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Diagonal lines indicate regions of similarity between sequences</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the dot plot result panel. All computation lives in
 * `src/core/dotplot.js`; this function only draws the returned matrix.
 *
 * @param {{ name: string, sequence: string }} seq1
 * @param {{ name: string, sequence: string }} seq2
 * @param {number} [windowSize]
 * @param {number} [threshold]
 * @returns {string} HTML
 */
export function computeDotPlot(seq1, seq2, windowSize = 10, threshold = 70) {
    let matrix;
    try {
        matrix = computeDotMatrix(seq1.sequence, seq2.sequence, { windowSize, threshold });
    } catch (e) {
        if (e instanceof BioError) {
            return `<div class="empty-state"><p class="empty-state-text">${escapeHtml(e.message)}</p></div>`;
        }
        throw e;
    }

    const { lengthA: len1, lengthB: len2 } = matrix.dimensions;
    const canvasSize = 400;

    // Build SVG dot plot
    let dots = '';
    for (const point of matrix.points) {
        const opacity = Math.min(1, (point.identity - 0.5) * 3);
        const x = (point.x / len1 * canvasSize).toFixed(1);
        const y = (point.y / len2 * canvasSize).toFixed(1);
        const w = Math.max(1, (windowSize / len1 * canvasSize)).toFixed(1);
        const h = Math.max(1, (windowSize / len2 * canvasSize)).toFixed(1);
        dots += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--accent-cyan)" opacity="${opacity.toFixed(2)}" />`;
    }

    // Ruler ticks
    let ticks = '';
    const tickX = Math.ceil(len1 / 5);
    const tickY = Math.ceil(len2 / 5);
    for (let i = 0; i <= 5; i++) {
        const xPos = (i / 5 * canvasSize).toFixed(0);
        const yPos = (i / 5 * canvasSize).toFixed(0);
        ticks += `<text x="${xPos}" y="${canvasSize + 14}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${Math.round(i / 5 * len1)}</text>`;
        ticks += `<text x="-6" y="${yPos}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--text-muted)">${Math.round(i / 5 * len2)}</text>`;
    }

    return `
    <div style="margin-bottom:16px;">
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-title">Seq X</div><div class="stat-value" style="font-size:14px;">${escapeHtml(seq1.name)}</div></div>
        <div class="stat-card"><div class="stat-title">Length X</div><div class="stat-value">${len1}<span class="stat-unit">bp</span></div></div>
        <div class="stat-card"><div class="stat-title">Seq Y</div><div class="stat-value" style="font-size:14px;">${escapeHtml(seq2.name)}</div></div>
        <div class="stat-card"><div class="stat-title">Length Y</div><div class="stat-value">${len2}<span class="stat-unit">bp</span></div></div>
      </div>
    </div>
    <div class="dotplot-canvas-wrap">
      <svg width="${canvasSize + 40}" height="${canvasSize + 30}" style="overflow:visible;">
        <g transform="translate(30, 0)">
          <rect width="${canvasSize}" height="${canvasSize}" fill="var(--bg-primary)" rx="2"/>
          ${dots}
          ${ticks}
          <text x="${canvasSize / 2}" y="${canvasSize + 28}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${escapeHtml(seq1.name)}</text>
        </g>
      </svg>
    </div>
    <p style="font-size:11px;color:var(--text-muted);margin-top:12px;">
      Window: ${windowSize} | Threshold: ${threshold}% | Diagonal lines = regions of similarity
    </p>
  `;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
