// ============================================
// BioGenesis — Restriction Analysis Component v2
// ============================================

import { findRestrictionSites, RESTRICTION_ENZYMES_UNIQUE, simulateDigest, renderGelSVG } from '../utils/restriction.js';

export function renderRestrictionAnalysis(seq) {
  if (seq.type === 'protein') {
    return `<div class="panel active">
          <div class="panel-header"><h2>Restriction Analysis</h2><p>Requires a DNA sequence</p></div>
          <div class="panel-body"><div class="empty-state"><span class="empty-state-icon">🔬</span><p class="empty-state-text">Select a DNA sequence</p></div></div>
        </div>`;
  }

  const allResults = findRestrictionSites(seq.sequence);
  const totalCuts = allResults.reduce((sum, r) => sum + r.numCuts, 0);
  const uniqueCutters = allResults.filter(r => r.numCuts === 1);
  const nonCutters = RESTRICTION_ENZYMES_UNIQUE.length - allResults.length;
  const seqLen = seq.sequence.length;

  // Group stats
  const groups = { common: 0, '4cutter': 0, rare: 0, golden: 0, methylation: 0 };
  allResults.forEach(r => { if (groups[r.group] !== undefined) groups[r.group]++; });

  // Cut map SVG (compact)
  const allCuts = allResults.flatMap(r => r.positions.map(p => ({ pos: p, enzyme: r.name, color: overhangColor(r.overhang) })));
  allCuts.sort((a, b) => a.pos - b.pos);

  const cutMapSvg = buildCutMapSVG(allCuts, seqLen);

  // Enzyme table rows
  const enzymeRows = allResults.map((r, idx) => `
      <tr class="enzyme-row" data-idx="${idx}" data-enzyme="${r.name}" style="cursor:pointer;">
        <td style="padding:5px 8px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" class="enzyme-check" data-enzyme="${r.name}" style="accent-color:var(--accent-cyan);">
            <span style="font-weight:600;font-family:var(--font-mono);font-size:11px;">${r.name}</span>
          </label>
        </td>
        <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;color:var(--accent-blue);letter-spacing:1.5px;">${r.site}</td>
        <td style="padding:5px 8px;">
          <span class="overhang-badge overhang-${r.overhang.replace("'", "p")}">${r.overhang === 'blunt' ? 'Blunt' : r.overhang === '5prime' ? "5'" : "3'"}</span>
        </td>
        <td style="padding:5px 8px;text-align:center;">
          <span class="cuts-badge ${r.numCuts === 1 ? 'cuts-unique' : r.numCuts <= 3 ? 'cuts-few' : 'cuts-many'}">${r.numCuts}</span>
        </td>
        <td style="padding:5px 8px;font-size:11px;color:var(--text-muted);">${r.positions.slice(0, 3).map(p => (p + 1).toLocaleString()).join(', ')}${r.positions.length > 3 ? '…' : ''}</td>
      </tr>`).join('');

  return `
    <div class="panel active" id="panel-restriction">
      <div class="panel-header">
        <h2>Restriction Analysis</h2>
        <p>${escapeHtml(seq.name)} · ${seqLen.toLocaleString()} bp · ${allResults.length} enzymes · ${totalCuts} cuts</p>
      </div>

      <!-- Stats row -->
      <div class="panel-controls" style="gap:12px;flex-wrap:nowrap;overflow-x:auto;">
        <div class="re-stat"><span class="re-stat-val">${allResults.length}</span><span class="re-stat-lbl">Cutters</span></div>
        <div class="re-stat"><span class="re-stat-val" style="color:var(--accent-cyan)">${uniqueCutters.length}</span><span class="re-stat-lbl">Unique</span></div>
        <div class="re-stat"><span class="re-stat-val">${totalCuts}</span><span class="re-stat-lbl">Total cuts</span></div>
        <div class="re-stat"><span class="re-stat-val" style="color:var(--text-muted)">${nonCutters}</span><span class="re-stat-lbl">Non-cutters</span></div>
        <div style="flex:1"></div>
        <!-- Filter controls -->
        <label class="form-label" style="white-space:nowrap">Filter:</label>
        <select id="re-filter-group" style="font-size:11px;padding:4px 24px 4px 8px;min-width:110px;">
          <option value="all">All Groups</option>
          <option value="common">Common (6-cut)</option>
          <option value="4cutter">4-Cutters</option>
          <option value="rare">Rare Cutters</option>
          <option value="golden">Golden Gate</option>
        </select>
        <select id="re-filter-cuts" style="font-size:11px;padding:4px 24px 4px 8px;min-width:110px;">
          <option value="all">All Cutters</option>
          <option value="1">Unique (1 cut)</option>
          <option value="2-3">2–3 cuts</option>
          <option value="many">4+ cuts</option>
        </select>
        <button class="btn btn-secondary" id="re-select-unique" style="font-size:11px;padding:4px 10px;white-space:nowrap;">Select unique</button>
        <button class="btn btn-secondary" id="re-clear-all" style="font-size:11px;padding:4px 10px;">Clear</button>
      </div>

      <div style="display:flex;flex:1;overflow:hidden;gap:0;">
        <!-- Enzyme table -->
        <div style="flex:1;overflow:auto;border-right:1px solid var(--border-muted);">
          <!-- Cut map -->
          <div style="padding:12px 16px 8px;border-bottom:1px solid var(--border-muted);">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Cut Map</div>
            ${cutMapSvg}
          </div>

          <table class="re-table" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-default);position:sticky;top:0;background:var(--bg-secondary);z-index:2;">
                <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Enzyme</th>
                <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Site</th>
                <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overhang</th>
                <th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Cuts</th>
                <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Positions</th>
              </tr>
            </thead>
            <tbody id="re-enzyme-tbody">
              ${enzymeRows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No restriction sites found</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Gel panel -->
        <div style="width:220px;flex-shrink:0;overflow:auto;background:var(--bg-primary);">
          <div style="padding:12px 14px 8px;border-bottom:1px solid var(--border-muted);">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Virtual Gel</div>
          </div>
          <div id="gel-result" style="padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;">
            ${renderGelSVG([{ size: seqLen }], seqLen)}
            <p style="font-size:11px;color:var(--text-muted);text-align:center;">☑ Select enzymes to simulate digest</p>
          </div>
        </div>
      </div>
    </div>`;
}

function buildCutMapSVG(cuts, seqLen) {
  const w = 600, h = 36;
  const useDedupe = cuts.length > 50;
  const shown = useDedupe ? cuts.filter((_, i) => i % Math.ceil(cuts.length / 50) === 0) : cuts;

  let svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;overflow:visible;">`;
  svg += `<rect x="0" y="18" width="${w}" height="1.5" fill="var(--text-muted)" opacity="0.3"/>`;
  svg += `<text x="0" y="12" fill="var(--text-muted)" font-size="8" font-family="monospace">1</text>`;
  svg += `<text x="${w}" y="12" fill="var(--text-muted)" font-size="8" font-family="monospace" text-anchor="end">${seqLen.toLocaleString()}</text>`;

  for (const cut of shown) {
    const x = (cut.pos / seqLen * w).toFixed(1);
    svg += `<line x1="${x}" y1="12" x2="${x}" y2="26" stroke="${cut.color}" stroke-width="1.2" opacity="0.8">
          <title>${cut.enzyme} @${cut.pos + 1}</title></line>`;
  }

  svg += '</svg>';
  return svg;
}

function overhangColor(overhang) {
  if (overhang === '5prime') return 'var(--accent-cyan)';
  if (overhang === '3prime') return 'var(--accent-purple)';
  return 'var(--text-muted)';
}

export function renderDigestResult(seq, selectedEnzymeNames) {
  if (selectedEnzymeNames.length === 0) {
    return renderGelSVG([{ size: seq.sequence.length }], seq.sequence.length) +
      `<p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:8px;">Select enzymes above</p>`;
  }

  const allResults = findRestrictionSites(seq.sequence);
  const selectedEnzymes = allResults.filter(r => selectedEnzymeNames.includes(r.name));
  const fragments = simulateDigest(seq.sequence, selectedEnzymes);

  let html = renderGelSVG(fragments, seq.sequence.length);
  html += `<div style="margin-top:10px;font-size:11px;width:100%;">
      <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">${fragments.length} fragments</div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${fragments.map(f => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid var(--border-muted);">
            <span style="color:var(--text-secondary);font-family:var(--font-mono);">${f.size.toLocaleString()} bp</span>
            <span style="color:var(--text-muted);font-size:10px;">${((f.size / seq.sequence.length) * 100).toFixed(1)}%</span>
          </div>`).join('')}
      </div>
    </div>`;

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
