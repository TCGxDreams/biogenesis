// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Sequence Editor Component
// ============================================

import { getNucleotideClass, getAminoAcidClass, translate } from '../utils/bioUtils.js';

export function renderSequenceEditor(seq) {
    const seqStr = seq.sequence;
    const len = seqStr.length;
    const type = seq.type;

    // Feature colors
    const featureColors = {
        'gene': '#3fb950', 'CDS': '#58a6ff', 'promoter': '#f85149',
        'misc_feature': '#e3b341', 'rep_origin': '#8b5cf6', 'terminator': '#f778ba'
    };

    // Annotation tracks
    let annotationTracksHtml = '';
    if (seq.features && seq.features.length > 0) {
        for (const feat of seq.features) {
            const color = featureColors[feat.type] || '#6e7681';
            const leftPct = (feat.start / len * 100).toFixed(2);
            const widthPct = ((feat.end - feat.start) / len * 100).toFixed(2);
            const label = feat.qualifiers?.gene || feat.qualifiers?.product || feat.type;

            annotationTracksHtml += `<div class="annotation-track">
        <div class="annotation-block" style="left:${leftPct}%;width:${widthPct}%;background:${color};" title="${label}: ${feat.start + 1}..${feat.end}">
          ${label}
        </div>
      </div>`;
        }
    }

    // Annotation table
    let tableHtml = '';
    if (seq.features && seq.features.length > 0) {
        const rows = seq.features.map((feat, i) => {
            const label = feat.qualifiers?.gene || feat.qualifiers?.product || feat.type;
            const color = featureColors[feat.type] || '#6e7681';
            return `<tr>
        <td><span class="feature-color-dot" style="background:${color};display:inline-block;"></span></td>
        <td>${feat.type}</td>
        <td style="font-weight:600;">${escapeHtml(label)}</td>
        <td style="font-family:var(--font-mono);font-size:11px;">${feat.start + 1}..${feat.end}</td>
        <td>${feat.complement ? '←' : '→'}</td>
        <td>${feat.end - feat.start} bp</td>
      </tr>`;
        }).join('');

        tableHtml = `
      <h3 style="font-size:13px;font-weight:600;margin:16px 0 8px;color:var(--text-secondary);">Feature Table</h3>
      <div style="overflow-x:auto;">
        <table class="annotation-table">
          <thead><tr><th></th><th>Type</th><th>Label</th><th>Location</th><th>Strand</th><th>Length</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    }

    // Translation preview for DNA
    let translationHtml = '';
    if (type === 'dna' || type === 'rna') {
        const protein = translate(seqStr.substring(0, Math.min(300, seqStr.length)));
        translationHtml = `
      <div style="margin-top:16px;">
        <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Translation (Frame +1, first 100 codons)</h3>
        <div class="sequence-display" style="font-size:12px;letter-spacing:2px;">
          ${protein.split('').map(aa => `<span class="${getAminoAcidClass(aa)}">${aa}</span>`).join('')}
        </div>
      </div>
    `;
    }

    return `
    <div class="panel active">
      <div class="panel-header">
        <h2>Sequence Editor</h2>
        <p>${escapeHtml(seq.name)} — ${len.toLocaleString()} ${type === 'protein' ? 'aa' : 'bp'}</p>
      </div>
      <div class="panel-controls">
        <button class="btn btn-primary" id="add-annotation-btn">+ Add Annotation</button>
        <div class="toggle-group">
          <button class="toggle-option active">Linear</button>
          <button class="toggle-option">Circular</button>
        </div>
      </div>
      <div class="panel-body">
        ${annotationTracksHtml ? `<div style="margin-bottom:16px;"><h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary);">Annotation Map</h3>${annotationTracksHtml}</div>` : ''}
        ${tableHtml}
        ${translationHtml}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
