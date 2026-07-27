// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — GC Content & Sequence Properties Plot
// Sliding-window analysis with interactive canvas
// ============================================

import { computeProperty, METRICS } from '../core/properties.js';

export function renderSequenceProperties(seq) {
    if (!seq) return '<div class="empty-state"><p class="empty-state-text">Select a sequence to view properties</p></div>';

    const isProtein = seq.type === 'protein';
    const len = seq.sequence.length;

    // Pre-compute data for the initial render
    const windowSize = Math.min(50, Math.floor(len / 4) || 10);

    return `
    <div class="panel-section">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>Sequence Properties</h2>
          <p>${seq.name} — Sliding window analysis (${len.toLocaleString()} ${isProtein ? 'aa' : 'bp'})</p>
        </div>
      </div>
      <div class="panel-body">

        <!-- Controls -->
        <div style="display:flex;gap:16px;align-items:flex-end;margin-bottom:24px;flex-wrap:wrap;background:var(--bg-elevated);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-muted);">
          <div style="flex:1;min-width:200px;">
            <label class="form-label" style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Plot Property</label>
            <select id="prop-type" class="modern-select"
              style="width:100%;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;cursor:pointer;">
              ${isProtein ? `
                <option value="hydrophobicity">Hydrophobicity (Kyte-Doolittle)</option>
                <option value="charge">Net Charge</option>
                <option value="molecular_weight">Molecular Weight</option>
                <option value="flexibility">Flexibility (B-factor)</option>
              ` : `
                <option value="gc_content">GC Content</option>
                <option value="at_skew">AT Skew</option>
                <option value="gc_skew">GC Skew</option>
                <option value="complexity">Sequence Complexity</option>
                <option value="cpg">CpG Observed/Expected</option>
              `}
            </select>
          </div>
          <div>
            <label class="form-label" style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Window Size</label>
            <input id="prop-window" type="number" value="${windowSize}" min="5" max="${Math.floor(len / 2)}" step="5"
              style="width:100px;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
          </div>
          <button id="prop-compute-btn" class="btn btn-primary" style="padding:8px 20px;height:35px;display:flex;align-items:center;">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
             Analyze Plot
          </button>
        </div>

        <!-- Plot canvas -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:0;margin-bottom:24px;overflow:hidden;position:relative;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <canvas id="prop-canvas" width="900" height="320" style="width:100%;height:320px;display:block;cursor:crosshair;"></canvas>
          <div id="prop-tooltip" style="position:absolute;top:0;left:0;opacity:0;pointer-events:none;background:var(--bg-elevated);border:1px solid var(--accent-cyan);padding:8px 12px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:12px;z-index:10;transition:opacity 0.2s;">
            <div id="prop-tt-val" style="font-weight:700;color:var(--accent-cyan);margin-bottom:2px;font-size:14px;"></div>
            <div id="prop-tt-pos" style="color:var(--text-muted);font-family:var(--font-mono);"></div>
          </div>
        </div>

        <!-- Summary stats -->
        <div id="prop-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;"></div>

      </div>
    </div>
  `;
}

// ─── Hydrophobicity scales ───
let currentPlotData = null;

export function bindSequencePropertiesEvents(seq) {
    const btn = document.getElementById('prop-compute-btn');
    const typeSelect = document.getElementById('prop-type');

    const render = () => {
        const windowSize = parseInt(document.getElementById('prop-window')?.value || '50');
        const plotType = typeSelect?.value || 'gc_content';
        computeAndRenderPlot(seq, windowSize, plotType);
    };

    btn?.addEventListener('click', render);
    typeSelect?.addEventListener('change', render);

    // Auto-render on load
    setTimeout(render, 50);
}

function computeAndRenderPlot(seq, windowSize, plotType) {
    const canvas = document.getElementById('prop-canvas');
    const statsEl = document.getElementById('prop-stats');
    const tooltip = document.getElementById('prop-tooltip');

    if (!canvas || !statsEl) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const s = seq.sequence.toUpperCase();
    const len = s.length;

    // Colours are presentation only; the numbers come from src/core/properties.js.
    const PLOT_COLORS = {
        gc_content: ['#00d4e8', '#086e8a'],
        at_skew: ['#3fb950', '#f85149'],
        gc_skew: ['#58a6ff', '#d29922'],
        complexity: ['#8b5cf6', '#582d9c'],
        cpg: ['#f778ba', '#bf3e81'],
        hydrophobicity: ['#f85149', '#bd3933'],
        charge: ['#58a6ff', '#f85149'],
        molecular_weight: ['#3fb950', '#2ea043'],
        flexibility: ['#a855f7', '#7c3aed'],
    };

    let values = [], label = '', unit = '';
    let [color1, color2] = PLOT_COLORS[plotType] || ['#00d4e8', '#086e8a'];
    let globalStat = {};

    if (METRICS[plotType]) {
        const series = computeProperty(s, plotType, windowSize);
        values = series.values;
        label = series.label;
        unit = series.unit;
        globalStat = formatGlobalStats(plotType, series.stats);
    }

    if (values.length === 0) return;

    // Layout
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const padTop = 40, padBot = 40, padL = 60, padR = 20;
    const plotW = W - padL - padR;
    const plotH = H - padTop - padBot;

    // Save for interaction
    currentPlotData = { values, minVal, maxVal, range, padL, plotW, plotH, padTop, windowSize, label, unit, color1 };

    // Function to draw the whole graph
    const drawGraph = () => {
        ctx.clearRect(0, 0, W, H);

        // BG Gradient for panel
        const panelGrad = ctx.createLinearGradient(0, 0, 0, H);
        panelGrad.addColorStop(0, '#10141f');
        panelGrad.addColorStop(1, '#0b0f19');
        ctx.fillStyle = panelGrad;
        ctx.fillRect(0, 0, W, H);

        // Background grid via horizontal lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padTop + (plotH / gridLines) * i;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            const val = maxVal - (range / gridLines) * i;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '11px var(--font-mono)';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(plotType === 'gc_content' ? 0 : 2), padL - 10, y + 4);
        }

        // Zero line
        if (minVal < 0 && maxVal > 0) {
            const zeroY = padTop + plotH * (maxVal / range);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W - padR, zeroY); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Smooth Curve drawing using bezier
        const drawLine = (fill) => {
            ctx.beginPath();
            ctx.moveTo(padL, padTop + plotH);

            // First point
            if (!fill) ctx.moveTo(padL, padTop + plotH - ((values[0] - minVal) / range) * plotH);

            for (let i = 0; i < values.length; i++) {
                const x = padL + (i / (values.length - 1)) * plotW;
                const y = padTop + plotH - ((values[i] - minVal) / range) * plotH;
                ctx.lineTo(x, y);
            }

            if (fill) {
                ctx.lineTo(padL + plotW, padTop + plotH);
                ctx.closePath();
            }
        };

        // Fill under line
        const grad = ctx.createLinearGradient(0, padTop, 0, H - padBot);
        grad.addColorStop(0, color1 + '66');
        grad.addColorStop(1, color1 + '05');
        ctx.fillStyle = grad;
        drawLine(true);
        ctx.fill();

        // Stroke line
        ctx.strokeStyle = color1;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        drawLine(false);
        ctx.stroke();

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '600 14px var(--font-sans)';
        ctx.textAlign = 'left';
        ctx.fillText(label, padL, 22);

        // X-axis label & ticks
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText(`Sequence Position (Window Size = ${windowSize})`, padL + plotW / 2, H - 10);

        const xticks = 6;
        for (let i = 0; i <= xticks; i++) {
            const x = padL + (plotW / xticks) * i;
            const pos = Math.round((len / xticks) * i);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px var(--font-mono)';
            ctx.textAlign = 'center';
            ctx.fillText(pos.toLocaleString(), x, H - padBot + 18);

            // X tick mark
            ctx.beginPath(); ctx.moveTo(x, H - padBot); ctx.lineTo(x, H - padBot + 5);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
        }
    };

    drawGraph();

    // Stats boxes below
    if (Object.keys(globalStat).length === 0) {
        globalStat = {
            'Min Value': minVal.toFixed(2) + unit,
            'Max Value': maxVal.toFixed(2) + unit,
            'Mean Average': (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) + unit,
        };
    }

    statsEl.innerHTML = Object.entries(globalStat).map(([k, v]) => `
    <div style="background:var(--bg-tertiary);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border-muted);box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:transform 0.2s;cursor:default;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-weight:600;">${k}</div>
      <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${v}</div>
    </div>
  `).join('');

    // --- Interaction Logic ---
    canvas.onmousemove = (e) => {
        if (!currentPlotData) return;
        const r = canvas.getBoundingClientRect();
        const mouseX = e.clientX - r.left;
        const d = currentPlotData;

        if (mouseX >= d.padL && mouseX <= d.padL + d.plotW) {
            // Find closest index
            const ratio = (mouseX - d.padL) / d.plotW;
            const idx = Math.round(ratio * (d.values.length - 1));
            const val = d.values[idx];

            const px = d.padL + (idx / (d.values.length - 1)) * d.plotW;
            const py = d.padTop + d.plotH - ((val - d.minVal) / d.range) * d.plotH;

            // Redraw graph to clear previous hover
            drawGraph();

            // Draw hover line
            ctx.beginPath();
            ctx.moveTo(px, d.padTop);
            ctx.lineTo(px, d.padTop + d.plotH);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw hover point
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = d.color1;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Update tooltip HTML overlay
            tooltip.style.opacity = '1';
            // ensure it stays within bounds
            const ttX = px + 15 + 120 > W ? px - 130 : px + 15;
            tooltip.style.transform = `translate(${ttX}px, ${Math.max(10, py - 20)}px)`;

            const position = idx + 1;
            const displayVal = val % 1 === 0 ? val : val.toFixed(2);
            document.getElementById('prop-tt-val').textContent = `${displayVal}${d.unit}`;
            document.getElementById('prop-tt-pos').textContent = `Pos: ${position.toLocaleString()}`;
        } else {
            tooltip.style.opacity = '0';
            drawGraph();
        }
    };

    canvas.onmouseleave = () => {
        tooltip.style.opacity = '0';
        drawGraph();
    };
}

/**
 * Format the raw whole-sequence figures from core into the display strings the
 * stats panel shows.
 *
 * @param {string} metric
 * @param {Object} stats
 * @returns {{[label: string]: string}}
 */
function formatGlobalStats(metric, stats) {
    switch (metric) {
        case 'gc_content':
            return {
                'Overall GC': stats.overallGc.toFixed(1) + '%',
                'AT/GC Ratio': stats.atGcRatio.toFixed(2),
                'Length': stats.length.toLocaleString() + ' bp',
            };
        case 'cpg':
            return {
                'CpG sites': stats.cpgSites.toString(),
                'CpG density': stats.cpgDensityPer100bp.toFixed(1) + '/100bp',
            };
        case 'hydrophobicity':
            return {
                'Avg Hydrophobicity': stats.averageHydrophobicity.toFixed(2),
                'GRAVY': stats.averageHydrophobicity.toFixed(3),
                'Length': stats.length.toLocaleString() + ' aa',
            };
        case 'charge':
            return {
                'Total Net Charge': stats.totalNetCharge.toFixed(1),
                'Est. Isoelectric Point (pI)': stats.isoelectricPoint,
            };
        case 'molecular_weight':
            return {
                'Total MW': (stats.totalMw / 1000).toFixed(1) + ' kDa',
                'Avg Residue MW': stats.averageResidueMw.toFixed(1) + ' Da',
            };
        default:
            return {};
    }
}
