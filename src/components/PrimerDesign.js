// ============================================
// BioGenesis — Primer Design Component v2
// ============================================

import { gcContent, calculateTmNN, complement, reverseComplement, getNucleotideClass } from '../utils/bioUtils.js';

export function renderPrimerDesign(seq) {
  if (seq.type === 'protein') {
    return `
      <div class="panel active">
        <div class="panel-header"><h2>Primer Design</h2><p>Requires a DNA/RNA sequence</p></div>
        <div class="panel-body"><div class="empty-state"><span class="empty-state-icon">🧬</span><p class="empty-state-text">Select a DNA sequence</p></div></div>
      </div>`;
  }

  const seqStr = seq.sequence;
  const len = seqStr.length;

  // We will render an empty state first, then wire the "Run Design" button in main.js
  // to call the design algorithm with the form values.

  return `
    <div class="panel active" id="panel-primer">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>Primer Design (PCR)</h2>
          <p>${escapeHtml(seq.name)} · ${len.toLocaleString()} bp</p>
        </div>
        <button class="btn btn-secondary" id="primer-export-btn" style="font-size:11px;padding:6px 14px;display:none;">↓ Export List</button>
      </div>

      <!-- Settings Form -->
      <div class="panel-controls" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;padding:16px 20px;background:var(--bg-elevated);border-bottom:1px solid var(--border-muted);">
        <div class="form-group" style="margin:0;min-width:200px;flex:1;">
          <label class="form-label">Target Region <span style="opacity:0.6;">(Optional)</span></label>
          <div style="display:flex;gap:8px;align-items:center;">
             <input type="number" id="primer-target-start" class="form-select" placeholder="Start" style="flex:1;">
             <span style="color:var(--text-muted);font-size:11px;">to</span>
             <input type="number" id="primer-target-end" class="form-select" placeholder="End" style="flex:1;">
          </div>
        </div>
        
        <div class="form-group" style="margin:0;min-width:180px;flex:1;">
          <label class="form-label">Optimized Tm (°C)</label>
          <div style="display:flex;gap:8px;align-items:center;">
             <input type="number" id="primer-tm-min" class="form-select" value="55" min="40" max="80" style="flex:1;">
             <span style="color:var(--text-muted);font-size:11px;">–</span>
             <input type="number" id="primer-tm-max" class="form-select" value="65" min="40" max="80" style="flex:1;">
          </div>
        </div>

        <div class="form-group" style="margin:0;min-width:180px;flex:1;">
          <label class="form-label">Primer Length (bp)</label>
          <div style="display:flex;gap:8px;align-items:center;">
             <input type="number" id="primer-len-min" class="form-select" value="18" min="15" max="35" style="flex:1;">
             <span style="color:var(--text-muted);font-size:11px;">–</span>
             <input type="number" id="primer-len-max" class="form-select" value="24" min="15" max="35" style="flex:1;">
          </div>
        </div>

        <button class="btn btn-primary" id="run-primer-btn" style="height:36px;padding:0 24px;white-space:nowrap;flex-shrink:0;">⚙ Design Primers</button>
      </div>

      <!-- Results Area -->
      <div class="panel-body" id="primer-results-area" style="padding-top:10px;">
        <div class="empty-state">
          <p class="empty-state-text">Configure settings and click "Design Primers"</p>
        </div>
      </div>
    </div>
  `;
}

export function renderPrimerResults(seqStr, settings) {
  const primers = designPrimerPairs(seqStr, settings);

  if (primers.length === 0) {
    return `<div class="empty-state">
          <p class="empty-state-text" style="color:var(--accent-red);">No primer pairs met the strict thermodynamic criteria.</p>
          <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Try relaxing the Tm or Length constraints.</p>
        </div>`;
  }

  const len = seqStr.length;
  let html = '';

  // Render pairs
  primers.forEach((pair, idx) => {
    const fwd = pair.fwd;
    const rev = pair.rev;
    const pSize = rev.end - fwd.start;

    html += `
      <div style="background:var(--bg-elevated);border:1px solid var(--border-muted);border-radius:var(--radius-md);margin-bottom:20px;overflow:hidden;">
        
        <!-- Header -->
        <div style="background:var(--bg-secondary);padding:10px 16px;border-bottom:1px solid var(--border-muted);display:flex;justify-content:space-between;align-items:center;">
          <h3 style="font-size:13px;font-weight:600;color:var(--text-primary);">Primer Pair ${idx + 1}</h3>
          <span style="font-size:11px;color:var(--text-muted);font-weight:600;">Product Size: <span style="color:var(--accent-cyan);">${pSize} bp</span></span>
        </div>

        <!-- Binding Map -->
        <div style="padding:16px 16px 8px;">
          ${renderBindingMap(fwd, rev, len)}
        </div>

        <!-- Details Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border-muted);">
          
          <!-- FWD -->
          <div style="background:var(--bg-elevated);padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:11px;font-weight:600;color:var(--accent-green);">FORWARD</span>
              <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${fwd.start + 1} → ${fwd.end}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:13px;letter-spacing:1px;margin-bottom:12px;word-break:break-all;">
              5' - ${colorCodeDNA(fwd.sequence)} - 3'
            </div>
            <div style="display:flex;gap:12px;font-size:10px;">
              <div class="primer-stat"><span class="stat-label">Length</span><span class="stat-value">${fwd.sequence.length}</span></div>
              <div class="primer-stat"><span class="stat-label">Tm (NN)</span><span class="stat-value" style="color:var(--accent-cyan);">${fwd.tm.toFixed(1)}°C</span></div>
              <div class="primer-stat"><span class="stat-label">GC%</span><span class="stat-value">${fwd.gc.toFixed(1)}%</span></div>
              <div class="primer-stat"><span class="stat-label">Hairpin</span>${fwd.hairpin ? '<span style="color:var(--accent-red);font-weight:600;">Yes</span>' : '<span style="color:var(--text-muted);">No</span>'}</div>
            </div>
          </div>

          <!-- REV -->
          <div style="background:var(--bg-elevated);padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:11px;font-weight:600;color:var(--accent-red);">REVERSE</span>
              <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">${rev.end} ← ${rev.start + 1}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:13px;letter-spacing:1px;margin-bottom:12px;word-break:break-all;">
              5' - ${colorCodeDNA(rev.sequence)} - 3'
            </div>
            <div style="display:flex;gap:12px;font-size:10px;">
              <div class="primer-stat"><span class="stat-label">Length</span><span class="stat-value">${rev.sequence.length}</span></div>
              <div class="primer-stat"><span class="stat-label">Tm (NN)</span><span class="stat-value" style="color:var(--accent-cyan);">${rev.tm.toFixed(1)}°C</span></div>
              <div class="primer-stat"><span class="stat-label">GC%</span><span class="stat-value">${rev.gc.toFixed(1)}%</span></div>
              <div class="primer-stat"><span class="stat-label">Hairpin</span>${rev.hairpin ? '<span style="color:var(--accent-red);font-weight:600;">Yes</span>' : '<span style="color:var(--text-muted);">No</span>'}</div>
            </div>
          </div>

        </div>

        <!-- Pair Stats -->
        <div style="background:var(--bg-active);padding:8px 16px;font-size:11px;display:flex;gap:20px;border-top:1px solid var(--border-muted);">
          <span><strong>ΔTm:</strong> ${Math.abs(fwd.tm - rev.tm).toFixed(1)}°C <span style="color:var(--text-muted);">(Ideal ≤ 2°C)</span></span>
          <span><strong>Heterodimer:</strong> ${pair.heterodimer ? '<span style="color:var(--accent-red);">Risk</span>' : '<span style="color:var(--accent-green);">Safe</span>'}</span>
        </div>

      </div>
    `;
  });

  return html;
}

function renderBindingMap(fwd, rev, len) {
  const fwdLeft = (fwd.start / len * 100).toFixed(2);
  const fwdWidth = ((fwd.end - fwd.start) / len * 100).toFixed(2);
  const revLeft = (rev.start / len * 100).toFixed(2);
  const revWidth = ((rev.end - rev.start) / len * 100).toFixed(2);

  // handle small width cases so they are visible
  const fwVisible = Math.max(parseFloat(fwdWidth), 1);
  const rvVisible = Math.max(parseFloat(revWidth), 1);

  const ampLeft = fwdLeft;
  const ampWidth = Math.max((parseFloat(revLeft) + parseFloat(revWidth) - parseFloat(fwdLeft)).toFixed(2), 2);

  return `
      <div style="position:relative;height:50px;">
        <!-- Template Line -->
        <div style="position:absolute;top:24px;left:0;right:0;height:2px;background:var(--text-muted);opacity:0.5;"></div>
        
        <!-- Primer Marks -->
        <div style="position:absolute;top:10px;left:${fwdLeft}%;width:${fwVisible}%;height:6px;background:var(--accent-green);border-radius:2px;" title="Forward"></div>
        <div style="position:absolute;top:34px;left:${revLeft}%;width:${rvVisible}%;height:6px;background:var(--accent-red);border-radius:2px;" title="Reverse"></div>
        
        <!-- Amplicon highlight -->
        <div style="position:absolute;top:20px;left:${ampLeft}%;width:${ampWidth}%;height:10px;background:rgba(6,182,212,0.15);border-radius:2px;border:1px solid rgba(6,182,212,0.4);"></div>
        
        <!-- Labels -->
        <span style="position:absolute;top:-4px;left:${fwdLeft}%;font-size:9px;color:var(--accent-green);font-family:var(--font-mono);">F</span>
        <span style="position:absolute;top:44px;left:${revLeft}%;font-size:9px;color:var(--accent-red);font-family:var(--font-mono);">R</span>
      </div>
    `;
}

export function designPrimerPairs(seq, cfg) {
  const upper = seq.toUpperCase();
  const len = upper.length;

  const startObj = cfg.targetStart ? Math.max(0, cfg.targetStart - 1 - parseInt(cfg.targetStart > 0 ? 50 : 0)) : 0;
  const endObj = cfg.targetEnd ? Math.min(len, cfg.targetEnd + parseInt(cfg.targetEnd < len ? 50 : 0)) : len;

  const fwds = [];
  const revs = [];

  // Find all acceptable forward primers in the 5' flank
  for (let pos = startObj; pos < Math.min(len, startObj + 300); pos++) {
    for (let pLen = cfg.minLen; pLen <= cfg.maxLen; pLen++) {
      if (pos + pLen > len) continue;
      const pSeq = upper.substring(pos, pos + pLen);
      const tm = calculateTmNN(pSeq);
      if (tm >= cfg.minTm && tm <= cfg.maxTm) {
        const gc = gcContent(pSeq);
        if (gc >= 40 && gc <= 60 && !checkHairpin(pSeq)) {
          fwds.push({ sequence: pSeq, start: pos, end: pos + pLen, tm, gc, direction: 'fwd', hairpin: false });
          break; // Just one decent primer per start position
        }
      }
    }
  }

  // Find all acceptable rev primers in the 3' flank
  const revStartSearch = cfg.targetEnd ? Math.max(0, cfg.targetEnd - 50) : Math.max(0, len - 300);
  for (let pos = endObj; pos > revStartSearch; pos--) {
    for (let pLen = cfg.minLen; pLen <= cfg.maxLen; pLen++) {
      if (pos - pLen < 0) continue;
      const pSeqRaw = upper.substring(pos - pLen, pos);
      const pSeq = reverseComplement(pSeqRaw);
      const tm = calculateTmNN(pSeq);
      if (tm >= cfg.minTm && tm <= cfg.maxTm) {
        const gc = gcContent(pSeq);
        if (gc >= 40 && gc <= 60 && !checkHairpin(pSeq)) {
          revs.push({ sequence: pSeq, start: pos - pLen, end: pos, tm, gc, direction: 'rev', hairpin: false });
          break;
        }
      }
    }
  }

  // Default fallbacks if empty (force some primers)
  if (fwds.length === 0 && len >= cfg.minLen) {
    const fallSeq = upper.substring(0, cfg.minLen);
    fwds.push({ sequence: fallSeq, start: 0, end: cfg.minLen, tm: calculateTmNN(fallSeq), gc: gcContent(fallSeq), hairpin: checkHairpin(fallSeq) });
  }
  if (revs.length === 0 && len >= cfg.minLen) {
    const pSeq = reverseComplement(upper.substring(len - cfg.minLen, len));
    revs.push({ sequence: pSeq, start: len - cfg.minLen, end: len, tm: calculateTmNN(pSeq), gc: gcContent(pSeq), hairpin: checkHairpin(pSeq) });
  }

  const pairs = [];
  // Match them up (up to 5 best pairs logic)
  for (const f of fwds) {
    for (const r of revs) {
      if (r.start <= f.end + 10) continue; // Minimum amplicon size constraint
      const tmDiff = Math.abs(f.tm - r.tm);
      if (tmDiff <= 5) {
        pairs.push({
          fwd: f, rev: r,
          score: tmDiff + Math.abs(50 - f.gc) * 0.1 + Math.abs(50 - r.gc) * 0.1, // Lower is better
          heterodimer: checkHairpin(f.sequence) || checkHairpin(r.sequence) // simplified dimer check
        });
      }
    }
  }

  // Sort by score (best pairs first)
  pairs.sort((a, b) => a.score - b.score);

  // Return top 5
  return pairs.slice(0, 5);
}

function checkHairpin(seq) {
  const len = seq.length;
  if (len < 8) return false;
  for (let i = 0; i < len - 6; i++) {
    for (let j = i + 4; j < len - 2; j++) {
      let matches = 0;
      for (let k = 0; k < 3; k++) if (isComplement(seq[i + k], seq[j + 2 - k])) matches++;
      if (matches >= 3) return true;
    }
  }
  return false;
}

function isComplement(a, b) {
  const pairs = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C' };
  return pairs[a.toUpperCase()] === b.toUpperCase();
}

function colorCodeDNA(seq) {
  return seq.split('').map(c => `<span class="${getNucleotideClass(c)}">${c}</span>`).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
