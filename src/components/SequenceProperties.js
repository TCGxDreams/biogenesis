// ============================================
// BioGenesis — GC Content & Sequence Properties Plot
// Sliding-window analysis with interactive canvas
// ============================================

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
const KYTE_DOOLITTLE = {
    A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, E: -3.5, Q: -3.5, G: -0.4, H: -3.2, I: 4.5,
    L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2
};
const FLEXIBILITY = {
    A: 0.36, R: 0.53, N: 0.46, D: 0.51, C: 0.35, E: 0.50, Q: 0.49, G: 0.54, H: 0.32, I: 0.46,
    L: 0.40, K: 0.47, M: 0.30, F: 0.31, P: 0.51, S: 0.51, T: 0.44, W: 0.31, Y: 0.42, V: 0.39
};
const AA_MW = {
    A: 89.1, R: 174.2, N: 132.1, D: 133.1, C: 121.2, E: 147.1, Q: 146.2, G: 75.0, H: 155.2, I: 131.2,
    L: 131.2, K: 146.2, M: 149.2, F: 165.2, P: 115.1, S: 105.1, T: 119.1, W: 204.2, Y: 181.2, V: 117.1
};
const AA_CHARGE = {
    A: 0, R: 1, N: 0, D: -1, C: 0, E: -1, Q: 0, G: 0, H: 0.5, I: 0,
    L: 0, K: 1, M: 0, F: 0, P: 0, S: 0, T: 0, W: 0, Y: 0, V: 0
};

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

    const values = [];
    let label = '', unit = '', color1 = '#00d4e8', color2 = '#086e8a';
    let globalStat = {};

    switch (plotType) {
        case 'gc_content': {
            label = 'GC Content (%)'; unit = '%';
            color1 = '#00d4e8'; color2 = '#086e8a';
            let totalGC = 0;
            for (let i = 0; i <= len - windowSize; i++) {
                const w = s.substring(i, i + windowSize);
                const gc = (w.split('G').length - 1 + w.split('C').length - 1) / windowSize;
                values.push(gc * 100);
            }
            for (let c of s) if (c === 'G' || c === 'C') totalGC++;
            globalStat = { 'Overall GC': (totalGC / len * 100).toFixed(1) + '%', 'AT/GC Ratio': ((len - totalGC) / totalGC).toFixed(2), 'Length': len.toLocaleString() + ' bp' };
            break;
        }
        case 'at_skew': {
            label = 'AT Skew (A-T)/(A+T)'; unit = '';
            color1 = '#3fb950'; color2 = '#f85149';
            for (let i = 0; i <= len - windowSize; i++) {
                const w = s.substring(i, i + windowSize);
                const a = (w.split('A').length - 1), t = (w.split('T').length - 1);
                values.push(a + t > 0 ? (a - t) / (a + t) : 0);
            }
            break;
        }
        case 'gc_skew': {
            label = 'GC Skew (G-C)/(G+C)'; unit = '';
            color1 = '#58a6ff'; color2 = '#d29922';
            for (let i = 0; i <= len - windowSize; i++) {
                const w = s.substring(i, i + windowSize);
                const g = (w.split('G').length - 1), c = (w.split('C').length - 1);
                values.push(g + c > 0 ? (g - c) / (g + c) : 0);
            }
            break;
        }
        case 'complexity': {
            label = 'Linguistic Complexity'; unit = '';
            color1 = '#8b5cf6'; color2 = '#582d9c';
            for (let i = 0; i <= len - windowSize; i++) {
                const w = s.substring(i, i + windowSize);
                const unique = new Set();
                for (let k = 1; k <= 3; k++) {
                    for (let j = 0; j <= w.length - k; j++) unique.add(w.substring(j, j + k));
                }
                values.push(unique.size / windowSize);
            }
            break;
        }
        case 'cpg': {
            label = 'CpG Observed/Expected'; unit = '';
            color1 = '#f778ba'; color2 = '#bf3e81';
            for (let i = 0; i <= len - windowSize; i++) {
                const w = s.substring(i, i + windowSize);
                const cg_count = (w.match(/CG/g) || []).length;
                const c_count = (w.split('C').length - 1);
                const g_count = (w.split('G').length - 1);
                const expected = (c_count * g_count) / windowSize;
                values.push(expected > 0 ? cg_count / expected : 0);
            }
            let totalCpG = (s.match(/CG/g) || []).length;
            globalStat = { 'CpG sites': totalCpG.toString(), 'CpG density': (totalCpG / (len / 100)).toFixed(1) + '/100bp' };
            break;
        }
        case 'hydrophobicity': {
            label = 'Hydrophobicity (Kyte-Doolittle)'; unit = '';
            color1 = '#f85149'; color2 = '#bd3933';
            for (let i = 0; i <= len - windowSize; i++) {
                let sum = 0;
                for (let j = i; j < i + windowSize; j++) sum += (KYTE_DOOLITTLE[s[j]] || 0);
                values.push(sum / windowSize);
            }
            const avgH = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
            globalStat = { 'Avg Hydrophobicity': avgH.toFixed(2), 'GRAVY': avgH.toFixed(3), 'Length': len.toLocaleString() + ' aa' };
            break;
        }
        case 'charge': {
            label = 'Net Charge (pH 7)'; unit = '';
            color1 = '#58a6ff'; color2 = '#f85149';
            for (let i = 0; i <= len - windowSize; i++) {
                let sum = 0;
                for (let j = i; j < i + windowSize; j++) sum += (AA_CHARGE[s[j]] || 0);
                values.push(sum / windowSize);
            }
            let totalCharge = 0;
            for (let c of s) totalCharge += (AA_CHARGE[c] || 0);
            globalStat = { 'Total Net Charge': totalCharge.toFixed(1), 'Est. Isoelectric Point (pI)': estimatePi(s) };
            break;
        }
        case 'molecular_weight': {
            label = 'Molecular Weight Window Avg'; unit = 'Da';
            color1 = '#3fb950'; color2 = '#2ea043';
            for (let i = 0; i <= len - windowSize; i++) {
                let sum = 0;
                for (let j = i; j < i + windowSize; j++) sum += (AA_MW[s[j]] || 110);
                values.push(sum / windowSize);
            }
            let totalMW = 0;
            for (let c of s) totalMW += (AA_MW[c] || 110);
            globalStat = { 'Total MW': (totalMW / 1000).toFixed(1) + ' kDa', 'Avg Residue MW': (totalMW / len).toFixed(1) + ' Da' };
            break;
        }
        case 'flexibility': {
            label = 'Flexibility (B-factor scale)'; unit = '';
            color1 = '#a855f7'; color2 = '#7c3aed';
            for (let i = 0; i <= len - windowSize; i++) {
                let sum = 0;
                for (let j = i; j < i + windowSize; j++) sum += (FLEXIBILITY[s[j]] || 0.4);
                values.push(sum / windowSize);
            }
            break;
        }
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

function estimatePi(seq) {
    let pos = 0, neg = 0;
    for (const c of seq) {
        if (c === 'K' || c === 'R') pos++;
        else if (c === 'D' || c === 'E') neg++;
        else if (c === 'H') pos += 0.5;
    }
    // Very rough pI estimation
    if (pos > neg) return '> 7.0 (Basic)';
    if (neg > pos) return '< 7.0 (Acidic)';
    return '~ 7.0 (Neutral)';
}
