// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Linear Map View Component
// ============================================

import { findRestrictionSites } from '../utils/restriction.js';

export function renderLinearMap(seq) {
  const len = seq.sequence.length;
  // Support both 'features' (sample data) and 'annotations' (editor) for compatibility
  const annotations = seq.features || seq.annotations || [];

  // Calculate Unique Restriction Sites
  const allResults = findRestrictionSites(seq.sequence);
  const uniqueCutSites = allResults.filter(r => r.numCuts === 1).flatMap(r => r.positions.map(p => ({
    pos: p, enzyme: r.name, overhang: r.overhang
  })));

  if (annotations.length === 0 && uniqueCutSites.length === 0) {
    return `
      <div class="panel active">
        <div class="panel-header"><h2><span data-i18n="Linear Map">Linear Map</span></h2><p>${escapeHtml(seq.name)} — ${len.toLocaleString()} ${seq.type === 'protein' ? 'aa' : 'bp'}</p></div>
        <div class="panel-body">
          ${buildLinearMapSVG(seq, [], [])}
          <div style="margin-top:20px;padding:24px;border:1px dashed var(--border-default);border-radius:var(--radius-md);text-align:center;color:var(--text-muted);font-size:13px;">No features or unique cut sites to display. Use the Sequence Editor to add features.</div>
        </div>
      </div>`;
  }

  return `
    <div class="panel active">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2><span data-i18n="Linear Map">Linear Map</span></h2>
          <p>${escapeHtml(seq.name)} — ${len.toLocaleString()} ${seq.type === 'protein' ? 'aa' : 'bp'} | ${annotations.length} feature(s)</p>
        </div>
        <!-- Align toggles on the right -->
        <div style="display:flex;gap:12px;align-items:center;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-tertiary);padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border-default);">
            <input type="checkbox" id="toggle-linear-cut-sites" checked style="accent-color:var(--accent-pink);">
            <span style="font-size:12px;font-weight:600;color:var(--text-primary);">Show Unique Cut Sites</span>
          </label>
        </div>
      </div>
      <div class="panel-body">
        <div style="background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:24px 16px;margin-bottom:24px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
          ${buildLinearMapSVG(seq, annotations, uniqueCutSites)}
        </div>
        ${buildFeatureTable(annotations, len)}
      </div>
    </div>
  `;
}

function buildLinearMapSVG(seq, annotations, cutSites) {
  const len = seq.sequence.length;
  const width = 1000;
  const margin = 40;
  const trackW = width - margin * 2;
  const backboneY = 70;
  const featureHeight = 16;
  const featureGap = 4;

  // Assign tracks to features (avoid overlaps)
  const tracks = assignTracks(annotations, len);
  const numTracks = Math.max(1, ...tracks.map(t => t.track + 1));
  const svgHeight = backboneY + numTracks * (featureHeight + featureGap) + 50;

  // Color palette for feature types
  const typeColors = {
    'gene': 'var(--feat-gene)',
    'CDS': 'var(--feat-cds)',
    'promoter': 'var(--feat-promoter)',
    'terminator': 'var(--feat-terminator)',
    'rep_origin': 'var(--feat-rep-origin)',
    'misc_feature': 'var(--feat-misc)',
    'regulatory': 'var(--feat-regulatory)',
    'primer_bind': 'var(--feat-primer-bind)',
    'exon': 'var(--feat-exon)'
  };

  let svg = `<div style="min-width:${width}px;">
      <svg width="100%" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" style="display:block;">
        <defs>
          <filter id="linear-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>`;

  // --- Ruler Ticks ---
  const numTicks = Math.min(25, Math.max(5, Math.ceil(len / 200)));
  for (let i = 0; i <= numTicks; i++) {
    const pos = Math.round((i / numTicks) * len);
    const x = margin + (pos / len) * trackW;
    svg += `<line x1="${x}" y1="${backboneY - 12}" x2="${x}" y2="${backboneY - 2}" stroke="var(--border-muted)" stroke-width="1.5" opacity="0.8"/>`;
    svg += `<text x="${x}" y="${backboneY - 18}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="var(--font-mono)" font-weight="500">${pos === 0 ? 1 : pos.toLocaleString()}</text>`;
  }

  // --- Backbone ---
  svg += `<line x1="${margin}" y1="${backboneY}" x2="${margin + trackW}" y2="${backboneY}" stroke="var(--border-default)" stroke-width="4" stroke-linecap="round"/>`;
  if (seq.topology === 'circular') {
    svg += `<circle cx="${margin}" cy="${backboneY}" r="4" fill="#6e7681"/>`;
    svg += `<circle cx="${margin + trackW}" cy="${backboneY}" r="4" fill="#6e7681"/>`;
  }

  // --- Cut Sites Group ---
  svg += `<g id="linear-cut-sites">`;
  const cutSiteYOffset = 35;
  let lastLabelX = -999; // Track last label X to avoid overlap
  const MIN_LABEL_PX_GAP = 45; // Minimum px between consecutive labels

  cutSites.forEach(cut => {
    const x = margin + (cut.pos / len) * trackW;
    svg += `<line x1="${x}" y1="${backboneY - 1}" x2="${x}" y2="${backboneY - cutSiteYOffset + 4}" stroke="var(--accent-pink)" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6"/>`;
    svg += `<path d="M${x - 4} ${backboneY - cutSiteYOffset} L${x + 4} ${backboneY - cutSiteYOffset} L${x} ${backboneY - cutSiteYOffset + 6} Z" fill="var(--accent-pink)" opacity="0.9"/>`;

    // Only render label if far enough from the previous one
    const showLabel = (x - lastLabelX) > MIN_LABEL_PX_GAP;
    if (showLabel) {
      lastLabelX = x;
      svg += `<text x="${x}" y="${backboneY - cutSiteYOffset - 6}" text-anchor="middle" font-size="10" fill="var(--accent-pink)" font-family="var(--font-mono)" font-weight="600" style="text-shadow:0 1px 2px #000;">${cut.enzyme}</text>`;
    }
  });
  svg += `</g>`;

  // --- Features ---
  for (const feat of tracks) {
    const x = margin + (feat.start / len) * trackW;
    const w = Math.max(6, ((feat.end - feat.start) / len) * trackW);
    const y = backboneY + 14 + feat.track * (featureHeight + featureGap);
    const color = typeColors[feat.type] || typeColors['misc_feature'];

    svg += `<g class="linear-map-feature" style="cursor:pointer;transition:all 0.2s;" fill="${color}">`;

    // Arrow shape for directionality
    if (feat.direction === 'forward' || !feat.direction || feat.direction === '+') {
      const arrowW = Math.min(8, w * 0.3);
      svg += `<path d="M${x} ${y} L${x + w - arrowW} ${y} L${x + w} ${y + featureHeight / 2} L${x + w - arrowW} ${y + featureHeight} L${x} ${y + featureHeight} Z" opacity="0.85" filter="url(#linear-glow)">
               <title>${escapeHtml(feat.name)} (${feat.type}) ${feat.start + 1}..${feat.end}</title>
            </path>`;
    } else {
      const arrowW = Math.min(8, w * 0.3);
      svg += `<path d="M${x + arrowW} ${y} L${x + w} ${y} L${x + w} ${y + featureHeight} L${x + arrowW} ${y + featureHeight} L${x} ${y + featureHeight / 2} Z" opacity="0.85" filter="url(#linear-glow)">
               <title>${escapeHtml(feat.name)} (${feat.type}) ${feat.start + 1}..${feat.end}</title>
            </path>`;
    }

    // Label
    if (w > 35) {
      svg += `<text x="${x + w / 2}" y="${y + featureHeight / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#ffffff" font-family="var(--font-sans)" font-weight="600" pointer-events="none" style="text-shadow:0 1px 3px rgba(0,0,0,0.8);">${escapeHtml(feat.name.substring(0, Math.floor(w / 7)))}</text>`;
    }
    svg += `</g>`;
  }

  svg += '</svg></div>';
  return svg;
}

function assignTracks(annotations, seqLen) {
  const features = annotations.map(a => ({
    name: a.name || a.label || 'feature',
    type: a.type || 'misc_feature',
    start: a.start || 0,
    end: a.end || 0,
    direction: a.direction || a.strand || 'forward',
    track: 0
  })).sort((a, b) => a.start - b.start);

  const trackEnds = [0];
  for (const feat of features) {
    let placed = false;
    // Require a 10px buffer between features
    const buffer = (seqLen * 0.01);

    for (let t = 0; t < trackEnds.length; t++) {
      if (feat.start >= trackEnds[t]) {
        feat.track = t;
        trackEnds[t] = feat.end + buffer;
        placed = true;
        break;
      }
    }
    if (!placed) {
      feat.track = trackEnds.length;
      trackEnds.push(feat.end + buffer);
    }
  }

  return features;
}

function buildFeatureTable(annotations, len) {
  if (annotations.length === 0) return '';

  let rows = annotations.map((a, i) => `
    <tr style="border-bottom:1px solid var(--border-muted);">
      <td style="padding:10px 12px;color:var(--text-muted);">${i + 1}</td>
      <td style="padding:10px 12px;font-weight:600;color:var(--text-primary);">${escapeHtml(a.name || a.label || 'unnamed')}</td>
      <td style="padding:10px 12px;"><span style="background:var(--bg-tertiary);padding:4px 8px;border-radius:var(--radius-sm);font-size:11px;color:var(--text-secondary);">${a.type || 'misc_feature'}</span></td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan);">${(a.start || 0) + 1}</td>
      <td style="padding:10px 12px;font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan);">${a.end || 0}</td>
      <td style="padding:10px 12px;font-size:12px;">${((a.end || 0) - (a.start || 0) + 1).toLocaleString()} ${len > 0 ? 'bp' : ''}</td>
      <td style="padding:10px 12px;font-weight:600;color:${a.direction === 'reverse' || a.strand === '-' ? 'var(--accent-pink)' : 'var(--accent-blue)'}">${a.direction === 'reverse' || a.strand === '-' ? 'Rev (-)' : 'Fwd (+)'}</td>
    </tr>
  `).join('');

  return `
    <div style="margin-top:20px;background:var(--bg-elevated);border-radius:var(--radius-lg);border:1px solid var(--border-default);overflow:hidden;">
      <h3 style="font-size:13px;font-weight:700;padding:16px 20px;border-bottom:1px solid var(--border-default);color:var(--text-primary);background:rgba(255,255,255,0.02);margin:0;text-transform:uppercase;letter-spacing:0.5px;">Feature Annotations</h3>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;">
          <thead style="background:var(--bg-tertiary);border-bottom:1px solid var(--border-default);">
             <tr>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;">#</th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;"><span data-i18n="Name">Name</span></th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;"><span data-i18n="Type">Type</span></th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;">Start</th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;">End</th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;"><span data-i18n="Length">Length</span></th>
               <th style="padding:12px;color:var(--text-muted);font-weight:600;"><span data-i18n="Strand">Strand</span></th>
             </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export function bindLinearMapEvents() {
  const toggle = document.getElementById('toggle-linear-cut-sites');
  const cutSitesGroup = document.getElementById('linear-cut-sites');

  if (toggle && cutSitesGroup) {
    toggle.addEventListener('change', (e) => {
      cutSitesGroup.style.display = e.target.checked ? 'block' : 'none';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
