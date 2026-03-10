// ============================================
// BioGenesis — Statistics Component v2
// Adds: pI, GRAVY, instability index, compact layout, donut SVG
// ============================================

import { gcContent, nucleotideComposition, molecularWeight, meltingTemp, findORFs, getNucleotideClass, getAminoAcidClass } from '../utils/bioUtils.js';

// Amino acid properties for protein-specific stats
const AA_PROPS = {
  A: { mw: 89.09, pKa: null, hydro: 1.8 }, R: { mw: 174.20, pKa: 12.5, hydro: -4.5 },
  N: { mw: 132.12, pKa: null, hydro: -3.5 }, D: { mw: 133.10, pKa: 3.9, hydro: -3.5 },
  C: { mw: 121.16, pKa: 8.3, hydro: 2.5 }, E: { mw: 147.13, pKa: 4.1, hydro: -3.5 },
  Q: { mw: 146.15, pKa: null, hydro: -3.5 }, G: { mw: 57.05, pKa: null, hydro: -0.4 },
  H: { mw: 155.16, pKa: 6.0, hydro: -3.2 }, I: { mw: 131.17, pKa: null, hydro: 4.5 },
  L: { mw: 131.17, pKa: null, hydro: 3.8 }, K: { mw: 146.19, pKa: 10.5, hydro: -3.9 },
  M: { mw: 149.21, pKa: null, hydro: 1.9 }, F: { mw: 165.19, pKa: null, hydro: 2.8 },
  P: { mw: 115.13, pKa: null, hydro: -1.6 }, S: { mw: 105.09, pKa: null, hydro: -0.8 },
  T: { mw: 119.12, pKa: null, hydro: -0.7 }, W: { mw: 204.23, pKa: null, hydro: -0.9 },
  Y: { mw: 181.19, pKa: 10.1, hydro: -1.3 }, V: { mw: 117.15, pKa: null, hydro: 4.2 },
};

// Instability index weights (Guruprasad 1990)
const II_WEIGHTS = {
  AA: 1.0, AR: 1.0, AN: 1.0, AD: 1.0, AC: 44.94, AE: 1.0, AQ: 1.0, AG: 1.0, AH: 1.0, AI: 1.0, AL: 1.0, AK: 1.0, AM: 1.0, AF: 1.0, AP: 20.26, AS: 1.0, AT: 1.0, AW: 1.0, AY: 1.0, AV: 1.0,
  RA: 1.0, RR: 1.0, RN: 1.0, RD: 1.0, RC: 1.0, RE: 1.0, RQ: 1.0, RG: 1.0, RH: 1.0, RI: 1.0, RL: 1.0, RK: 1.0, RM: 1.0, RF: 1.0, RP: 20.26, RS: 44.94, RT: 1.0, RW: 58.28, RY: 1.0, RV: 1.0,
  DA: 1.0, DR: 1.0, DN: 1.0, DD: 1.0, DC: 1.0, DE: 1.0, DQ: 1.0, DG: 1.0, DH: 1.0, DI: 1.0, DL: 1.0, DK: 1.0, DM: 1.0, DF: 1.0, DP: 1.0, DS: 1.0, DT: 1.0, DW: 1.0, DY: 1.0, DV: 1.0,
  CA: 1.0, CR: 1.0, CN: 1.0, CD: 1.0, CC: 1.0, CE: 1.0, CQ: 1.0, CG: 1.0, CH: 1.0, CI: 1.0, CL: 1.0, CK: 1.0, CM: 1.0, CF: 1.0, CP: 20.26, CS: 1.0, CT: 33.60, CW: 1.0, CY: 1.0, CV: 1.0,
  QA: 1.0, QR: 1.0, QN: 1.0, QD: 1.0, QC: 1.0, QE: 20.26, QQ: 1.0, QG: 1.0, QH: 1.0, QI: 1.0, QL: 1.0, QK: 1.0, QM: 1.0, QF: 1.0, QP: 1.0, QS: 1.0, QT: 1.0, QW: 1.0, QY: 1.0, QV: 1.0,
  KA: 1.0, KR: 1.0, KN: 1.0, KD: 1.0, KC: 1.0, KE: 1.0, KQ: 1.0, KG: 1.0, KH: 1.0, KI: 1.0, KL: 1.0, KK: 1.0, KM: 1.0, KF: 1.0, KP: 1.0, KS: 1.0, KT: 1.0, KW: 1.0, KY: 1.0, KV: 1.0,
  HA: 1.0, HR: 1.0, HN: 1.0, HD: 1.0, HC: 1.0, HE: 1.0, HQ: 1.0, HG: 1.0, HH: 1.0, HI: 1.0, HL: 1.0, HK: 1.0, HM: 1.0, HF: 1.0, HP: 1.0, HS: 1.0, HT: 1.0, HW: 1.0, HY: 1.0, HV: 1.0,
  FA: 1.0, FR: 1.0, FN: 1.0, FD: 1.0, FC: 1.0, FE: 1.0, FQ: 1.0, FG: 1.0, FH: 1.0, FI: 1.0, FL: 1.0, FK: 1.0, FM: 1.0, FF: 1.0, FP: 20.26, FS: 1.0, FT: 1.0, FW: 1.0, FY: 1.0, FV: 1.0,
  LA: 1.0, LR: 1.0, LN: 1.0, LD: 1.0, LC: 1.0, LE: 1.0, LQ: 1.0, LG: 1.0, LH: 1.0, LI: 1.0, LL: 1.0, LK: 1.0, LM: 1.0, LF: 1.0, LP: 20.26, LS: 1.0, LT: 1.0, LW: 1.0, LY: 1.0, LV: 1.0,
  WA: 1.0, WR: 1.0, WN: 1.0, WD: 1.0, WC: 1.0, WE: 1.0, WQ: 1.0, WG: 1.0, WH: 1.0, WI: 1.0, WL: 1.0, WK: 1.0, WM: 1.0, WF: 1.0, WP: 1.0, WS: 1.0, WT: 1.0, WW: 1.0, WY: 1.0, WV: 1.0,
  VA: 1.0, VR: 1.0, VN: 1.0, VD: 1.0, VC: 1.0, VE: 1.0, VQ: 1.0, VG: 1.0, VH: 1.0, VI: 1.0, VL: 1.0, VK: 1.0, VM: 1.0, VF: 1.0, VP: 20.26, VS: 1.0, VT: 1.0, VW: 1.0, VY: 1.0, VV: 1.0,
  IA: 1.0, IR: 1.0, IN: 1.0, ID: 1.0, IC: 1.0, IE: 1.0, IQ: 1.0, IG: 1.0, IH: 1.0, II: 1.0, IL: 1.0, IK: 1.0, IM: 1.0, IF: 1.0, IP: 1.0, IS: 1.0, IT: 1.0, IW: 1.0, IY: 1.0, IV: 1.0,
  YA: 1.0, YR: 1.0, YN: 1.0, YD: 1.0, YC: 1.0, YE: 1.0, YQ: 1.0, YG: 1.0, YH: 1.0, YI: 1.0, YL: 1.0, YK: 1.0, YM: 1.0, YF: 1.0, YP: 1.0, YS: 1.0, YT: 1.0, YW: 1.0, YY: 1.0, YV: 1.0,
  MA: 1.0, MR: 1.0, MN: 1.0, MD: 1.0, MC: 1.0, ME: 1.0, MQ: 1.0, MG: 1.0, MH: 1.0, MI: 1.0, ML: 1.0, MK: 1.0, MM: 1.0, MF: 1.0, MP: 1.0, MS: 1.0, MT: 1.0, MW: 1.0, MY: 1.0, MV: 1.0,
  SA: 1.0, SR: 1.0, SN: 1.0, SD: 1.0, SC: 1.0, SE: 20.26, SQ: 1.0, SG: 1.0, SH: 1.0, SI: 1.0, SL: 1.0, SK: 1.0, SM: 1.0, SF: 1.0, SP: 44.94, SS: 20.26, ST: 1.0, SW: 1.0, SY: 1.0, SV: 1.0,
  TA: 1.0, TR: 1.0, TN: 1.0, TD: 1.0, TC: 1.0, TE: 20.26, TQ: 1.0, TG: 1.0, TH: 1.0, TI: 1.0, TL: 1.0, TK: 1.0, TM: 1.0, TF: 1.0, TP: 1.0, TS: 1.0, TT: 1.0, TW: 1.0, TY: 1.0, TV: 1.0,
  EA: 1.0, ER: 1.0, EN: 1.0, ED: 1.0, EC: 44.94, EE: 33.60, EQ: 20.26, EG: 1.0, EH: 1.0, EI: 20.26, EL: 1.0, EK: 1.0, EM: 1.0, EF: 1.0, EP: 20.26, ES: 1.0, ET: 1.0, EW: 1.0, EY: 1.0, EV: 1.0,
  GA: 1.0, GR: 1.0, GN: 1.0, GD: 1.0, GC: 1.0, GE: 1.0, GQ: 1.0, GG: 13.34, GH: 1.0, GI: 1.0, GL: 1.0, GK: 1.0, GM: 1.0, GF: 1.0, GP: 1.0, GS: 1.0, GT: 1.0, GW: 13.34, GY: 1.0, GV: 1.0,
  PA: 20.26, PR: 1.0, PN: 1.0, PD: 1.0, PC: 1.0, PE: 18.38, PQ: 1.0, PG: 1.0, PH: 1.0, PI: 1.0, PL: 1.0, PK: 1.0, PM: 67.45, PF: 1.0, PP: 1.0, PS: 1.0, PT: 1.0, PW: 1.0, PY: 1.0, PV: 1.0,
};

function computePI(seq) {
  const upper = seq.toUpperCase();
  const count = {};
  for (const c of upper) count[c] = (count[c] || 0) + 1;
  const nD = count['D'] || 0, nE = count['E'] || 0, nC = count['C'] || 0, nY = count['Y'] || 0,
    nH = count['H'] || 0, nK = count['K'] || 0, nR = count['R'] || 0;
  const nTerm = 1, cTerm = 1;

  // Henderson-Hasselbalch binary search
  let lo = 0, hi = 14;
  for (let i = 0; i < 200; i++) {
    const pH = (lo + hi) / 2;
    const charge =
      nTerm * (1 / (1 + Math.pow(10, pH - 8.0))) +
      nK * (1 / (1 + Math.pow(10, pH - 10.5))) +
      nR * (1 / (1 + Math.pow(10, pH - 12.5))) +
      nH * (1 / (1 + Math.pow(10, pH - 6.0))) -
      cTerm * (1 / (1 + Math.pow(10, 3.1 - pH))) -
      nD * (1 / (1 + Math.pow(10, 3.9 - pH))) -
      nE * (1 / (1 + Math.pow(10, 4.1 - pH))) -
      nC * (1 / (1 + Math.pow(10, 8.3 - pH))) -
      nY * (1 / (1 + Math.pow(10, 10.1 - pH)));
    if (charge > 0) lo = pH; else hi = pH;
  }
  return (lo + hi) / 2;
}

function computeGRAVY(seq) {
  const upper = seq.toUpperCase();
  let sum = 0, count = 0;
  for (const c of upper) {
    if (AA_PROPS[c]) { sum += AA_PROPS[c].hydro; count++; }
  }
  return count > 0 ? sum / count : 0;
}

function instabilityIndex(seq) {
  const upper = seq.toUpperCase();
  let ii = 0;
  for (let i = 0; i < upper.length - 1; i++) {
    const pair = upper[i] + upper[i + 1];
    ii += II_WEIGHTS[pair] || 1.0;
  }
  return (10 / upper.length) * ii;
}

function aminoAcidComposition(seq) {
  const comp = {};
  for (const c of seq.toUpperCase()) {
    if (c.match(/[A-Z]/)) comp[c] = (comp[c] || 0) + 1;
  }
  return comp;
}

function donutSVG(segments, size = 90) {
  const r = 34, cx = size / 2, cy = size / 2, strokeW = 12;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let paths = '', offset = 0;
  const circ = 2 * Math.PI * r;
  for (const seg of segments) {
    const dash = (seg.value / total) * circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash} ${circ - dash}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})">
      <title>${seg.label}: ${(seg.value / total * 100).toFixed(1)}%</title>
    </circle>`;
    offset += dash;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

function gcWindowPlot(seq, windowSize = 50) {
  const upper = seq.toUpperCase().replace(/[^ACGTU]/g, '');
  const points = [];
  const step = Math.max(1, Math.floor(windowSize / 2));
  for (let i = 0; i + windowSize <= upper.length; i += step) {
    const win = upper.substring(i, i + windowSize);
    const gc = (win.split('').filter(c => 'GC'.includes(c)).length / win.length) * 100;
    points.push({ x: i + windowSize / 2, y: gc });
  }
  if (points.length === 0) return '';
  const W = 560, H = 80;
  const xScale = W / upper.length;
  const pts = points.map(p => `${(p.x * xScale).toFixed(1)},${(H - p.y / 100 * H).toFixed(1)}`).join(' ');
  const area = `${points[0].x * xScale},${H} ` + pts + ` ${points[points.length - 1].x * xScale},${H}`;

  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">GC Content — Sliding Window (${windowSize} bp)</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border-muted);">
        <defs>
          <linearGradient id="gcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="${H * 0.5}" x2="${W}" y2="${H * 0.5}" stroke="var(--border-muted)" stroke-dasharray="4,4" stroke-width="1"/>
        <text x="4" y="${H * 0.5 - 3}" fill="var(--text-muted)" font-size="8" font-family="monospace">50%</text>
        <polygon points="${area}" fill="url(#gcGrad)"/>
        <polyline points="${pts}" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5"/>
      </svg>
    </div>`;
}

export function renderStatistics(seq) {
  const seqStr = seq.sequence;
  const len = seqStr.length;
  const type = seq.type;
  const gc = type !== 'protein' ? gcContent(seqStr) : null;
  const mw = molecularWeight(seqStr, type);
  const tm = type !== 'protein' ? meltingTemp(seqStr) : null;

  // Protein-specific
  const pi = type === 'protein' ? computePI(seqStr) : null;
  const gravy = type === 'protein' ? computeGRAVY(seqStr) : null;
  const ii = type === 'protein' ? instabilityIndex(seqStr) : null;
  const comp = type !== 'protein' ? nucleotideComposition(seqStr) : aminoAcidComposition(seqStr);

  // ---- Stats Cards ----
  const statCards = [
    { label: 'Length', val: len.toLocaleString(), unit: type === 'protein' ? 'aa' : 'bp' },
    { label: 'MW', val: mw > 1000 ? (mw / 1000).toFixed(2) : mw.toFixed(0), unit: mw > 1000 ? 'kDa' : 'Da' },
    gc !== null ? { label: 'GC Content', val: gc.toFixed(1), unit: '%' } : null,
    tm !== null ? { label: 'Tm', val: tm.toFixed(1), unit: '°C' } : null,
    pi !== null ? { label: 'pI', val: pi.toFixed(2), unit: '' } : null,
    gravy !== null ? { label: 'GRAVY', val: gravy.toFixed(3), unit: '', color: gravy > 0 ? 'var(--accent-orange)' : 'var(--accent-blue)' } : null,
    ii !== null ? { label: 'Instability Index', val: ii.toFixed(1), unit: '', color: ii > 40 ? 'var(--accent-red)' : 'var(--accent-green)' } : null,
  ].filter(Boolean);

  const cardsHtml = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
      ${statCards.map(c => `
        <div class="stat-card" style="padding:12px 14px;">
          <div class="stat-title">${c.label}</div>
          <div class="stat-value" style="font-size:20px;${c.color ? 'color:' + c.color : ''}">${c.val}${c.unit ? `<span class="stat-unit">${c.unit}</span>` : ''}</div>
        </div>`).join('')}
    </div>`;

  // ---- Composition ----
  let compositionHtml = '';
  if (type !== 'protein') {
    const total = comp.A + comp.T + comp.C + comp.G + (comp.U || 0);
    const segments = [
      { label: 'A', count: comp.A, color: 'var(--nt-a)' },
      { label: 'T', count: comp.T, color: 'var(--nt-t)' },
      { label: 'C', count: comp.C, color: 'var(--nt-c)' },
      { label: 'G', count: comp.G, color: 'var(--nt-g)' },
      ...(comp.U > 0 ? [{ label: 'U', count: comp.U, color: 'var(--nt-u)' }] : [])
    ].filter(s => s.count > 0);

    const donut = donutSVG(segments.map(s => ({ label: s.label, value: s.count, color: s.color })));

    compositionHtml = `
        <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;">
          <div style="flex-shrink:0;">${donut}</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Nucleotide Composition</div>
            ${segments.map(s => {
      const pct = (s.count / total * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="width:14px;height:14px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                <span style="font-weight:700;font-size:12px;width:16px;">${s.label}</span>
                <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${s.color};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);min-width:100px;text-align:right;">${s.count.toLocaleString()} (${pct.toFixed(1)}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;

    // GC plot only for DNA > 200bp
    if ((type === 'dna' || type === 'rna') && len >= 200) {
      compositionHtml += gcWindowPlot(seqStr, Math.min(100, Math.floor(len / 10)));
    }
  } else {
    // Protein — top AA chart + property breakdown
    const entries = Object.entries(comp).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [_, v]) => s + v, 0);
    const aaColors = {
      A: '#3fb950', I: '#3fb950', L: '#3fb950', M: '#3fb950', F: '#3fb950', W: '#3fb950', V: '#3fb950', P: '#3fb950',
      S: '#58a6ff', T: '#58a6ff', Y: '#58a6ff', N: '#58a6ff', Q: '#58a6ff', H: '#58a6ff', C: '#58a6ff',
      R: '#f85149', K: '#f85149', D: '#f778ba', E: '#f778ba', G: '#e3b341'
    };

    // Group stats for protein
    const hydro = ['A', 'I', 'L', 'M', 'F', 'W', 'V', 'P'], polar = ['S', 'T', 'Y', 'N', 'Q', 'H', 'C'],
      pos = ['R', 'K'], neg = ['D', 'E'], gly = ['G'];
    const pHydro = entries.reduce((s, [aa, c]) => s + (hydro.includes(aa) ? c : 0), 0);
    const pPolar = entries.reduce((s, [aa, c]) => s + (polar.includes(aa) ? c : 0), 0);
    const pPos = entries.reduce((s, [aa, c]) => s + (pos.includes(aa) ? c : 0), 0);
    const pNeg = entries.reduce((s, [aa, c]) => s + (neg.includes(aa) ? c : 0), 0);

    const groupSegments = [
      { label: 'Hydrophobic', value: pHydro, color: '#3fb950' },
      { label: 'Polar', value: pPolar, color: '#58a6ff' },
      { label: 'Positive', value: pPos, color: '#f85149' },
      { label: 'Negative', value: pNeg, color: '#f778ba' },
      { label: 'Special', value: total - pHydro - pPolar - pPos - pNeg, color: '#e3b341' },
    ].filter(s => s.value > 0);

    compositionHtml = `
        <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;flex-wrap:wrap;">
          <div style="flex-shrink:0;">${donutSVG(groupSegments, 100)}</div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">AA Property Groups</div>
            ${groupSegments.map(s => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="width:14px;height:14px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                <span style="font-size:12px;flex:1;">${s.label}</span>
                <div style="width:80px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${(s.value / total * 100)}%;height:100%;background:${s.color};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);min-width:70px;text-align:right;">${s.value} (${(s.value / total * 100).toFixed(1)}%)</span>
              </div>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Amino Acid Composition</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;">
            ${entries.map(([aa, count]) => {
      const pct = (count / total * 100);
      const color = aaColors[aa] || '#6e7681';
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="font-weight:700;width:14px;color:${color};font-family:var(--font-mono);">${aa}</span>
                <div style="flex:1;height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${Math.max(pct, 0.3)}%;height:100%;background:${color};opacity:0.8;border-radius:3px;"></div>
                </div>
                <span style="color:var(--text-muted);min-width:55px;text-align:right;">${count} (${pct.toFixed(1)}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;
  }

  // ---- ORFs for DNA/RNA ----
  let orfHtml = '';
  if (type === 'dna' || type === 'rna') {
    const orfs = findORFs(seqStr, 90);
    orfHtml = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Open Reading Frames (≥ 90 bp) — ${orfs.length} found</div>
          ${orfs.length > 0 ? `
          <div class="orf-container" style="margin-bottom:10px;">
            ${[1, 2, 3].map(frame => {
      const fOrfs = orfs.filter(o => o.frame === frame);
      return `<div class="orf-track">
                <span class="orf-track-label">+${frame}</span>
                <div class="orf-track-bar">
                  ${fOrfs.map(orf => {
        const left = (orf.start / len * 100).toFixed(2);
        const width = ((orf.end - orf.start) / len * 100).toFixed(2);
        return `<div class="orf-block" style="left:${left}%;width:${width}%;" title="${orf.start + 1}..${orf.end} (${orf.length} bp)"></div>`;
      }).join('')}
                </div>
              </div>`;
    }).join('')}
          </div>
          <div style="overflow-x:auto;">
            <table class="blast-results-table" style="font-size:11px;">
              <thead><tr><th>Frame</th><th>Start</th><th>End</th><th>Length</th><th>Protein (aa)</th><th>Start Codon</th></tr></thead>
              <tbody>
                ${orfs.slice(0, 12).map(orf => `
                  <tr>
                    <td>+${orf.frame}</td>
                    <td>${(orf.start + 1).toLocaleString()}</td>
                    <td>${orf.end.toLocaleString()}</td>
                    <td>${orf.length} bp / ${orf.protein.length} aa</td>
                    <td style="font-family:var(--font-mono);">${orf.protein.substring(0, 25)}${orf.protein.length > 25 ? '…' : ''}</td>
                    <td style="font-family:var(--font-mono);color:var(--accent-green);">ATG</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<p style="color:var(--text-muted);font-size:12px;">No ORFs ≥ 90 bp found.</p>`}
        </div>`;
  }

  // ---- Codon usage ----
  let codonHtml = '';
  if ((type === 'dna' || type === 'rna') && len >= 3) {
    const codonCounts = {};
    const upper = seqStr.toUpperCase();
    for (let i = 0; i + 2 < upper.length; i += 3) {
      const c = upper.substring(i, i + 3);
      codonCounts[c] = (codonCounts[c] || 0) + 1;
    }
    const totalCodons = Object.values(codonCounts).reduce((s, v) => s + v, 0);
    const top = Object.entries(codonCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    codonHtml = `
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Top Codon Usage (Frame +1)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:5px;">
            ${top.map(([codon, count]) => {
      const pct = (count / totalCodons * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="font-family:var(--font-mono);font-weight:600;color:var(--text-primary);width:34px;">${codon}</span>
                <div style="flex:1;height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                  <div style="width:${Math.max(parseFloat(pct) * 3, 1)}%;height:100%;background:var(--accent-cyan);border-radius:3px;"></div>
                </div>
                <span style="color:var(--text-muted);min-width:55px;text-align:right;">${count} (${pct}%)</span>
              </div>`;
    }).join('')}
          </div>
        </div>`;
  }

  // ---- Export button ----
  const exportBtn = `
      <button class="btn btn-secondary" id="stats-export-btn" style="font-size:11px;padding:5px 12px;margin-bottom:12px;">
        ↓ Export Report
      </button>`;

  return `
    <div class="panel active">
      <div class="panel-header">
        <h2>Sequence Statistics</h2>
        <p>${escapeHtml(seq.name)} · ${len.toLocaleString()} ${type === 'protein' ? 'aa' : 'bp'} · ${type.toUpperCase()}</p>
      </div>
      <div class="panel-body">
        ${exportBtn}
        ${cardsHtml}
        ${compositionHtml}
        ${orfHtml}
        ${codonHtml}
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
