// ============================================
// BioGenesis — Sequence Viewer Component
// Optimized: chunked rendering, line-level coloring, mini-map, and ruler
// ============================================

import { getNucleotideClass, getAminoAcidClass, gcContent, complement, reverseComplement, translate, nucleotideComposition } from '../utils/bioUtils.js';

const INITIAL_LINES = 80;
const LINES_PER_CHUNK = 40;
const LINE_WIDTH = 60;

export function renderSequenceViewer(seq) {
  const seqStr = seq.sequence;
  const type = seq.type;
  const len = seqStr.length;
  const comp = type !== 'protein' ? nucleotideComposition(seqStr) : null;
  const gc = type !== 'protein' ? gcContent(seqStr).toFixed(1) : null;

  let infoBar = `<div class="seq-info-bar">
    <div class="seq-info-item"><span class="label">Name:</span><span class="value">${escapeHtml(seq.name)}</span></div>
    <div class="seq-info-item"><span class="label">Length:</span><span class="value">${len.toLocaleString()} ${type === 'protein' ? 'aa' : 'bp'}</span></div>
    <div class="seq-info-item"><span class="label">Type:</span><span class="value">${type.toUpperCase()}</span></div>`;

  if (gc !== null) infoBar += `<div class="seq-info-item"><span class="label">GC%:</span><span class="value">${gc}%</span></div>`;
  if (seq.circular || seq.topology === 'circular') infoBar += `<div class="seq-info-item"><span class="label">Topology:</span><span class="value">Circular</span></div>`;
  infoBar += '</div>';

  const totalLines = Math.ceil(len / LINE_WIDTH);
  const initialLineCount = Math.min(INITIAL_LINES, totalLines);

  // Mini-map Overview
  let miniMapHtml = '';
  if (len > 0) {
    miniMapHtml = buildMiniMap(seq, len);
  }

  const seqDisplay = buildSequenceChunk(seqStr, type, 0, initialLineCount);
  const hasMore = initialLineCount < totalLines;

  let annotationsHtml = '';
  if (seq.features && seq.features.length > 0) {
    annotationsHtml = buildAnnotations(seq.features, len);
  }

  let compositionHtml = '';
  if (comp) {
    compositionHtml = buildCompositionBar(comp);
  }

  return `
    <div class="panel active">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>Sequence Viewer</h2>
          <p>${escapeHtml(seq.description || seq.name)}</p>
        </div>
      </div>
      <div class="panel-body">
        ${infoBar}
        ${miniMapHtml}
        ${compositionHtml}
        ${annotationsHtml}
        
        <div style="background:var(--bg-elevated);border:1px solid var(--border-muted);border-radius:var(--radius-md);padding:16px;">
            <div class="sequence-display" id="seq-display" style="font-size:13px;line-height:1.6;"
                 data-type="${type}" data-total-lines="${totalLines}" data-loaded-lines="${initialLineCount}">
                ${seqDisplay}
            </div>
            ${hasMore ? `<div id="seq-load-more" style="text-align:center;padding-top:16px;border-top:1px solid var(--border-muted);margin-top:16px;">
              <button class="btn btn-secondary" id="seq-load-more-btn" style="padding:6px 20px;font-size:12px;">
                Load more (${(totalLines - initialLineCount).toLocaleString()} lines remaining)
              </button>
              <p style="margin-top:8px;color:var(--text-muted);font-size:11px;">
                Showing ${(initialLineCount * LINE_WIDTH).toLocaleString()} / ${len.toLocaleString()} ${type === 'protein' ? 'aa' : 'bp'}
              </p>
            </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function buildMiniMap(seq, len) {
  const type = seq.type;
  const isProtein = type === 'protein';

  let tracksHtml = '';
  if (seq.features && seq.features.length > 0) {
    const featureColors = { 'gene': 'var(--feat-gene)', 'CDS': 'var(--feat-cds)', 'promoter': 'var(--feat-promoter)', 'misc_feature': 'var(--feat-misc)', 'rep_origin': 'var(--feat-rep-origin)', 'terminator': 'var(--feat-terminator)' };

    tracksHtml = seq.features.map(feat => {
      const color = feat.color || featureColors[feat.type] || 'var(--text-muted)';
      const leftPct = (feat.start / len * 100).toFixed(2);
      let widthPct = (Math.max(feat.end - feat.start, 1) / len * 100).toFixed(2);
      if (parseFloat(widthPct) < 0.5) widthPct = '0.5'; // ensure visibility

      return `<div style="position:absolute;top:0;height:100%;left:${leftPct}%;width:${widthPct}%;background:${color};opacity:0.8;border-radius:2px;" title="${feat.type}: ${feat.start}..${feat.end}"></div>`;
    }).join('');
  }

  // A simplified GC block gradient for nucleotides
  let bgStyle = 'background:var(--bg-tertiary);';
  if (!isProtein && len > 1000) {
    // Build a CSS gradient for GC content chunks (approximate)
    const chunks = 10;
    const chunkSize = Math.floor(len / chunks);
    let gradStops = [];
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = (i === chunks - 1) ? len : (i + 1) * chunkSize;
      const gc = gcContent(seq.sequence.substring(start, end));
      // map gc 30-70 to an opacity or color lightness
      const lightness = Math.min(100, Math.max(10, Math.floor((gc / 100) * 50) + 10)); // 10% to 60%
      const color = `hsl(250, 40%, ${lightness}%)`;
      gradStops.push(`${color} ${(i / chunks * 100).toFixed(1)}%`);
    }
    bgStyle = `background: linear-gradient(to right, ${gradStops.join(', ')});`;
  }

  return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);display:flex;justify-content:space-between;">
            <span>Sequence Mini-Map</span>
            <span style="font-weight:normal;color:var(--text-muted);font-size:11px;">1 .. ${len.toLocaleString()}</span>
        </h3>
        <div style="position:relative;width:100%;height:24px;border-radius:4px;overflow:hidden;border:1px solid var(--border-muted);${bgStyle}">
            <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.2);"></div>
            ${tracksHtml}
        </div>
      </div>
    `;
}

function buildSequenceChunk(seqStr, type, startLine, lineCount) {
  const len = seqStr.length;
  let html = '';

  for (let line = startLine; line < startLine + lineCount; line++) {
    const i = line * LINE_WIDTH;
    if (i >= len) break;
    const lineEnd = Math.min(i + LINE_WIDTH, len);

    // Render ruler row for every 10 characters
    let rulerHtml = '<div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;display:flex;height:14px;">';
    rulerHtml += `<div style="width:60px;flex-shrink:0;"></div>`; // padding for line number

    for (let j = i; j < lineEnd; j += 10) {
      const tickBlockEnd = Math.min(j + 10, lineEnd);
      const charsInBlock = tickBlockEnd - j;
      // The number aligns with the start of the block, with a tick
      rulerHtml += `<div style="width:calc(${charsInBlock}ch + ${charsInBlock < 10 ? 0 : 1}ch); display:inline-block; position:relative;">`;
      rulerHtml += `<span style="position:absolute;left:0;top:0;">${j + 1}</span>`;
      if (j + 10 <= lineEnd) {
        // tick at the 10th position (end of block)
        rulerHtml += `<span style="position:absolute;right:0;top:0;">|</span>`;
      }
      rulerHtml += `</div>`;
    }
    rulerHtml += '</div>';

    html += rulerHtml;

    // Render sequence row
    html += `<div style="display:flex;margin-bottom:12px;align-items:center;">`;
    html += `<div style="width:60px;flex-shrink:0;color:var(--text-secondary);font-family:var(--font-mono);">${i + 1}</div>`;
    html += `<div style="flex:1;font-family:var(--font-mono);white-space:pre-wrap;">`;

    let currentClass = '';
    let buffer = '';

    for (let j = i; j < lineEnd; j++) {
      const char = seqStr[j];
      const cls = type === 'protein' ? getAminoAcidClass(char) : getNucleotideClass(char);

      const needsSpace = (j - i + 1) % 10 === 0 && j < lineEnd - 1;

      if (cls !== currentClass) {
        if (buffer) html += `<span class="${currentClass}">${buffer}</span>`;
        currentClass = cls;
        buffer = char;
      } else {
        buffer += char;
      }

      if (needsSpace) {
        if (buffer) html += `<span class="${currentClass}">${buffer}</span>`;
        html += ' ';
        buffer = '';
        currentClass = '';
      }
    }
    if (buffer) html += `<span class="${currentClass}">${buffer}</span>`;

    html += `</div></div>`;
  }
  return html;
}

export function bindSequenceViewerEvents(seq) {
  const loadMoreBtn = document.getElementById('seq-load-more-btn');
  if (!loadMoreBtn || !seq) return;

  loadMoreBtn.addEventListener('click', () => {
    const display = document.getElementById('seq-display');
    const loadMoreContainer = document.getElementById('seq-load-more');
    if (!display) return;

    const loadedLines = parseInt(display.dataset.loadedLines || '0');
    const totalLines = parseInt(display.dataset.totalLines || '0');
    const newChunkLines = Math.min(LINES_PER_CHUNK, totalLines - loadedLines);

    if (newChunkLines <= 0) {
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }

    const chunkHtml = buildSequenceChunk(seq.sequence, seq.type, loadedLines, newChunkLines);
    display.insertAdjacentHTML('beforeend', chunkHtml);

    const newLoaded = loadedLines + newChunkLines;
    display.dataset.loadedLines = newLoaded.toString();

    const remaining = totalLines - newLoaded;
    if (remaining <= 0) {
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    } else {
      loadMoreBtn.textContent = `Load more (${remaining.toLocaleString()} lines remaining)`;
      const info = loadMoreContainer?.querySelector('p');
      if (info) {
        info.textContent = `Showing ${(newLoaded * LINE_WIDTH).toLocaleString()} / ${seq.sequence.length.toLocaleString()} ${seq.type === 'protein' ? 'aa' : 'bp'}`;
      }
    }
  });
}

function buildAnnotations(features, len) {
  const featureColors = {
    'gene': 'var(--feat-gene)', 'CDS': 'var(--feat-cds)', 'promoter': 'var(--feat-promoter)',
    'misc_feature': 'var(--feat-misc)', 'rep_origin': 'var(--feat-rep-origin)', 'terminator': 'var(--feat-terminator)'
  };

  const visibleFeatures = features.slice(0, 50);
  let tracks = '';

  for (const feat of visibleFeatures) {
    const color = feat.color || featureColors[feat.type] || 'var(--text-muted)';
    const leftPct = (feat.start / len * 100).toFixed(2);
    const widthPct = (Math.max(feat.end - feat.start, 1) / len * 100).toFixed(2);
    const label = feat.name || feat.qualifiers?.gene || feat.qualifiers?.product || feat.type;

    tracks += `
        <div style="position:relative;height:24px;background:var(--bg-tertiary);border-radius:4px;margin-bottom:6px;overflow:hidden;border:1px solid var(--border-muted);">
            <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;background:${color};opacity:0.8;display:flex;align-items:center;padding:0 8px;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.1);" title="${escapeHtml(label)}: ${feat.start + 1}..${feat.end} (${feat.type})">
                <span style="font-size:10px;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)} <span style="font-weight:normal;opacity:0.8;margin-left:4px;">${feat.type}</span></span>
            </div>
        </div>`;
  }

  const moreNote = features.length > 50 ? `<p style="color:var(--text-muted);font-size:11px;margin-top:8px;">Showing 50 of ${features.length} annotations</p>` : '';

  return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Annotations Tracks</h3>
        ${tracks}
        ${moreNote}
      </div>
    `;
}

function buildCompositionBar(comp) {
  const total = comp.A + comp.T + comp.C + comp.G + (comp.U || 0);
  if (total <= 0) return '';

  const segments = [
    { label: 'A', count: comp.A, color: 'var(--nt-a)' },
    { label: 'T', count: comp.T, color: 'var(--nt-t)' },
    { label: 'C', count: comp.C, color: 'var(--nt-c)' },
    { label: 'G', count: comp.G, color: 'var(--nt-g)' },
  ];
  if (comp.U > 0) segments.push({ label: 'U', count: comp.U, color: 'var(--nt-u)' });

  return `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Composition Distribution</h3>
          <div class="composition-bar" style="height:12px;border-radius:6px;margin-bottom:8px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.2);">
            ${segments.filter(s => s.count > 0).map(s =>
    `<div class="composition-segment" style="flex-grow:${s.count};background:${s.color};" title="${s.label}: ${s.count} (${(s.count / total * 100).toFixed(1)}%)"></div>`
  ).join('')}
          </div>
          <div class="composition-legend" style="display:flex;gap:16px;font-size:11px;">
            ${segments.filter(s => s.count > 0).map(s =>
    `<span class="legend-item" style="display:flex;align-items:center;gap:4px;"><span class="legend-dot" style="width:8px;height:8px;border-radius:50%;background:${s.color};"></span>${s.label}: ${(s.count / total * 100).toFixed(1)}%</span>`
  ).join('')}
          </div>
        </div>
      `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
