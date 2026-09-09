// ============================================
// BioGenesis — Sequence view geometry
// ============================================
//
// Pure layout maths for the interactive sequence view: how a zoom level becomes
// a character width, how many residues fit on a row, and which residue sits
// under a given point. No DOM, no canvas — the renderer and the hit-testing
// code both read their geometry from here so they can never disagree.
//
// Coordinate conventions match core/types.js: residue indices are 0-based,
// ranges are `start` inclusive and `end` exclusive.

/**
 * Narrowest character cell, in CSS pixels.
 *
 * Set low enough that `Fit` puts any sequence this application can realistically
 * hold on a single row: at a ~900px track it spans roughly 90 Mb, well past the
 * point where keeping the residues in a JavaScript string stops being viable.
 */
export const MIN_CHAR_WIDTH = 1e-5;

/** Widest character cell, in CSS pixels. */
export const MAX_CHAR_WIDTH = 20;

/** At or above this character width, residues are drawn as letters. */
export const TEXT_THRESHOLD = 6.5;

/** At or above this character width, residues are drawn as individual blocks. */
export const BLOCK_THRESHOLD = 1.2;

/** Slack, in residues, allowed when deciding how many fit on a row. */
const FIT_EPSILON = 1e-6;

/** Pixels reserved for the coordinate gutter when a caller does not say. */
export const DEFAULT_GUTTER_WIDTH = 72;

/**
 * How the view draws residues at the current zoom.
 *
 * `letters` draws each residue as a glyph, `blocks` as a coloured cell, and
 * `density` aggregates many residues into one pixel column.
 *
 * @typedef {'letters'|'blocks'|'density'} DetailLevel
 */

/**
 * @typedef {Object} ViewLayout
 * @property {number} charWidth Width of one residue cell, in CSS pixels.
 * @property {DetailLevel} detail What the renderer should draw.
 * @property {number} basesPerRow Residues on one wrapped row; at least 1.
 * @property {number} rowCount Rows needed to show the whole sequence.
 * @property {number} trackWidth Pixels available for residues, excluding the gutter.
 * @property {number} gutterWidth Pixels reserved for the coordinate gutter.
 * @property {boolean} singleRow True when the whole sequence fits on one row.
 */

/**
 * Map a 0-1 zoom slider position onto a character width.
 *
 * The mapping is logarithmic so that dragging the slider feels linear across
 * six orders of magnitude of sequence length: the top half of the travel covers
 * residue-level work, the bottom half covers whole-sequence overviews.
 *
 * @param {number} zoom 0 (fully zoomed out) to 1 (fully zoomed in).
 * @returns {number} Character width in CSS pixels.
 */
export function zoomToCharWidth(zoom) {
    const t = clamp(zoom, 0, 1);
    const lo = Math.log(MIN_CHAR_WIDTH);
    const hi = Math.log(MAX_CHAR_WIDTH);
    return Math.exp(lo + (hi - lo) * t);
}

/**
 * Inverse of {@link zoomToCharWidth}.
 *
 * @param {number} charWidth
 * @returns {number} 0-1 slider position.
 */
export function charWidthToZoom(charWidth) {
    const cw = clamp(charWidth, MIN_CHAR_WIDTH, MAX_CHAR_WIDTH);
    const lo = Math.log(MIN_CHAR_WIDTH);
    const hi = Math.log(MAX_CHAR_WIDTH);
    return (Math.log(cw) - lo) / (hi - lo);
}

/**
 * Step the zoom by a multiplicative factor on the character width.
 *
 * Zoom steps must scale the residue size, not the slider position: the slider is
 * logarithmic over six orders of magnitude, so a fixed slider delta would be a
 * hair's movement at one end and a leap across the whole readable range at the
 * other.
 *
 * @param {number} zoom Current 0-1 slider position.
 * @param {number} factor Above 1 zooms in, below 1 zooms out.
 * @returns {number} New 0-1 slider position.
 */
export function zoomByFactor(zoom, factor) {
    return charWidthToZoom(zoomToCharWidth(zoom) * factor);
}

/**
 * The zoom that makes a sequence exactly fill one row.
 *
 * @param {number} length Residues to fit.
 * @param {number} trackWidth Pixels available for residues.
 * @returns {number} 0-1 slider position.
 */
export function zoomToFit(length, trackWidth) {
    if (length <= 0 || trackWidth <= 0) return 0;
    return charWidthToZoom(trackWidth / length);
}

/**
 * Which detail level a character width calls for.
 *
 * @param {number} charWidth
 * @returns {DetailLevel}
 */
export function detailFor(charWidth) {
    if (charWidth >= TEXT_THRESHOLD) return 'letters';
    if (charWidth >= BLOCK_THRESHOLD) return 'blocks';
    return 'density';
}

/**
 * Work out the row geometry for a sequence at a given zoom.
 *
 * At `letters` detail the residues-per-row is rounded down to a multiple of ten
 * so the ruler ticks land on round coordinates, the way a sequence editor's
 * numbering does. Coarser levels use every available pixel instead.
 *
 * @param {Object} options
 * @param {number} options.length Sequence length in residues.
 * @param {number} options.viewportWidth Full width of the view, in CSS pixels.
 * @param {number} options.zoom 0-1 slider position.
 * @param {number} [options.gutterWidth=DEFAULT_GUTTER_WIDTH] Pixels reserved for coordinates.
 * @returns {ViewLayout}
 */
export function computeLayout({ length, viewportWidth, zoom, gutterWidth = DEFAULT_GUTTER_WIDTH }) {
    const charWidth = zoomToCharWidth(zoom);
    const detail = detailFor(charWidth);
    const trackWidth = Math.max(1, viewportWidth - gutterWidth);

    // The epsilon absorbs the float error in a character width derived from
    // `zoomToFit`, which is otherwise a hair too wide and wraps a single residue
    // onto a second row. It is far too small to admit a residue that does not fit.
    let basesPerRow = Math.max(1, Math.floor(trackWidth / charWidth + FIT_EPSILON));
    if (detail === 'letters' && basesPerRow >= 10) {
        basesPerRow = Math.floor(basesPerRow / 10) * 10;
    }
    // Never wrap a sequence that already fits: rounding down to a multiple of
    // ten must not push the tail onto a second row.
    if (basesPerRow < length && trackWidth / charWidth + FIT_EPSILON >= length) {
        basesPerRow = length;
    }

    const rowCount = Math.max(1, Math.ceil(length / basesPerRow));

    return {
        charWidth,
        detail,
        basesPerRow,
        rowCount,
        trackWidth,
        gutterWidth,
        singleRow: rowCount === 1,
    };
}

/**
 * The row a residue falls on.
 *
 * @param {number} index 0-based residue index.
 * @param {number} basesPerRow
 * @returns {number} 0-based row index.
 */
export function rowOfResidue(index, basesPerRow) {
    return Math.floor(index / Math.max(1, basesPerRow));
}

/**
 * The residue range a row covers.
 *
 * @param {number} row 0-based row index.
 * @param {number} basesPerRow
 * @param {number} length Sequence length, used to clip the last row.
 * @returns {{start: number, end: number}} 0-based, `end` exclusive.
 */
export function rowRange(row, basesPerRow, length) {
    const start = row * basesPerRow;
    return { start, end: Math.min(start + basesPerRow, length) };
}

/**
 * Which rows intersect the visible scroll window.
 *
 * One row of overscan is added on each side so a row scrolling into view is
 * already painted.
 *
 * @param {Object} options
 * @param {number} options.scrollTop
 * @param {number} options.viewportHeight
 * @param {number} options.rowHeight Full height of one row, including tracks.
 * @param {number} options.rowCount
 * @returns {{first: number, last: number}} Inclusive row indices.
 */
export function visibleRowRange({ scrollTop, viewportHeight, rowHeight, rowCount }) {
    if (rowHeight <= 0) return { first: 0, last: 0 };
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
    const last = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 1);
    return { first, last: Math.max(first, last) };
}

/**
 * The residue under a point in content coordinates.
 *
 * Points in the gutter clamp to the start of their row, and points past the end
 * of a row clamp to its last residue, so a drag that strays outside the residue
 * track still extends the selection sensibly.
 *
 * @param {Object} options
 * @param {number} options.x Pixels from the left of the content box.
 * @param {number} options.y Pixels from the top of the content box, scroll included.
 * @param {ViewLayout} options.layout
 * @param {number} options.rowHeight
 * @param {number} options.length
 * @returns {number} 0-based residue index, clamped to the sequence.
 */
export function residueAtPoint({ x, y, layout, rowHeight, length }) {
    if (length <= 0) return 0;
    const row = clamp(Math.floor(y / rowHeight), 0, layout.rowCount - 1);
    const col = clamp(
        Math.floor((x - layout.gutterWidth) / layout.charWidth),
        0,
        layout.basesPerRow - 1
    );
    return clamp(row * layout.basesPerRow + col, 0, length - 1);
}

/**
 * Where a residue sits horizontally within its row.
 *
 * @param {number} index 0-based residue index.
 * @param {ViewLayout} layout
 * @returns {number} Pixels from the left of the content box.
 */
export function xOfResidue(index, layout) {
    const col = index % layout.basesPerRow;
    return layout.gutterWidth + col * layout.charWidth;
}

/**
 * Spacing between ruler ticks that keeps labels from colliding.
 *
 * Steps through 1, 2, 5, 10, 20, 50, ... and returns the first that leaves at
 * least `minPixels` between ticks.
 *
 * @param {number} charWidth
 * @param {number} [minPixels=56] Room one coordinate label needs.
 * @returns {number} Tick spacing in residues.
 */
export function tickStep(charWidth, minPixels = 56) {
    const needed = minPixels / Math.max(charWidth, 1e-6);
    let step = 1;
    const mantissas = [1, 2, 5];
    for (let exp = 0; exp < 12; exp++) {
        for (const m of mantissas) {
            step = m * Math.pow(10, exp);
            if (step >= needed) return step;
        }
    }
    return step;
}

/**
 * @param {number} value
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(value, lo, hi) {
    return value < lo ? lo : value > hi ? hi : value;
}
