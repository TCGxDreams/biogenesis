// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Plasmid Map Component
// ============================================

import { findRestrictionSites } from '../utils/restriction.js';

export function renderPlasmidMap(seq) {
  const seqStr = seq.sequence;
  const len = seqStr.length;
  // Support both 'features' (sample data) and 'annotations' (editor)
  const features = seq.features || seq.annotations || [];
  // Detect circularity from multiple possible properties
  const isCircular = seq.circular === true || seq.topology === 'circular';

  const featureColors = {
    'gene': 'var(--feat-gene)', 'CDS': 'var(--feat-cds)', 'promoter': 'var(--feat-promoter)',
    'misc_feature': 'var(--feat-misc)', 'rep_origin': 'var(--feat-rep-origin)', 'terminator': 'var(--feat-terminator)',
    'primer_bind': 'var(--feat-primer-bind)', 'regulatory': 'var(--feat-regulatory)', 'exon': 'var(--feat-exon)'
  };

  // Calculate Unique Restriction Sites
  const allResults = findRestrictionSites(seqStr);
  const uniqueCutSites = allResults.filter(r => r.numCuts === 1).flatMap(r => r.positions.map(p => ({
    pos: p, enzyme: r.name
  })));

  // SVG parameters
  const size = 600;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 180;
  const featureRadius = radius + 25;
  const labelRadius = radius + 43;
  const cutSiteRadius = radius - 20;

  let svg = `<svg class="plasmid-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(seq.name)}" style="width:100%;max-width:600px;display:block;margin:0 auto;">
    <title>${escapeHtml(seq.name)} · ${len.toLocaleString()} bp</title>`;

  // --- Draw Backbone ---
  svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--border-default)" stroke-width="4" opacity="0.8"/>`;

  // --- Center Text (Name & Length) ---
  svg += `<g class="plasmid-center-text" style="cursor:default;">
      <text x="${cx}" y="${cy - 20}" text-anchor="middle" fill="var(--text-primary)" font-size="22" font-weight="800" font-family="var(--font-sans)">${escapeHtml(seq.name)}</text>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="var(--accent-cyan)" font-size="14" font-family="var(--font-mono)" font-weight="600">${len.toLocaleString()} bp</text>
      <text x="${cx}" y="${cy + 25}" text-anchor="middle" fill="var(--text-muted)" font-size="12" font-family="var(--font-sans)">${isCircular ? 'Circular' : 'Linear'}</text>
    </g>`;

  // --- Tick marks every 10% or fixed intervals ---
  const tickInterval = len > 10000 ? 2000 : len > 5000 ? 1000 : len > 2000 ? 500 : len > 500 ? 100 : 50;
  for (let i = 0; i < len; i += tickInterval) {
    const angle = (i / len) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * (radius - 8);
    const y1 = cy + Math.sin(angle) * (radius - 8);
    const x2 = cx + Math.cos(angle) * (radius + 8);
    const y2 = cy + Math.sin(angle) * (radius + 8);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border-default)" stroke-width="1.5"/>`;

    // Label every other tick or all if small
    if (i % (tickInterval * 2) === 0 || i === 0 || tickInterval >= 1000) {
      const lx = cx + Math.cos(angle) * (radius - 24);
      const ly = cy + Math.sin(angle) * (radius - 24);
      let displayPos = i > 0 ? (i >= 1000 ? (i / 1000) + 'k' : i) : '1';
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-secondary)" font-size="10" font-family="var(--font-mono)" font-weight="500">${displayPos}</text>`;
    }
  }

  // --- Draw Features as Arcs ---
  // Use feature's own name or label field first, then qualifiers, then type
  features.forEach((feat) => {
    const color = featureColors[feat.type] || featureColors['misc_feature'] || '#6e7681';
    const startAngle = (feat.start / len) * 360 - 90;
    const endAngle = (feat.end / len) * 360 - 90;
    const label = feat.name || feat.label || feat.qualifiers?.gene || feat.qualifiers?.product || feat.type;

    const startRad = startAngle * Math.PI / 180;
    const endRad = endAngle * Math.PI / 180;

    const x1 = cx + Math.cos(startRad) * featureRadius;
    const y1 = cy + Math.sin(startRad) * featureRadius;
    const x2 = cx + Math.cos(endRad) * featureRadius;
    const y2 = cy + Math.sin(endRad) * featureRadius;

    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;

    // Interactive hover group
    svg += `<g class="plasmid-feature">
          <path d="M${x1},${y1} A${featureRadius},${featureRadius} 0 ${largeArc} 1 ${x2},${y2}" 
            fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" opacity="0.85">
            <title>${escapeHtml(label)}: ${feat.start + 1}..${feat.end} (${feat.type})</title>
          </path>`;

    // Arrow direction
    if (!feat.complement) {
      const arrowAngle = endRad - 0.02; // Slightly back from tip
      const ax = cx + Math.cos(arrowAngle) * (featureRadius - 7);
      const ay = cy + Math.sin(arrowAngle) * (featureRadius - 7);
      const ax2 = cx + Math.cos(arrowAngle) * (featureRadius + 7);
      const ay2 = cy + Math.sin(arrowAngle) * (featureRadius + 7);
      const tipX = cx + Math.cos(endRad + 0.02) * featureRadius;
      const tipY = cy + Math.sin(endRad + 0.02) * featureRadius;
      svg += `<polygon points="${tipX},${tipY} ${ax},${ay} ${ax2},${ay2}" fill="${color}" opacity="0.9"/>`;
    } else {
      // Reverse arrow
      const arrowAngle = startRad + 0.02;
      const ax = cx + Math.cos(arrowAngle) * (featureRadius - 7);
      const ay = cy + Math.sin(arrowAngle) * (featureRadius - 7);
      const ax2 = cx + Math.cos(arrowAngle) * (featureRadius + 7);
      const ay2 = cy + Math.sin(arrowAngle) * (featureRadius + 7);
      const tipX = cx + Math.cos(startRad - 0.02) * featureRadius;
      const tipY = cy + Math.sin(startRad - 0.02) * featureRadius;
      svg += `<polygon points="${tipX},${tipY} ${ax},${ay} ${ax2},${ay2}" fill="${color}" opacity="0.9"/>`;
    }

    // Feature Label (curved or straight depending on length, simplified for now)
    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
    const lx = cx + Math.cos(midAngle) * labelRadius;
    const ly = cy + Math.sin(midAngle) * labelRadius;
    const textAnchor = 'middle';

    // Prevent label overlap near bottom/top
    const dy = (Math.sin(midAngle) > 0.8) ? 8 : (Math.sin(midAngle) < -0.8) ? -8 : 0;

    svg += `<text x="${lx}" y="${ly + dy}" text-anchor="${textAnchor}" dominant-baseline="middle" 
          fill="${color}" font-size="11" font-weight="700" font-family="var(--font-sans)">${escapeHtml(label)}</text>
        </g>`;
  });

  // --- Draw Unique Restriction Sites ---
  // Check all previously placed labels, including neighbours across the origin.
  // Every site remains visible as a tick and in the complete enzyme list.
  const labelBoxes = [];
  uniqueCutSites.sort((a, b) => a.pos - b.pos || a.enzyme.localeCompare(b.enzyme));

  svg += `<g id="plasmid-cut-sites">`;
  uniqueCutSites.forEach(cut => {
    const angle = (cut.pos / len) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius - 12);
    const y2 = cy + Math.sin(angle) * (radius - 12);
    const lx = cx + Math.cos(angle) * (cutSiteRadius - 15);
    const ly = cy + Math.sin(angle) * (cutSiteRadius - 15);

    const halfWidth = cut.enzyme.length * 3 + 5;
    const box = { left: lx - halfWidth, right: lx + halfWidth, top: ly - 9, bottom: ly + 9 };
    const showLabel = !labelBoxes.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
    if (showLabel) labelBoxes.push(box);

    svg += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent-pink)" stroke-width="1.5" opacity="0.8"><title>${escapeHtml(cut.enzyme)} · ${cut.pos + 1} bp</title></line>
        ${showLabel ? `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" 
          fill="var(--accent-pink)" font-size="9" font-family="var(--font-mono)" font-weight="600" opacity="0.9">${cut.enzyme}</text>` : ''}
        `;
  });
  svg += `</g>`;

  svg += '</svg>';

  // --- Feature Legend & Toggles ---
  let legendHtml = '';
  if (features.length > 0) {
    legendHtml = `
      <div class="plasmid-legend">
        <h4 style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;" data-vi="Vùng chức năng" data-en="Features">Vùng chức năng</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:8px;">
        ${features.map(feat => {
      const color = featureColors[feat.type] || 'var(--text-muted)';
      const label = feat.name || feat.label || feat.qualifiers?.gene || feat.qualifiers?.product || feat.type;
      return `
             <div style="display:flex;align-items:center;padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);">
                 <span style="width:10px;height:10px;border-radius:50%;background:${color};margin-right:10px;"></span>
                <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  <button class="feature-open-button" data-feature-start="${feat.start}" data-feature-end="${feat.end}">${escapeHtml(label)} ↗</button>
                  <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${feat.start + 1}..${feat.end}</span>
                </div>
            </div>`;
    }).join('')}
        </div>
      </div>`;
  }

  return `
    <div class="panel active plasmid-panel">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2><span data-i18n="Plasmid Map">Plasmid Map</span></h2>
          <p>${escapeHtml(seq.name)} — ${len.toLocaleString()} bp ${isCircular ? '(Circular)' : '(Linear)'}</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-tertiary);padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-default);">
            <input type="checkbox" id="toggle-cut-sites" checked style="accent-color:var(--accent-pink);">
            <span style="font-size:12px;font-weight:600;color:var(--text-primary);" data-vi="Vị trí cắt duy nhất" data-en="Unique cut sites">Vị trí cắt duy nhất</span>
          </label>
        </div>
      </div>
      <div class="panel-body">
        <div class="plasmid-map-surface">
           ${svg}
        </div>
        <aside class="plasmid-details">
        ${legendHtml}
        <details class="plasmid-enzyme-list"><summary><span data-vi="Danh sách enzyme cắt một lần" data-en="Single-cut enzyme list">Danh sách enzyme cắt một lần</span> (${uniqueCutSites.length})</summary>
        <p data-vi="Các nhãn quá sát nhau được lược trên hình. Tất cả vị trí vẫn có trong danh sách này (tọa độ bắt đầu từ 1)." data-en="Crowded labels are omitted on the map. All sites are listed here (1-based coordinates).">Các nhãn quá sát nhau được lược trên hình. Tất cả vị trí vẫn có trong danh sách này (tọa độ bắt đầu từ 1).</p>
        <div class="plasmid-enzyme-rows">${uniqueCutSites.map(cut => `<div><strong>${escapeHtml(cut.enzyme)}</strong><span>${cut.pos + 1} bp</span></div>`).join('')}</div></details>
        </aside>
      </div>
    </div>
  `;
}

export function bindPlasmidMapEvents() {
  const toggle = document.getElementById('toggle-cut-sites');
  const cutSitesGroup = document.getElementById('plasmid-cut-sites');

  if (toggle && cutSitesGroup) {
    toggle.addEventListener('change', (e) => {
      cutSitesGroup.style.display = e.target.checked ? 'block' : 'none';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
