// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — 6-Frame Translation Component
// Advanced with ORF Highlighting and FASTA Export
// ============================================

import { getAminoAcidClass, getNucleotideClass } from '../utils/bioUtils.js';
import { translateSixFrames } from '../core/translation.js';

export function renderSixFrameTranslation(seq) {
  if (seq.type === 'protein') {
    return `
      <div class="panel active">
        <div class="panel-header"><h2>6-Frame Translation</h2><p>Requires a DNA or RNA sequence</p></div>
        <div class="panel-body"><div class="empty-state"><p class="empty-state-text">Please select a DNA/RNA sequence</p></div></div>
      </div>`;
  }

  const seqStr = seq.sequence.toUpperCase();
  const { frames, orfs: allOrfs, dna } = translateSixFrames(seqStr);
  const displayLen = dna.length;

  // Render DNA sequence line
  const dnaLine = dna.split('').map(c => `<span class="${getNucleotideClass(c)}">${c}</span>`).join('');

  // Render each frame
  const frameBlocks = frames.map(fr => {
    const spacedAa = fr.protein.split('').map((aa, i) => {
      const cls = aa === '*' ? 'stop-codon' : aa === 'M' ? 'met-codon' : getAminoAcidClass(aa);

      // Check if inside any ORF for highlighting
      const inOrf = fr.orfs.some(o => i >= o.start && i <= o.end);
      const style = inOrf ? `background:rgba(0, 212, 232, 0.15);border-bottom:2px solid var(--accent-cyan);` : ``;

      return `<span class="${cls}" style="${style}"> ${aa} </span>`;
    }).join('');

    return `
      <div class="frame-row">
        <div class="frame-label" style="min-width:100px;font-weight:600;color:var(--text-secondary);">${fr.direction === 'forward' ? 'Forward' : 'Reverse'} ${fr.label}</div>
        <div class="frame-sequence" style="line-height:1.6;">${spacedAa}</div>
      </div>
    `;
  });

  let orfSummary = '';
  if (allOrfs.length > 0) {
    orfSummary = `
      <div style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">ORFs Found Across All Frames (min 10 aa)</h3>
        <table class="blast-results-table">
          <thead><tr><th>Frame</th><th>Start (aa)</th><th>End (aa)</th><th>Length (aa)</th><th>Sequence (first 30)</th></tr></thead>
          <tbody>
            ${allOrfs.slice(0, 15).map(orf => `
              <tr>
                <td style="font-weight:600;color:var(--accent-cyan);">${orf.frame}</td>
                <td>${orf.start + 1}</td>
                <td>${orf.end + 1}</td>
                <td>${orf.length} <span style="font-size:10px;color:var(--text-muted);">aa</span></td>
                <td style="font-family:var(--font-mono);font-size:11px;">${orf.protein.substring(0, 30)}${orf.protein.length > 30 ? '...' : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${allOrfs.length > 15 ? `<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Showing top 15 of ${allOrfs.length} ORFs.</p>` : ''}
      </div>
    `;
  }

  return `
    <div class="panel active">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>6-Frame Translation</h2>
          <p>${escapeHtml(seq.name)} — showing ${displayLen > seqStr.length ? '' : 'first '}${displayLen} bp</p>
        </div>
        <div>
          <button class="btn btn-secondary" id="export-orfs-btn" ${allOrfs.length === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export All ORFs (FASTA)
          </button>
        </div>
      </div>
      <div class="panel-body">
        <div class="stats-grid" style="margin-bottom:24px;">
          <div class="stat-card"><div class="stat-title">Sequence Displayed</div><div class="stat-value">${displayLen.toLocaleString()}<span class="stat-unit">bp</span></div></div>
          <div class="stat-card"><div class="stat-title">Total ORFs Found</div><div class="stat-value">${allOrfs.length}</div></div>
          <div class="stat-card"><div class="stat-title">Longest ORF</div><div class="stat-value">${allOrfs.length > 0 ? allOrfs[0].length : 0}<span class="stat-unit">aa</span></div></div>
        </div>
        
        <div style="background:var(--bg-elevated);border:1px solid var(--border-muted);border-radius:var(--radius-md);padding:16px;">
            <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Forward Strand DNA</h3>
            <div class="frame-sequence" style="margin-bottom:16px;line-height:1.6;">${dnaLine}</div>
            
            <div style="margin:16px 0;height:1px;background:var(--border-muted);"></div>
            
            <div class="frame-translation-container">
              ${frameBlocks.slice(0, 3).join('<div style="margin:8px 0;height:1px;background:var(--border-muted);opacity:0.5;"></div>')}
            </div>
            
            <div style="margin:16px 0;height:2px;background:var(--border-default);"></div>
            
            <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Reverse Complement Frames</h3>
            <div class="frame-translation-container">
              ${frameBlocks.slice(3).join('<div style="margin:8px 0;height:1px;background:var(--border-muted);opacity:0.5;"></div>')}
            </div>
        </div>
        
        ${orfSummary}
        
        <div style="margin-top:24px;padding:12px 16px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <strong>Legend:</strong> 
          <span style="display:flex;align-items:center;gap:4px;"><span class="met-codon" style="padding:2px 4px;border-radius:2px;">M</span> Start (Met)</span>
          <span style="display:flex;align-items:center;gap:4px;"><span class="stop-codon" style="padding:2px 4px;border-radius:2px;">*</span> Stop</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background:rgba(0, 212, 232, 0.15);border-bottom:2px solid var(--accent-cyan);"></span> ORF Region Highlight</span>
        </div>
      </div>
    </div>
  `;
}

export function bindSixFrameEvents(seq) {
  const exportBtn = document.getElementById('export-orfs-btn');
  if (!exportBtn || !seq || seq.type === 'protein') return;

  // Export runs on the FULL sequence, not the display-truncated one.
  const { orfs: allOrfs } = translateSixFrames(seq.sequence, { maxLength: Infinity });

  exportBtn.addEventListener('click', () => {
    if (allOrfs.length === 0) return;

    let fasta = '';
    allOrfs.forEach((o, i) => {
      fasta += `>ORF_${i + 1}_${seq.name}_Frame${o.frame}_Len${o.length}\n`;
      // Wrap at 80 chars
      for (let j = 0; j < o.protein.length; j += 80) {
        fasta += o.protein.substring(j, j + 80) + '\n';
      }
    });

    const blob = new Blob([fasta], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seq.name}_ORFs.fasta`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
