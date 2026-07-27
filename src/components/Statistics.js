// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Statistics Component v2
// Adds: pI, GRAVY, instability index, compact layout, donut SVG
// ============================================

import { computeSequenceStats } from '../core/statistics.js';

function donutSVG(segments, size = 90) {
  const r = 34, cx = size / 2, cy = size / 2, strokeW = 12;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let paths = '', offset = 0;
  const circ = 2 * Math.PI * r;
  for (const seg of segments) {
    const dash = (seg.value / total) * circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash} ${circ - dash}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})">
      <title>${seg.label}: ${(seg.value / total * 100).toFixed(1)}%</title>
    </circle>`;
    offset += dash;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

/** @param {import('../core/statistics.js').GcWindowSeries} series */
function gcWindowPlot(series) {
  const { points, windowSize } = series;
  if (points.length === 0) return '';
  const W = 560, H = 80;
  const xScale = W / series.sequenceLength;
  const pts = points.map(p => `${(p.x * xScale).toFixed(1)},${(H - p.y / 100 * H).toFixed(1)}`).join(' ');
  const area = `${points[0].x * xScale},${H} ` + pts + ` ${points[points.length - 1].x * xScale},${H}`;

  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">GC Content — Sliding Window (${windowSize} bp)</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border-muted);">
        <defs>
          <linearGradient id="gcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="${H * 0.5}" x2="${W}" y2="${H * 0.5}" stroke="var(--border-muted)" stroke-dasharray="4,4" stroke-width="1"/>
        <text x="4" y="${H * 0.5 - 3}" fill="var(--text-muted)" font-size="8" font-family="monospace">50%</text>
        <polygon points="${area}" fill="url(#gcGrad)"/>
        <polyline points="${pts}" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5"/>
      </svg>
    </div>`;
}

/**
 * Render the Statistics panel. All computation lives in
 * `src/core/statistics.js`; this function only turns the returned object into
 * markup.
 *
 * @param {{ name: string, sequence: string, type: string }} seq
 * @returns {string} HTML
 */
export function renderStatistics(seq) {
  const stats = computeSequenceStats(seq.sequence, seq.type);
  const { length: len, type, composition: comp } = stats;
  const gc = stats.gc;
  const mw = stats.molecularWeight;
  const tm = stats.meltingTemp;
  const pi = stats.protein ? stats.protein.pI : null;
  const gravy = stats.protein ? stats.protein.gravy : null;
  const ii = stats.protein ? stats.protein.instabilityIndex : null;

  // ---- Stats Cards ----
  const statCards = [
    { label: 'Length', val: len.toLocaleString(), unit: type === 'protein' ? 'aa' : 'bp' },
    { label: 'MW', val: mw > 1000 ? (mw / 1000).toFixed(2) : mw.toFixed(0), unit: mw > 1000 ? 'kDa' : 'Da' },
    gc !== null ? { label: 'GC Content', val: gc.toFixed(1), unit: '%' } : null,
    tm !== null ? { label: 'Tm', val: tm.toFixed(1), unit: '°C' } : null,
    pi !== null ? { label: 'pI', val: pi.toFixed(2), unit: '' } : null,
    gravy !== null ? { label: 'GRAVY', val: gravy.toFixed(3), unit: '', color: gravy > 0 ? 'var(--accent-orange)' : 'var(--accent-blue)' } : null,
    ii !== null ? { label: 'Instability Index', val: ii.toFixed(1), unit: '', color: ii > 40 ? 'var(--accent-red)' : 'var(--accent-green)' } : null,
  ].filter(Boolean);

  const cardsHtml = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
      ${statCards.map(c => `
        <div class="stat-card" style="padding:12px 14px;">
          <div class="stat-title">${c.label}</div>
          <div class="stat-value" style="font-size:20px;${c.color ? 'color:' + c.color : ''}">${c.val}${c.unit ? `<span class="stat-unit">${c.unit}</span>` : ''}</div>
        </div>`).join('')}
    </div>`;

  // ---- Composition ----
  let compositionHtml = '';
  if (type !== 'protein') {
    const total = comp.A + comp.T + comp.C + comp.G + (comp.U || 0);
    const segments = [
      { label: 'A', count: comp.A, color: 'var(--nt-a)' },
      { label: 'T', count: comp.T, color: 'var(--nt-t)' },
      { label: 'C', count: comp.C, color: 'var(--nt-c)' },
      { label: 'G', count: comp.G, color: 'var(--nt-g)' },
      ...(comp.U > 0 ? [{ label: 'U', count: comp.U, color: 'var(--nt-u)' }] : [])
    ].filter(s => s.count > 0);

    const donut = donutSVG(segments.map(s => ({ label: s.label, value: s.count, color: s.color })));

    compositionHtml = `
        <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;">
          <div style="flex-shrink:0;">${donut}</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Nucleotide Composition</div>
            ${segments.map(s => {
      const pct = (s.count / total * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="width:14px;height:14px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                <span style="font-weight:700;font-size:12px;width:16px;">${s.label}</span>
                <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${s.color};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);min-width:100px;text-align:right;">${s.count.toLocaleString()} (${pct.toFixed(1)}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;

    // GC plot only for DNA > 200bp
    if (stats.gcWindow) {
      compositionHtml += gcWindowPlot(stats.gcWindow);
    }
  } else {
    // Protein — top AA chart + property breakdown
    const entries = stats.protein.residues;
    const total = stats.protein.total;
    const groups = stats.protein.groups;
    const aaColors = {
      A: '#3fb950', I: '#3fb950', L: '#3fb950', M: '#3fb950', F: '#3fb950', W: '#3fb950', V: '#3fb950', P: '#3fb950',
      S: '#58a6ff', T: '#58a6ff', Y: '#58a6ff', N: '#58a6ff', Q: '#58a6ff', H: '#58a6ff', C: '#58a6ff',
      R: '#f85149', K: '#f85149', D: '#f778ba', E: '#f778ba', G: '#e3b341'
    };

    const groupSegments = [
      { label: 'Hydrophobic', value: groups.hydrophobic, color: '#3fb950' },
      { label: 'Polar', value: groups.polar, color: '#58a6ff' },
      { label: 'Positive', value: groups.positive, color: '#f85149' },
      { label: 'Negative', value: groups.negative, color: '#f778ba' },
      { label: 'Special', value: groups.special, color: '#e3b341' },
    ].filter(s => s.value > 0);

    compositionHtml = `
        <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;flex-wrap:wrap;">
          <div style="flex-shrink:0;">${donutSVG(groupSegments, 100)}</div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">AA Property Groups</div>
            ${groupSegments.map(s => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="width:14px;height:14px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                <span style="font-size:12px;flex:1;">${s.label}</span>
                <div style="width:80px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${(s.value / total * 100)}%;height:100%;background:${s.color};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);min-width:70px;text-align:right;">${s.value} (${(s.value / total * 100).toFixed(1)}%)</span>
              </div>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Amino Acid Composition</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;">
            ${entries.map(([aa, count]) => {
      const pct = (count / total * 100);
      const color = aaColors[aa] || '#6e7681';
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="font-weight:700;width:14px;color:${color};font-family:var(--font-mono);">${aa}</span>
                <div style="flex:1;height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${Math.max(pct, 0.3)}%;height:100%;background:${color};opacity:0.8;border-radius:3px;"></div>
                </div>
                <span style="color:var(--text-muted);min-width:55px;text-align:right;">${count} (${pct.toFixed(1)}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;
  }

  // ---- ORFs for DNA/RNA ----
  let orfHtml = '';
  if (stats.orfs) {
    const orfs = stats.orfs;
    orfHtml = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Open Reading Frames (≥ 90 bp) — ${orfs.length} found</div>
          ${orfs.length > 0 ? `
          <div class="orf-container" style="margin-bottom:10px;">
            ${[1, 2, 3].map(frame => {
      const fOrfs = orfs.filter(o => o.frame === frame);
      return `<div class="orf-track">
                <span class="orf-track-label">+${frame}</span>
                <div class="orf-track-bar">
                  ${fOrfs.map(orf => {
        const left = (orf.start / len * 100).toFixed(2);
        const width = ((orf.end - orf.start) / len * 100).toFixed(2);
        return `<div class="orf-block" style="left:${left}%;width:${width}%;" title="${orf.start + 1}..${orf.end} (${orf.length} bp)"></div>`;
      }).join('')}
                </div>
              </div>`;
    }).join('')}
          </div>
          <div style="overflow-x:auto;">
            <table class="blast-results-table" style="font-size:11px;">
              <thead><tr><th>Frame</th><th>Start</th><th>End</th><th>Length</th><th>Protein (aa)</th><th>Start Codon</th></tr></thead>
              <tbody>
                ${orfs.slice(0, 12).map(orf => `
                  <tr>
                    <td>+${orf.frame}</td>
                    <td>${(orf.start + 1).toLocaleString()}</td>
                    <td>${orf.end.toLocaleString()}</td>
                    <td>${orf.length} bp / ${orf.protein.length} aa</td>
                    <td style="font-family:var(--font-mono);">${orf.protein.substring(0, 25)}${orf.protein.length > 25 ? '…' : ''}</td>
                    <td style="font-family:var(--font-mono);color:var(--accent-green);">ATG</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<p style="color:var(--text-muted);font-size:12px;">No ORFs ≥ 90 bp found.</p>`}
        </div>`;
  }

  // ---- Codon usage ----
  let codonHtml = '';
  if (stats.codonUsage) {
    const { total: totalCodons, top } = stats.codonUsage;
    codonHtml = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Top Codon Usage (Frame +1)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:5px;">
            ${top.map(([codon, count]) => {
      const pct = (count / totalCodons * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-primary);width:34px;">${codon}</span>
                <div style="flex:1;height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${Math.max(parseFloat(pct) * 3, 1)}%;height:100%;background:var(--accent-cyan);border-radius:3px;"></div>
                </div>
                <span style="color:var(--text-muted);min-width:55px;text-align:right;">${count} (${pct}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;
  }

  // ---- Export button ----
  const exportBtn = `
      <button class="btn btn-secondary" id="stats-export-btn" style="font-size:11px;padding:5px 12px;margin-bottom:12px;">
        ↓ Export Report
      </button>`;

  return `
    <div class="panel active">
      <div class="panel-header">
        <h2>Sequence Statistics</h2>
        <p>${escapeHtml(seq.name)} · ${len.toLocaleString()} ${type === 'protein' ? 'aa' : 'bp'} · ${type.toUpperCase()}</p>
      </div>
      <div class="panel-body">
        ${exportBtn}
        ${cardsHtml}
        ${compositionHtml}
        ${orfHtml}
        ${codonHtml}
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
