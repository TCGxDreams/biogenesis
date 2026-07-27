// ============================================
// BioGenesis — Sliding-window sequence properties (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

/**
 * @typedef {import('./types.js').PropertySeries} PropertySeries
 */

/**
 * Kyte–Doolittle hydropathy index.
 * @type {{[residue: string]: number}}
 */
const KYTE_DOOLITTLE = {
    A: 1.8,
    R: -4.5,
    N: -3.5,
    D: -3.5,
    C: 2.5,
    E: -3.5,
    Q: -3.5,
    G: -0.4,
    H: -3.2,
    I: 4.5,
    L: 3.8,
    K: -3.9,
    M: 1.9,
    F: 2.8,
    P: -1.6,
    S: -0.8,
    T: -0.7,
    W: -0.9,
    Y: -1.3,
    V: 4.2,
};

/**
 * Normalised B-factor flexibility scale.
 * @type {{[residue: string]: number}}
 */
const FLEXIBILITY = {
    A: 0.36,
    R: 0.53,
    N: 0.46,
    D: 0.51,
    C: 0.35,
    E: 0.5,
    Q: 0.49,
    G: 0.54,
    H: 0.32,
    I: 0.46,
    L: 0.4,
    K: 0.47,
    M: 0.3,
    F: 0.31,
    P: 0.51,
    S: 0.51,
    T: 0.44,
    W: 0.31,
    Y: 0.42,
    V: 0.39,
};

/**
 * Residue masses in daltons.
 * @type {{[residue: string]: number}}
 */
const AA_MW = {
    A: 89.1,
    R: 174.2,
    N: 132.1,
    D: 133.1,
    C: 121.2,
    E: 147.1,
    Q: 146.2,
    G: 75.0,
    H: 155.2,
    I: 131.2,
    L: 131.2,
    K: 146.2,
    M: 149.2,
    F: 165.2,
    P: 115.1,
    S: 105.1,
    T: 119.1,
    W: 204.2,
    Y: 181.2,
    V: 117.1,
};

/**
 * Net charge per residue at pH 7.
 * @type {{[residue: string]: number}}
 */
const AA_CHARGE = {
    A: 0,
    R: 1,
    N: 0,
    D: -1,
    C: 0,
    E: -1,
    Q: 0,
    G: 0,
    H: 0.5,
    I: 0,
    L: 0,
    K: 1,
    M: 0,
    F: 0,
    P: 0,
    S: 0,
    T: 0,
    W: 0,
    Y: 0,
    V: 0,
};

/** Mass used for a residue with no tabulated weight. */
const DEFAULT_RESIDUE_MW = 110;

/** Flexibility used for a residue with no tabulated value. */
const DEFAULT_FLEXIBILITY = 0.4;

/** Longest k-mer counted by the linguistic complexity metric. */
const COMPLEXITY_MAX_K = 3;

/**
 * Every metric this module can compute, with its axis label and unit.
 *
 * @type {{[metric: string]: {label: string, unit: string, appliesTo: 'nucleic'|'protein'}}}
 */
export const METRICS = {
    gc_content: { label: 'GC Content (%)', unit: '%', appliesTo: 'nucleic' },
    at_skew: { label: 'AT Skew (A-T)/(A+T)', unit: '', appliesTo: 'nucleic' },
    gc_skew: { label: 'GC Skew (G-C)/(G+C)', unit: '', appliesTo: 'nucleic' },
    complexity: { label: 'Linguistic Complexity', unit: '', appliesTo: 'nucleic' },
    cpg: { label: 'CpG Observed/Expected', unit: '', appliesTo: 'nucleic' },
    hydrophobicity: { label: 'Hydrophobicity (Kyte-Doolittle)', unit: '', appliesTo: 'protein' },
    charge: { label: 'Net Charge (pH 7)', unit: '', appliesTo: 'protein' },
    molecular_weight: { label: 'Molecular Weight Window Avg', unit: 'Da', appliesTo: 'protein' },
    flexibility: { label: 'Flexibility (B-factor scale)', unit: '', appliesTo: 'protein' },
};

/**
 * @param {string} str
 * @param {string} ch
 * @returns {number}
 */
const countChar = (str, ch) => {
    let n = 0;
    for (const c of str) if (c === ch) n++;
    return n;
};

/**
 * Rough isoelectric point classification from the charged-residue balance.
 *
 * @param {string} sequence
 * @returns {string} One of the three coarse pI bands.
 */
export function estimatePi(sequence) {
    let pos = 0;
    let neg = 0;
    for (const c of sequence) {
        if (c === 'K' || c === 'R') pos++;
        else if (c === 'D' || c === 'E') neg++;
        else if (c === 'H') pos += 0.5;
    }
    if (pos > neg) return '> 7.0 (Basic)';
    if (neg > pos) return '< 7.0 (Acidic)';
    return '~ 7.0 (Neutral)';
}

/**
 * How one metric turns a window into a number, and the whole sequence into its
 * summary figures.
 *
 * @typedef {Object} MetricCalculator
 * @property {(window: string, windowSize: number) => number} window
 * @property {(sequence: string, values: number[]) => Object} [stats]
 */

/**
 * Per-metric window value and whole-sequence stats.
 * @type {{[metric: string]: MetricCalculator}}
 */
const CALCULATORS = {
    gc_content: {
        window: (/** @type {string} */ w, /** @type {number} */ size) =>
            ((countChar(w, 'G') + countChar(w, 'C')) / size) * 100,
        stats: (/** @type {string} */ s) => {
            const totalGc = countChar(s, 'G') + countChar(s, 'C');
            return {
                overallGc: (totalGc / s.length) * 100,
                atGcRatio: (s.length - totalGc) / totalGc,
                length: s.length,
            };
        },
    },
    at_skew: {
        window: (/** @type {string} */ w) => {
            const a = countChar(w, 'A');
            const t = countChar(w, 'T');
            return a + t > 0 ? (a - t) / (a + t) : 0;
        },
    },
    gc_skew: {
        window: (/** @type {string} */ w) => {
            const g = countChar(w, 'G');
            const c = countChar(w, 'C');
            return g + c > 0 ? (g - c) / (g + c) : 0;
        },
    },
    complexity: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            const unique = new Set();
            for (let k = 1; k <= COMPLEXITY_MAX_K; k++) {
                for (let j = 0; j <= w.length - k; j++) unique.add(w.substring(j, j + k));
            }
            return unique.size / size;
        },
    },
    cpg: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            const cg = (w.match(/CG/g) || []).length;
            const expected = (countChar(w, 'C') * countChar(w, 'G')) / size;
            return expected > 0 ? cg / expected : 0;
        },
        stats: (/** @type {string} */ s) => {
            const totalCpG = (s.match(/CG/g) || []).length;
            return { cpgSites: totalCpG, cpgDensityPer100bp: totalCpG / (s.length / 100) };
        },
    },
    hydrophobicity: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            let sum = 0;
            for (const c of w) sum += KYTE_DOOLITTLE[c] || 0;
            return sum / size;
        },
        stats: (/** @type {string} */ s, /** @type {number[]} */ values) => ({
            averageHydrophobicity: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
            length: s.length,
        }),
    },
    charge: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            let sum = 0;
            for (const c of w) sum += AA_CHARGE[c] || 0;
            return sum / size;
        },
        stats: (/** @type {string} */ s) => {
            let total = 0;
            for (const c of s) total += AA_CHARGE[c] || 0;
            return { totalNetCharge: total, isoelectricPoint: estimatePi(s) };
        },
    },
    molecular_weight: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            let sum = 0;
            for (const c of w) sum += AA_MW[c] || DEFAULT_RESIDUE_MW;
            return sum / size;
        },
        stats: (/** @type {string} */ s) => {
            let total = 0;
            for (const c of s) total += AA_MW[c] || DEFAULT_RESIDUE_MW;
            return { totalMw: total, averageResidueMw: total / s.length };
        },
    },
    flexibility: {
        window: (/** @type {string} */ w, /** @type {number} */ size) => {
            let sum = 0;
            for (const c of w) sum += FLEXIBILITY[c] || DEFAULT_FLEXIBILITY;
            return sum / size;
        },
    },
};

/**
 * Compute one property across a sliding window of fixed size.
 *
 * Windows are left-aligned and step by one residue, so a sequence of length `n`
 * with window `w` yields `n - w + 1` values (none when `w > n`).
 *
 * @param {string} sequence
 * @param {string} metric Key of METRICS.
 * @param {number} [windowSize=50]
 * @returns {PropertySeries}
 * @throws {BioError} `INVALID_SEQUENCE`, `UNKNOWN_METRIC`, `INVALID_WINDOW`
 */
export function computeProperty(sequence, metric, windowSize = 50) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    const calc = CALCULATORS[metric];
    if (!calc) {
        throw new BioError(
            `Unknown metric "${metric}". Expected one of: ${Object.keys(METRICS).join(', ')}.`,
            'UNKNOWN_METRIC'
        );
    }
    if (!Number.isFinite(windowSize) || windowSize < 1) {
        throw new BioError('Window size must be a positive number.', 'INVALID_WINDOW');
    }

    const s = sequence.toUpperCase();
    /** @type {number[]} */
    const values = [];
    for (let i = 0; i <= s.length - windowSize; i++) {
        values.push(calc.window(s.substring(i, i + windowSize), windowSize));
    }

    return {
        metric,
        label: METRICS[metric].label,
        unit: METRICS[metric].unit,
        values,
        windowSize,
        stats: calc.stats && s.length > 0 ? calc.stats(s, values) : {},
    };
}

/**
 * Compute several sliding-window properties at once.
 *
 * @param {string} sequence
 * @param {Object} [options]
 * @param {number} [options.windowSize=50]
 * @param {string[]} [options.metrics] Defaults to every metric.
 * @returns {{series: {[metric: string]: PropertySeries}, windowSize: number,
 *   sequenceLength: number}}
 * @throws {BioError} `INVALID_SEQUENCE`, `UNKNOWN_METRIC`, `INVALID_WINDOW`
 */
export function computeSlidingProperties(sequence, options = {}) {
    const { windowSize = 50, metrics = Object.keys(METRICS) } = options;
    /** @type {{[metric: string]: PropertySeries}} */
    const series = {};
    for (const metric of metrics) {
        series[metric] = computeProperty(sequence, metric, windowSize);
    }
    return {
        series,
        windowSize,
        sequenceLength: typeof sequence === 'string' ? sequence.length : 0,
    };
}
