// ============================================
// BioGenesis — Sequence Alignment Component v2
// ============================================

import { needlemanWunsch, smithWaterman, multipleAlignment, generateConsensus } from '../utils/alignment.js';
import { getNucleotideClass, getAminoAcidClass } from '../utils/bioUtils.js';

export function renderAlignment(sequences) {
  if (sequences.length < 2) {
    return `
      <div class="panel active">
        <div class="panel-header"><h2>Sequence Alignment</h2><p>Pairwise & Multiple Sequence Alignment</p></div>
        <div class="panel-body"><div class="empty-state"><span class="empty-state-icon">🧬</span><p class="empty-state-text">Please import at least 2 sequences to align.</p></div></div>
      </div>`;
  }

  const checkboxHtml = sequences.map((s, i) => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-tertiary);border-radius:4px;border:1px solid var(--border-muted);cursor:pointer;">
        <input type="checkbox" class="align-seq-check form-checkbox" value="${i}" ${i < 3 ? 'checked' : ''}>
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">
          <span style="font-weight:600;color:var(--text-primary);">${escapeHtml(s.name)}</span>
          <span style="color:var(--text-muted);">(${s.sequence.length} ${s.type === 'protein' ? 'aa' : 'bp'})</span>
        </div>
      </label>
    `).join('');

  return `
    <div class="panel active" id="panel-alignment">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>Sequence Alignment</h2>
          <p>Global (NW), Local (SW), and Multiple Sequence Alignment (MSA)</p>
        </div>
        <button class="btn btn-secondary" id="align-export-btn" style="font-size:11px;padding:6px 14px;display:none;">↓ Export FASTA</button>
      </div>

      <div class="panel-controls" style="display:flex;gap:20px;align-items:stretch;">
        
        <!-- Sequence Selection -->
        <div style="flex:1;">
          <label class="form-label" style="display:flex;justify-content:space-between;">
            Select Sequences
            <span style="font-size:10px;color:var(--text-muted);font-weight:normal;" id="align-sel-count">3 selected</span>
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:120px;overflow-y:auto;padding-right:5px;border:1px solid var(--border-muted);border-radius:var(--radius-md);padding:8px;background:var(--bg-elevated);">
            ${checkboxHtml}
          </div>
        </div>

        <!-- Algorithm & Settings -->
        <div style="width:280px;display:flex;flex-direction:column;gap:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Algorithm</label>
            <select class="form-select" id="align-algo">
               <option value="msa" selected>Progressive MSA (Global)</option>
               <option value="nw">Needleman-Wunsch (Pairwise Global)</option>
               <option value="sw">Smith-Waterman (Pairwise Local)</option>
            </select>
          </div>
          <button class="btn btn-primary" id="run-alignment-btn" style="margin-top:auto;width:100%;padding:8px;">▶ Run Alignment</button>
        </div>
      </div>

      <!-- Results Area -->
      <div class="panel-body" id="alignment-result" style="padding-top:10px;">
        <div class="empty-state">
          <p class="empty-state-text">Select sequences and click "Run Alignment"</p>
          <p style="color:var(--text-muted);font-size:11px;margin-top:8px;">Note: MSA is computationally intensive for large sequences.</p>
        </div>
      </div>
    </div>
  `;
}

export function computeAndRenderAlignment(selectedSeqs, algo = 'msa') {
  if (selectedSeqs.length < 2) {
    return `<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-orange);">Please select at least 2 sequences.</p></div>`;
  }

  if ((algo === 'nw' || algo === 'sw') && selectedSeqs.length > 2) {
    return `<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-orange);">Needleman-Wunsch and Smith-Waterman only support 2 sequences.</p><p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Change algorithm to "Progressive MSA" or select exactly 2 sequences.</p></div>`;
  }

  // Determine type (if any is protein, treat as protein alignment)
  const isProtein = selectedSeqs.some(s => s.type === 'protein');

  // Limit length to avoid crashing the browser tab
  const MAX_LEN = 3000;
  const seqsObj = selectedSeqs.map(s => ({
    name: s.name,
    seq: s.sequence.substring(0, Math.min(s.sequence.length, MAX_LEN))
  }));

  let alignedStrings = [];
  let statsHtml = '';

  if (algo === 'msa') {
    // MSA
    const sequencesOnly = seqsObj.map(s => s.seq);
    alignedStrings = multipleAlignment(sequencesOnly, isProtein);

    statsHtml = `
          <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card"><div class="stat-title">Sequences</div><div class="stat-value">${alignedStrings.length}</div></div>
            <div class="stat-card"><div class="stat-title">Alignment Length</div><div class="stat-value">${alignedStrings[0].length}<span class="stat-unit">${isProtein ? 'aa' : 'bp'}</span></div></div>
            <div class="stat-card"><div class="stat-title">Algorithm</div><div class="stat-value" style="font-size:15px;">Progressive MSA</div></div>
          </div>
        `;
  } else {
    // Pairwise
    let res;
    if (algo === 'nw') res = needlemanWunsch(seqsObj[0].seq, seqsObj[1].seq, isProtein);
    else res = smithWaterman(seqsObj[0].seq, seqsObj[1].seq, isProtein);

    alignedStrings = [res.aligned1, res.aligned2];
    statsHtml = `
          <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card"><div class="stat-title">Identity</div><div class="stat-value">${res.identity.toFixed(1)}<span class="stat-unit">%</span></div></div>
            <div class="stat-card"><div class="stat-title">Gaps</div><div class="stat-value">${res.gaps}</div></div>
            <div class="stat-card"><div class="stat-title">Score</div><div class="stat-value">${res.score}</div></div>
            <div class="stat-card"><div class="stat-title">Length</div><div class="stat-value">${res.aligned1.length}<span class="stat-unit">${isProtein ? 'aa' : 'bp'}</span></div></div>
          </div>
        `;
  }

  // Build the visualization blocks
  const consensus = generateConsensus(alignedStrings);
  const blockSize = 80; // characters per row
  let blocksHtml = '';

  // Pre-calculate identity array for the conservation bar
  const conservation = [];
  for (let i = 0; i < consensus.length; i++) {
    let matchCount = 0;
    let validCount = 0;
    const consChar = consensus[i];
    if (consChar === '-') {
      conservation.push(0);
      continue;
    }
    for (const str of alignedStrings) {
      if (str[i] !== '-') {
        validCount++;
        if (str[i].toUpperCase() === consChar.toUpperCase()) matchCount++;
      }
    }
    conservation.push(validCount > 0 ? matchCount / alignedStrings.length : 0);
  }

  for (let i = 0; i < consensus.length; i += blockSize) {
    const end = Math.min(i + blockSize, consensus.length);

    let rowsHtml = '';

    // 1. Plot the consensus explicitly
    const consBlock = consensus.substring(i, end);
    rowsHtml += `
          <div class="alignment-row" style="background:var(--bg-tertiary);border-bottom:1px solid var(--border-muted);padding-bottom:4px;margin-bottom:6px;">
            <div class="alignment-label" style="font-weight:700;color:var(--text-primary);">Consensus</div>
            <div class="alignment-seq" style="font-weight:700;">${colorCode(consBlock, isProtein, null)}</div>
          </div>
        `;

    // 2. Plot the sequences
    for (let seqIdx = 0; seqIdx < alignedStrings.length; seqIdx++) {
      const block = alignedStrings[seqIdx].substring(i, end);
      const name = seqsObj[seqIdx].name;
      rowsHtml += `
              <div class="alignment-row">
                <div class="alignment-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
                <div class="alignment-seq">${colorCode(block, isProtein, consBlock)}</div>
              </div>
            `;
    }

    // 3. Plot the conservation bar graph
    let barGraphHtml = '';
    for (let j = i; j < end; j++) {
      const h = (conservation[j] * 100).toFixed(0);
      let color = 'var(--text-muted)';
      if (conservation[j] === 1) color = 'var(--accent-green)';
      else if (conservation[j] >= 0.5) color = 'var(--accent-orange)';

      barGraphHtml += `<div style="display:inline-block;width:8.4px;height:14px;display:inline-flex;align-items:flex-end;">
              <div style="width:100%;height:${h}%;background:${color};border-radius:1px;"></div>
            </div>`;
    }

    rowsHtml += `
          <div class="alignment-row" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border-muted);">
            <div class="alignment-label" style="font-size:9px;color:var(--text-muted);text-transform:uppercase;">Conservation</div>
            <div class="alignment-seq" style="display:flex;padding-left:0;">${barGraphHtml}</div>
          </div>
        `;

    blocksHtml += `
          <div class="alignment-container" style="background:var(--bg-elevated);border:1px solid var(--border-muted);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;overflow-x:auto;">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono);">Range: ${i + 1} - ${end}</div>
            ${rowsHtml}
          </div>
        `;
  }

  return `
      ${statsHtml}
      <div style="margin-top:16px;">
        ${blocksHtml}
      </div>
    `;
}

// Clustal-like coloring with dotting identical characters against consensus
function colorCode(seq, isProtein, consensusBlock) {
  let html = '';
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (c === '-') {
      html += `<span class="nt-gap" style="opacity:0.4;">-</span>`;
      continue;
    }

    // Dot identical chars against consensus (if provided and matches)
    const isMatch = consensusBlock && c.toUpperCase() === consensusBlock[i]?.toUpperCase();
    const displayChar = isMatch ? '.' : c;

    // Always maintain color but lower opacity on matches to highlight differences
    const cls = isProtein ? getAminoAcidClass(c) : getNucleotideClass(c);
    const opacity = isMatch ? '0.6' : '1.0';
    const fontWeight = isMatch ? 'normal' : '700';

    html += `<span class="${cls}" style="opacity:${opacity};font-weight:${fontWeight};">${displayChar}</span>`;
  }
  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
