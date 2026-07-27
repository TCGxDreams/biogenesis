// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Primer Design Component v2
// ============================================

import { getNucleotideClass } from '../utils/bioUtils.js';
import { designPrimers } from '../core/primer.js';
import { BioError } from '../core/errors.js';

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

/**
 * Render the primer design results. All computation lives in
 * `src/core/primer.js`; this function only draws the returned pairs.
 *
 * @param {string} seqStr Template sequence.
 * @param {Object} settings See `designPrimers`.
 * @returns {string} HTML
 */
export function renderPrimerResults(seqStr, settings) {
  let primers;
  try {
    primers = designPrimers(seqStr, settings).pairs;
  } catch (e) {
    if (e instanceof BioError) {
      return `<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-red);">${escapeHtml(e.message)}</p></div>`;
    }
    throw e;
  }

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

/**
 * Kept for the CSV export path in main.js. Delegates to `src/core/primer.js`.
 *
 * @param {string} seq
 * @param {Object} cfg
 * @returns {import('../core/primer.js').PrimerPair[]}
 */
export function designPrimerPairs(seq, cfg) {
  return designPrimers(seq, cfg).pairs;
}

function colorCodeDNA(seq) {
  return seq.split('').map(c => `<span class="${getNucleotideClass(c)}">${c}</span>`).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
