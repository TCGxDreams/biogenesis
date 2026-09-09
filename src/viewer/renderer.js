// ============================================
// BioGenesis — Sequence view canvas renderer
// ============================================
//
// Paints the visible rows of the sequence view. Everything it needs arrives in
// one model object; it holds no state and reads nothing from the DOM, so a frame
// can be reproduced exactly from its inputs.
//
// The renderer is written to stay cheap at every zoom. At `letters` detail it
// draws one glyph per residue but only changes `fillStyle` when the colour
// changes; at `blocks` detail it merges runs of same-coloured residues into one
// rectangle; at `density` detail it never iterates residues at all, sampling a
// fixed number per pixel column instead. That last rule is what lets a
// multi-megabase sequence render in one row without stalling.

import { residueColor, featureColor } from './theme.js';
import { rowRange, tickStep, clamp } from '../core/viewport.js';
import { frameCodons, gcProfile, gcWindowFor, cutsInWindow } from '../core/tracks.js';
import { COMPLEMENT } from '../utils/bioUtils.js';

/** Residues sampled per pixel column at `density` detail. */
const DENSITY_SAMPLES = 3;

/** Shortest feature, in pixels, that gets a label drawn inside it. */
const MIN_LABEL_WIDTH = 34;

/** Width of a feature's arrowhead, in pixels. */
const ARROW_WIDTH = 6;

/**
 * Everything one frame needs.
 *
 * @typedef {Object} RenderModel
 * @property {string} sequence Forward strand, uppercase.
 * @property {'dna'|'rna'|'protein'} type
 * @property {import('../core/viewport.js').ViewLayout} layout
 * @property {import('./trackLayout.js').RowLayout} rowLayout
 * @property {import('./trackLayout.js').TrackFlags} tracks
 * @property {import('../core/types.js').Feature[][]} featureLanes
 * @property {Array<{name: string, positions: number[]}>} cutSites
 * @property {{start: number, end: number}|null} selection Half-open, 0-based.
 * @property {number|null} cursor Caret position, 0-based residue index.
 * @property {number} scrollTop
 * @property {number} width Viewport width in CSS pixels.
 * @property {number} height Viewport height in CSS pixels.
 * @property {import('../core/tracks.js').GcIndex|null} gcIndex Prefix sums for
 *   the GC graph; null while the track is off.
 * @property {import('./theme.js').Palette} palette
 * @property {boolean} [colorResidues=true] Tint residue letters by identity.
 */

/**
 * Paint one frame.
 *
 * @param {CanvasRenderingContext2D} ctx Already scaled for the device pixel ratio.
 * @param {RenderModel} model
 * @returns {void}
 */
export function drawView(ctx, model) {
    const { layout, rowLayout, palette, width, height, scrollTop } = model;

    ctx.save();
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    const firstRow = Math.max(0, Math.floor(scrollTop / rowLayout.rowHeight) - 1);
    const lastRow = Math.min(
        layout.rowCount - 1,
        Math.ceil((scrollTop + height) / rowLayout.rowHeight) + 1
    );

    ctx.textBaseline = 'middle';

    for (let row = firstRow; row <= lastRow; row++) {
        const rowTop = row * rowLayout.rowHeight - scrollTop;
        ctx.save();
        ctx.translate(0, rowTop);
        drawRow(ctx, model, row);
        ctx.restore();
    }

    ctx.restore();
}

/**
 * Paint one wrapped row, with the origin already translated to its top-left.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} row
 * @returns {void}
 */
function drawRow(ctx, model, row) {
    const { sequence, layout, rowLayout, palette } = model;
    const { start, end } = rowRange(row, layout.basesPerRow, sequence.length);
    if (end <= start) return;

    if (row % 2 === 1) {
        ctx.fillStyle = palette.rowAlt;
        ctx.fillRect(0, 0, model.width, rowLayout.rowHeight);
    }

    drawSelection(ctx, model, start, end);

    for (const band of rowLayout.bands) {
        ctx.save();
        ctx.translate(0, band.y);
        switch (band.id) {
            case 'enzymes':
                drawEnzymeBand(ctx, model, start, end, band.height);
                break;
            case 'features':
                drawFeatureLane(ctx, model, start, end, band.height, band.lane ?? 0);
                break;
            case 'ruler':
                drawRuler(ctx, model, start, end, band.height);
                break;
            case 'forward':
                drawStrand(ctx, model, start, end, band.height, 'forward');
                break;
            case 'reverse':
                drawStrand(ctx, model, start, end, band.height, 'reverse');
                break;
            case 'frame+':
                drawFrame(ctx, model, start, end, band.height, band.frame ?? 0, 'forward');
                break;
            case 'frame-':
                drawFrame(ctx, model, start, end, band.height, band.frame ?? 0, 'reverse');
                break;
            case 'gc':
                drawGcGraph(ctx, model, start, end, band.height);
                break;
        }
        ctx.restore();
    }

    drawCursor(ctx, model, start, end);
}

// ---- selection and caret ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start Row's first residue.
 * @param {number} end Row's last residue, exclusive.
 * @returns {void}
 */
function drawSelection(ctx, model, start, end) {
    const sel = model.selection;
    if (!sel || sel.end <= sel.start) return;
    const from = Math.max(sel.start, start);
    const to = Math.min(sel.end, end);
    if (to <= from) return;

    const { layout, rowLayout, palette } = model;
    const x = layout.gutterWidth + (from - start) * layout.charWidth;
    const w = Math.max(1, (to - from) * layout.charWidth);

    ctx.fillStyle = palette.selection;
    ctx.fillRect(x, 0, w, rowLayout.rowHeight - 4);

    // Mark only the true ends of the selection, not the wrap points, so a
    // multi-row selection reads as one block.
    ctx.fillStyle = palette.selectionEdge;
    if (sel.start >= start && sel.start < end) ctx.fillRect(x, 0, 1.5, rowLayout.rowHeight - 4);
    if (sel.end > start && sel.end <= end)
        ctx.fillRect(x + w - 1.5, 0, 1.5, rowLayout.rowHeight - 4);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @returns {void}
 */
function drawCursor(ctx, model, start, end) {
    const { cursor, layout, rowLayout, palette } = model;
    if (cursor == null || cursor < start || cursor > end) return;
    if (model.selection && model.selection.end > model.selection.start) return;
    const x = layout.gutterWidth + (cursor - start) * layout.charWidth;
    ctx.fillStyle = palette.cursor;
    ctx.fillRect(x - 0.5, 0, 1.5, rowLayout.rowHeight - 4);
}

// ---- ruler ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @returns {void}
 */
function drawRuler(ctx, model, start, end, height) {
    const { layout, palette } = model;
    const step = tickStep(layout.charWidth);
    const mid = height / 2;

    ctx.fillStyle = palette.gutter;
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'right';
    ctx.fillText((start + 1).toLocaleString(), layout.gutterWidth - 10, mid);

    ctx.textAlign = 'left';
    ctx.fillStyle = palette.ruler;

    // First tick at or after `start` that lands on a multiple of `step`.
    const firstTick = Math.ceil((start + 1) / step) * step;
    for (let pos = firstTick; pos <= end; pos += step) {
        const x = layout.gutterWidth + (pos - 1 - start) * layout.charWidth;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, height - 4, 1, 4);
        ctx.globalAlpha = 1;
        ctx.fillText(pos.toLocaleString(), x + 3, mid - 1);
    }
}

// ---- residue strands ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {'forward'|'reverse'} strand
 * @returns {void}
 */
function drawStrand(ctx, model, start, end, height, strand) {
    const { layout } = model;
    if (layout.detail === 'density') {
        drawDensityStrand(ctx, model, start, end, height, strand);
        return;
    }
    if (layout.detail === 'blocks') {
        drawBlockStrand(ctx, model, start, end, height, strand);
        return;
    }
    drawLetterStrand(ctx, model, start, end, height, strand);
}

/**
 * @param {RenderModel} model
 * @param {number} index
 * @param {'forward'|'reverse'} strand
 * @returns {string}
 */
function residueAt(model, index, strand) {
    const c = model.sequence[index];
    return strand === 'forward' ? c : COMPLEMENT[c] || 'N';
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {'forward'|'reverse'} strand
 * @returns {void}
 */
function drawLetterStrand(ctx, model, start, end, height, strand) {
    const { layout, palette, type } = model;
    const colored = model.colorResidues !== false;
    const size = Math.min(14, Math.max(9, Math.floor(layout.charWidth * 0.95)));
    ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';

    const mid = height / 2;
    let current = '';

    for (let i = start; i < end; i++) {
        const ch = (residueAt(model, i, strand) || 'N').toUpperCase();
        const color = colored ? residueColor(ch, type, palette) : palette.text;
        if (color !== current) {
            ctx.fillStyle = color;
            current = color;
        }
        const x = layout.gutterWidth + (i - start + 0.5) * layout.charWidth;
        ctx.fillText(ch, x, mid);
    }

    if (strand === 'reverse') {
        ctx.fillStyle = palette.textMuted;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText("3'", layout.gutterWidth - 10, mid);
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {'forward'|'reverse'} strand
 * @returns {void}
 */
function drawBlockStrand(ctx, model, start, end, height, strand) {
    const { layout, palette, type } = model;
    const top = 2;
    const h = height - 4;

    // Merge neighbouring residues that share a colour into a single rectangle.
    let runColor = '';
    let runStart = start;

    for (let i = start; i <= end; i++) {
        const color =
            i < end
                ? residueColor((residueAt(model, i, strand) || 'N').toUpperCase(), type, palette)
                : '';
        if (color !== runColor) {
            if (runColor && i > runStart) {
                ctx.fillStyle = runColor;
                const x = layout.gutterWidth + (runStart - start) * layout.charWidth;
                ctx.fillRect(x, top, (i - runStart) * layout.charWidth, h);
            }
            runColor = color;
            runStart = i;
        }
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {'forward'|'reverse'} strand
 * @returns {void}
 */
function drawDensityStrand(ctx, model, start, end, height, strand) {
    const { layout, palette, type } = model;
    const columns = Math.min(layout.trackWidth, Math.ceil((end - start) * layout.charWidth));
    const perColumn = (end - start) / Math.max(1, columns);
    const top = 3;
    const h = height - 6;

    for (let c = 0; c < columns; c++) {
        const from = start + Math.floor(c * perColumn);
        const to = Math.max(from + 1, start + Math.floor((c + 1) * perColumn));
        // Sample rather than scan: at this zoom a column can span thousands of
        // residues and no individual one is distinguishable.
        const step = Math.max(1, Math.floor((to - from) / DENSITY_SAMPLES));
        /** @type {{[color: string]: number}} */
        const votes = {};
        let best = '';
        let bestCount = 0;
        for (let i = from; i < to && i < end; i += step) {
            const color = residueColor(
                (residueAt(model, i, strand) || 'N').toUpperCase(),
                type,
                palette
            );
            votes[color] = (votes[color] || 0) + 1;
            if (votes[color] > bestCount) {
                bestCount = votes[color];
                best = color;
            }
        }
        if (!best) continue;
        ctx.fillStyle = best;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(layout.gutterWidth + c, top, 1, h);
    }
    ctx.globalAlpha = 1;
}

// ---- reading frames ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {number} frame
 * @param {'forward'|'reverse'} direction
 * @returns {void}
 */
function drawFrame(ctx, model, start, end, height, frame, direction) {
    const { layout, palette } = model;
    const codons = frameCodons(model.sequence, { frame, direction, from: start, to: end });
    const mid = height / 2;
    const showLetters = layout.charWidth * 3 >= 11;

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';

    ctx.fillStyle = palette.textMuted;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(
        `${direction === 'forward' ? '+' : '−'}${frame + 1}`,
        layout.gutterWidth - 10,
        mid
    );
    ctx.restore();

    for (const codon of codons) {
        const from = Math.max(codon.start, start);
        const to = Math.min(codon.end, end);
        if (to <= from) continue;
        const x = layout.gutterWidth + (from - start) * layout.charWidth;
        const w = (to - from) * layout.charWidth;

        if (codon.isStop) {
            ctx.fillStyle = palette.stopCodon;
            ctx.fillRect(x, 1, Math.max(1, w), height - 3);
            if (showLetters) {
                ctx.fillStyle = palette.background;
                ctx.fillText('*', x + w / 2, mid);
            }
            continue;
        }
        if (codon.isStart) {
            ctx.fillStyle = palette.startCodon;
            ctx.globalAlpha = 0.28;
            ctx.fillRect(x, 1, Math.max(1, w), height - 3);
            ctx.globalAlpha = 1;
        }
        if (showLetters) {
            // Centre the letter on the whole codon even when it is clipped by the
            // row edge, so the same codon reads identically on both rows.
            const cx = layout.gutterWidth + (codon.start - start + 1.5) * layout.charWidth;
            ctx.fillStyle = palette.text;
            ctx.fillText(codon.aa, cx, mid);
        }
    }
}

// ---- annotations ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @param {number} lane
 * @returns {void}
 */
function drawFeatureLane(ctx, model, start, end, height, lane) {
    const features = model.featureLanes[lane];
    if (!features) return;
    const { layout, palette } = model;
    const top = 1.5;
    const h = height - 4;

    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';

    for (const feature of features) {
        if (feature.end <= start || feature.start >= end) continue;
        const from = Math.max(feature.start, start);
        const to = Math.min(feature.end, end);
        const x = layout.gutterWidth + (from - start) * layout.charWidth;
        const w = Math.max(2, (to - from) * layout.charWidth);
        const color = featureColor(feature, palette);

        // Draw the arrowhead only on the row that actually holds the feature's
        // 3' end, so a wrapped feature does not sprout a point on every row.
        const pointsRight = feature.direction !== 'reverse';
        const capped = pointsRight ? feature.end <= end : feature.start >= start;
        drawArrow(ctx, x, top, w, h, color, pointsRight, capped);

        const label = feature.name || feature.type;
        if (w >= MIN_LABEL_WIDTH && label) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, top, w - (capped ? ARROW_WIDTH : 0), h);
            ctx.clip();
            ctx.fillStyle = readableOn(color);
            ctx.fillText(label, x + 5, top + h / 2 + 0.5);
            ctx.restore();
        }
    }
}

/**
 * A feature block, pointed at the end the feature reads towards.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 * @param {boolean} pointsRight
 * @param {boolean} capped Draw the arrowhead on this row.
 * @returns {void}
 */
function drawArrow(ctx, x, y, w, h, color, pointsRight, capped) {
    const head = capped ? Math.min(ARROW_WIDTH, w * 0.5) : 0;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    if (pointsRight) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - head, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - head, y + h);
        ctx.lineTo(x, y + h);
    } else {
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + head, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x + head, y + h);
        ctx.lineTo(x + w, y + h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
}

/**
 * Black or white, whichever stays legible on `background`.
 *
 * @param {string} background Any colour `canvas` understands; non-hex inputs
 *   fall back to white, which suits the saturated feature palette.
 * @returns {string}
 */
function readableOn(background) {
    const hex = background.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return '#ffffff';
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    // Rec. 601 luma: cheap, and accurate enough to pick between two extremes.
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#10233a' : '#ffffff';
}

// ---- restriction sites ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @returns {void}
 */
function drawEnzymeBand(ctx, model, start, end, height) {
    const { layout, palette } = model;
    const cuts = cutsInWindow(model.cutSites, start, end);
    if (cuts.length === 0) return;

    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';

    let lastLabelEnd = -Infinity;
    for (const cut of cuts) {
        const x = layout.gutterWidth + (cut.position - start) * layout.charWidth;
        ctx.fillStyle = palette.enzyme;
        ctx.fillRect(x, height - 7, 1, 7);

        // Labels are dropped rather than overlapped: at a dense cut site an
        // unreadable pile of names is worse than a bare tick.
        const width = ctx.measureText(cut.name).width;
        if (x >= lastLabelEnd + 4) {
            ctx.fillText(cut.name, x + 2, height - 12);
            lastLabelEnd = x + width + 2;
        }
    }
}

// ---- GC graph ----

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RenderModel} model
 * @param {number} start
 * @param {number} end
 * @param {number} height
 * @returns {void}
 */
function drawGcGraph(ctx, model, start, end, height) {
    const { layout, palette } = model;
    if (!model.gcIndex) return;
    const top = 4;
    const h = height - 10;
    const trackSpan = (end - start) * layout.charWidth;
    const bins = Math.max(2, Math.min(Math.round(trackSpan), 1200));
    const profile = gcProfile(model.gcIndex, {
        from: start,
        to: end,
        bins,
        window: gcWindowFor(layout.basesPerRow),
    });
    const binWidth = trackSpan / bins;

    ctx.strokeStyle = palette.gcMidline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.gutterWidth, top + h / 2);
    ctx.lineTo(layout.gutterWidth + trackSpan, top + h / 2);
    ctx.stroke();

    // One point per sample rather than a step per bin: the windowed profile is a
    // continuous signal, and drawing it as stairs would imply detail it lacks.
    ctx.beginPath();
    ctx.moveTo(layout.gutterWidth, top + h);
    for (let b = 0; b < bins; b++) {
        const x = layout.gutterWidth + (b + 0.5) * binWidth;
        ctx.lineTo(x, top + h * (1 - clamp(profile[b], 0, 1)));
    }
    ctx.lineTo(layout.gutterWidth + trackSpan, top + h);
    ctx.closePath();
    ctx.fillStyle = palette.gcFill;
    ctx.fill();
    ctx.strokeStyle = palette.gcLine;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = palette.textMuted;
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('GC', layout.gutterWidth - 10, top + h / 2);
}
