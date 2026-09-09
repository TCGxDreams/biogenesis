// ============================================
// BioGenesis — Sequence view track data
// ============================================
//
// What each track of the sequence view shows, computed for a residue window and
// returned as plain data. The renderer turns these into pixels; nothing here
// touches the DOM, so every track is unit-testable on its own.
//
// Windows are given in forward-strand coordinates, 0-based, `end` exclusive —
// including the reverse-frame translations, whose codons are reported by the
// forward span they cover rather than by their position in the reverse read.

import { CODON_TABLE, COMPLEMENT } from '../utils/bioUtils.js';

/**
 * One translated codon, positioned on the forward strand.
 *
 * @typedef {Object} CodonCell
 * @property {number} start Forward-strand start, 0-based inclusive.
 * @property {number} end Forward-strand end, exclusive.
 * @property {string} aa Single-letter amino acid, `*` for a stop.
 * @property {number} ordinal 0-based position of this codon within its frame.
 * @property {boolean} isStart Codon translates to methionine from `ATG`.
 * @property {boolean} isStop Codon is a stop.
 */

/**
 * An open reading frame, positioned on the forward strand.
 *
 * @typedef {Object} OrfSpan
 * @property {number} start Forward-strand start, 0-based inclusive.
 * @property {number} end Forward-strand end, exclusive.
 * @property {number} frame 0, 1 or 2.
 * @property {'forward'|'reverse'} direction
 * @property {number} aaLength Residues in the translated product, stop excluded.
 */

/** Frames drawn above the sequence, 5'->3' on the forward strand. */
export const FORWARD_FRAMES = [0, 1, 2];

/** Frames drawn below the sequence, 5'->3' on the reverse strand. */
export const REVERSE_FRAMES = [0, 1, 2];

/**
 * Translate one reading frame across a window.
 *
 * Codons that merely overlap the window are included whole, so a codon straddling
 * the edge of a row is still drawn with its amino acid centred correctly.
 *
 * @param {string} sequence Forward strand, uppercase.
 * @param {Object} options
 * @param {number} options.frame 0, 1 or 2 — the offset from the 5' end of `direction`.
 * @param {'forward'|'reverse'} options.direction Strand being read.
 * @param {number} options.from Window start, forward coordinates, inclusive.
 * @param {number} options.to Window end, forward coordinates, exclusive.
 * @returns {CodonCell[]} In reading order for `direction`, so `ordinal`
 *   ascends. Forward frames therefore ascend by `start` and reverse frames
 *   descend by it.
 */
export function frameCodons(sequence, { frame, direction, from, to }) {
    const len = sequence.length;
    const start = Math.max(0, from);
    const stop = Math.min(len, to);
    if (stop <= start) return [];

    /** @type {CodonCell[]} */
    const cells = [];

    if (direction === 'forward') {
        // Codon `k` occupies [frame + 3k, frame + 3k + 3).
        const firstOrdinal = Math.max(0, Math.floor((start - frame) / 3));
        for (let k = firstOrdinal; ; k++) {
            const cs = frame + 3 * k;
            if (cs >= stop) break;
            if (cs + 3 > len) break;
            if (cs + 3 <= start) continue;
            cells.push(makeCell(sequence.slice(cs, cs + 3), cs, cs + 3, k));
        }
        return cells;
    }

    // Reverse: codon `k` of the reverse read covers forward [len-frame-3k-3, len-frame-3k).
    const firstOrdinal = Math.max(0, Math.floor((len - frame - stop) / 3));
    for (let k = firstOrdinal; ; k++) {
        const ce = len - frame - 3 * k;
        const cs = ce - 3;
        if (ce <= start) break;
        if (cs < 0) break;
        if (cs >= stop) continue;
        cells.push(makeCell(reverseComplementTriplet(sequence, cs), cs, ce, k));
    }
    return cells;
}

/**
 * @param {string} codon
 * @param {number} start
 * @param {number} end
 * @param {number} ordinal
 * @returns {CodonCell}
 */
function makeCell(codon, start, end, ordinal) {
    const aa = CODON_TABLE[codon.toUpperCase()] || 'X';
    return { start, end, aa, ordinal, isStart: codon.toUpperCase() === 'ATG', isStop: aa === '*' };
}

/**
 * The reverse complement of the three bases starting at `pos`, read 5'->3' on
 * the reverse strand.
 *
 * @param {string} sequence
 * @param {number} pos
 * @returns {string}
 */
function reverseComplementTriplet(sequence, pos) {
    return (
        (COMPLEMENT[sequence[pos + 2]] || 'N') +
        (COMPLEMENT[sequence[pos + 1]] || 'N') +
        (COMPLEMENT[sequence[pos]] || 'N')
    ).toUpperCase();
}

/**
 * Open reading frames on both strands.
 *
 * An ORF runs from an `ATG` to the first in-frame stop. Frames are scanned
 * independently, so nested and overlapping ORFs are all reported.
 *
 * @param {string} sequence Forward strand, uppercase.
 * @param {Object} [options]
 * @param {number} [options.minAa=30] Shortest product to report, in residues.
 * @param {boolean} [options.requireStop=true] Drop ORFs running off the end.
 * @returns {OrfSpan[]} Ascending by forward `start`.
 */
export function findOrfSpans(sequence, { minAa = 30, requireStop = true } = {}) {
    const len = sequence.length;
    /** @type {OrfSpan[]} */
    const orfs = [];

    for (const direction of /** @type {const} */ (['forward', 'reverse'])) {
        const read = direction === 'forward' ? sequence : reverseComplementAll(sequence);
        for (const frame of [0, 1, 2]) {
            let openAt = -1;
            for (let i = frame; i + 3 <= len; i += 3) {
                const aa = CODON_TABLE[read.slice(i, i + 3)] || 'X';
                if (openAt < 0 && read.slice(i, i + 3) === 'ATG') {
                    openAt = i;
                } else if (openAt >= 0 && aa === '*') {
                    pushOrf(orfs, read, openAt, i + 3, frame, direction, len, minAa);
                    openAt = -1;
                }
            }
            if (openAt >= 0 && !requireStop) {
                const tail = len - ((len - frame) % 3);
                pushOrf(orfs, read, openAt, tail, frame, direction, len, minAa);
            }
        }
    }

    return orfs.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * @param {OrfSpan[]} out
 * @param {string} read
 * @param {number} readStart
 * @param {number} readEnd
 * @param {number} frame
 * @param {'forward'|'reverse'} direction
 * @param {number} len
 * @param {number} minAa
 * @returns {void}
 */
function pushOrf(out, read, readStart, readEnd, frame, direction, len, minAa) {
    const aaLength = Math.floor((readEnd - readStart) / 3) - 1;
    if (aaLength < minAa) return;
    // Reverse-strand reads are indexed on the reverse complement; flip back so
    // every consumer sees forward coordinates.
    const start = direction === 'forward' ? readStart : len - readEnd;
    const end = direction === 'forward' ? readEnd : len - readStart;
    out.push({ start, end, frame, direction, aaLength });
}

/**
 * @param {string} sequence
 * @returns {string}
 */
function reverseComplementAll(sequence) {
    let out = '';
    for (let i = sequence.length - 1; i >= 0; i--) out += COMPLEMENT[sequence[i]] || 'N';
    return out.toUpperCase();
}

/**
 * Assign features to non-overlapping lanes.
 *
 * Features are placed greedily into the first lane whose last feature ends
 * before this one starts, which keeps the track as shallow as the data allows
 * while preserving left-to-right order within each lane.
 *
 * @param {import('./types.js').Feature[]} features
 * @param {number} [padding=0] Residues of clearance required between neighbours,
 *   so that abutting features do not share a lane and lose their labels.
 * @returns {import('./types.js').Feature[][]} One array per lane, top lane first.
 */
export function packFeatureLanes(features, padding = 0) {
    const sorted = [...features].sort((a, b) => a.start - b.start || b.end - a.end);
    /** @type {import('./types.js').Feature[][]} */
    const lanes = [];
    /** @type {number[]} */
    const laneEnds = [];

    for (const feature of sorted) {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
            if (laneEnds[i] + padding <= feature.start) {
                lanes[i].push(feature);
                laneEnds[i] = feature.end;
                placed = true;
                break;
            }
        }
        if (!placed) {
            lanes.push([feature]);
            laneEnds.push(feature.end);
        }
    }
    return lanes;
}

/**
 * Cumulative GC and scored-residue counts, for the GC graph.
 *
 * @typedef {Object} GcIndex
 * @property {Int32Array} gc `gc[i]` is the number of G/C residues before `i`.
 * @property {Int32Array} scored `scored[i]` is the number of unambiguous
 *   nucleotides before `i`; ambiguity codes are excluded from both.
 * @property {number} length
 */

/**
 * Build the prefix sums the GC graph reads.
 *
 * Computed once per sequence and reused for every frame: with the sums in hand
 * a windowed GC value costs two array reads, which is what keeps the graph
 * affordable at a window size that would otherwise be re-scanned per pixel.
 *
 * @param {string} sequence
 * @returns {GcIndex}
 */
export function buildGcIndex(sequence) {
    const n = sequence.length;
    const gc = new Int32Array(n + 1);
    const scored = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) {
        const c = sequence.charCodeAt(i) & ~32; // uppercase for A-Z
        const isGc = c === 71 || c === 67; // G, C
        const isAt = c === 65 || c === 84 || c === 85; // A, T, U
        gc[i + 1] = gc[i] + (isGc ? 1 : 0);
        scored[i + 1] = scored[i] + (isGc || isAt ? 1 : 0);
    }
    return { gc, scored, length: n };
}

/**
 * A GC window size suited to how much sequence a row shows.
 *
 * Roughly one window per forty pixels of track, clamped to a range that stays
 * biologically meaningful: too small and the curve is noise, too large and it
 * flattens into a straight line.
 *
 * @param {number} residuesInRow
 * @returns {number} Odd window size, in residues.
 */
export function gcWindowFor(residuesInRow) {
    const raw = Math.round(residuesInRow / 40);
    const clamped = Math.min(2001, Math.max(11, raw));
    return clamped % 2 === 0 ? clamped + 1 : clamped;
}

/**
 * GC content sampled across a window, for the graph track.
 *
 * Each sample is the GC fraction of a sliding window centred on that point, so
 * the curve stays smooth at every zoom and joins up across wrapped rows rather
 * than restarting at each row edge. Windows are clipped at the sequence ends.
 *
 * @param {GcIndex} index Built by {@link buildGcIndex}.
 * @param {Object} options
 * @param {number} options.from Window start, inclusive.
 * @param {number} options.to Window end, exclusive.
 * @param {number} options.bins How many samples to produce; at least 1.
 * @param {number} options.window Sliding window size, in residues.
 * @returns {number[]} GC fractions, 0-1. Samples with no scored residues report 0.5.
 */
export function gcProfile(index, { from, to, bins, window }) {
    const n = index.length;
    const start = Math.max(0, from);
    const stop = Math.min(n, to);
    const count = Math.max(1, Math.floor(bins));
    /** @type {number[]} */
    const out = new Array(count).fill(0.5);
    const span = Math.max(0, stop - start);
    if (span === 0) return out;

    const half = Math.floor(Math.max(1, window) / 2);
    for (let b = 0; b < count; b++) {
        const centre = start + Math.floor(((b + 0.5) * span) / count);
        const lo = Math.max(0, centre - half);
        const hi = Math.min(n, centre + half + 1);
        const scored = index.scored[hi] - index.scored[lo];
        out[b] = scored > 0 ? (index.gc[hi] - index.gc[lo]) / scored : 0.5;
    }
    return out;
}

/**
 * Cut positions that fall inside a window, grouped by enzyme.
 *
 * @param {Array<{name: string, positions: number[]}>} sites Enzyme hits, as
 *   returned by the restriction analysis.
 * @param {number} from Window start, inclusive.
 * @param {number} to Window end, exclusive.
 * @returns {Array<{name: string, position: number}>} Ascending by position.
 */
export function cutsInWindow(sites, from, to) {
    /** @type {Array<{name: string, position: number}>} */
    const out = [];
    for (const site of sites) {
        for (const position of site.positions) {
            if (position >= from && position < to) out.push({ name: site.name, position });
        }
    }
    return out.sort((a, b) => a.position - b.position);
}
