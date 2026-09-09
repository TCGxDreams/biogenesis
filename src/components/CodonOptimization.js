// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Codon Optimization Component
// ============================================

import { getNucleotideClass } from '../utils/bioUtils.js';
import { CODON_USAGE, analyseCodonUsage, optimiseCodons } from '../core/codon.js';
import { BioError } from '../core/errors.js';

export function renderCodonOptimization(seq) {
    if (seq.type === 'protein') {
        return `
      <div class="panel active">
        <div class="panel-header"><h2><span data-i18n="Codon Optimization">Codon Optimization</span></h2><p>Requires a DNA sequence</p></div>
        <div class="panel-body"><div class="empty-state"><p class="empty-state-text">Please select a DNA sequence</p></div></div>
      </div>`;
    }

    const organisms = Object.entries(CODON_USAGE).map(([key, val]) =>
        `<option value="${key}">${val.name}</option>`
    ).join('');

    const seqStr = seq.sequence.toUpperCase();

    return `
    <div class="panel active">
      <div class="panel-header">
        <h2><span data-i18n="Codon Optimization">Codon Optimization</span></h2>
        <p>Optimize codon usage for expression in a target organism — ${escapeHtml(seq.name)}</p>
      </div>
      <div class="panel-controls">
        <div class="form-group">
          <label class="form-label">Target Organism</label>
          <select class="form-select" id="codon-organism">${organisms}</select>
        </div>
        <button class="btn btn-primary" id="run-codon-btn">Optimize</button>
      </div>
      <div class="panel-body" id="codon-result">
        ${renderCodonAnalysis(seqStr, 'ecoli')}
      </div>
    </div>
  `;
}

/**
 * Render the codon analysis result. All computation lives in
 * `src/core/codon.js`; this function only draws the returned report.
 *
 * @param {string} dnaSeq
 * @param {string} organismKey
 * @returns {string} HTML
 */
export function renderCodonAnalysis(dnaSeq, organismKey) {
    let report;
    let optimisation;
    try {
        report = analyseCodonUsage(dnaSeq, organismKey);
        optimisation = optimiseCodons(dnaSeq, organismKey);
    } catch (e) {
        if (e instanceof BioError && e.code === 'UNKNOWN_ORGANISM') return '<p>Unknown organism</p>';
        throw e;
    }

    const upper = dnaSeq.toUpperCase();
    const usage = report.organism;
    const totalCodons = report.totalCodons;
    const cai = report.cai;
    const optimizedSeq = optimisation.optimised;
    const optimizedCai = optimisation.cai;
    const changedCodons = optimisation.changedCodons;

    // Build codon usage comparison table
    let tableHtml = '';
    for (const group of report.usage) {
        tableHtml += group.codons.map(entry => {
            const orgFreq = entry.organismFreq;
            const maxFreq = entry.maxSynonymFreq;
            const isOptimal = entry.isOptimal;

            return `<div class="codon-cell${isOptimal ? ' style="border-left:2px solid var(--accent-green);"' : ''}">
        <span class="codon-triplet">${colorCodeDNA(entry.codon)}</span>
        <span class="codon-aa">${group.aa}</span>
        <div class="codon-freq-bar"><div class="codon-freq-fill" style="width:${Math.min(100, orgFreq / Math.max(maxFreq, 1) * 100)}%;${isOptimal ? 'background:var(--accent-green);' : ''}"></div></div>
        <span class="codon-freq">${orgFreq.toFixed(1)}</span>
      </div>`;
        }).join('');
    }

    return `
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-title">Current CAI</div>
        <div class="stat-value" style="color:${cai > 0.7 ? 'var(--accent-green)' : cai > 0.4 ? 'var(--accent-orange)' : 'var(--accent-red)'};">${cai.toFixed(3)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Optimized CAI</div>
        <div class="stat-value" style="color:var(--accent-green);">${optimizedCai.toFixed(3)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Changed Codons</div>
        <div class="stat-value">${changedCodons}<span class="stat-unit">/ ${totalCodons}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Target Organism</div>
        <div class="stat-value" style="font-size:14px;">${usage.name}</div>
      </div>
    </div>
    
    <div style="margin-bottom:20px;">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Optimized Sequence</h3>
      <div class="sequence-display" style="font-size:12px;max-height:200px;overflow:auto;">
        ${formatOptimizedSeq(upper, optimizedSeq)}
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">
        Red = changed codons | Same protein sequence is preserved
      </p>
    </div>
    
    <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Codon Usage Table — ${usage.name} (freq/1000)</h3>
    <div class="codon-table-grid">${tableHtml}</div>
  `;
}

function formatOptimizedSeq(original, optimized) {
    let html = '';
    const lineLen = 60;
    const maxLen = Math.max(original.length, optimized.length);
    for (let i = 0; i < maxLen; i += 3) {
        if (i > 0 && i % lineLen === 0) html += '\n';
        const orig = original.substring(i, i + 3);
        const opt = optimized.substring(i, i + 3);
        if (orig !== opt) {
            html += `<span style="color:var(--accent-red);font-weight:600;">${opt}</span>`;
        } else {
            html += colorCodeDNA(opt);
        }
        html += ' ';
    }
    return html;
}

function colorCodeDNA(seq) {
    return seq.split('').map(c => `<span class="${getNucleotideClass(c)}">${c}</span>`).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
