// ============================================
// BioGenesis — Sequence statistics (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

import {
    gcContent,
    nucleotideComposition,
    molecularWeight,
    meltingTemp,
    findORFs,
} from '../utils/bioUtils.js';

/**
 * @typedef {import('./types.js').SequenceStats} SequenceStats
 * @typedef {import('./types.js').ProteinStats} ProteinStats
 * @typedef {import('./types.js').CodonUsage} CodonUsage
 * @typedef {import('./types.js').GcWindowSeries} GcWindowSeries
 */

/**
 * Kyte–Doolittle hydropathy index, keyed by one-letter residue code.
 * @type {{[residue: string]: number}}
 */
export const AA_HYDROPATHY = {
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

/** Ionisable-group pKa values used by the isoelectric point solver. */
const PKA = { nTerm: 8.0, cTerm: 3.1, K: 10.5, R: 12.5, H: 6.0, D: 3.9, E: 4.1, C: 8.3, Y: 10.1 };

/**
 * Residue groups used for the property breakdown.
 * @type {{[group: string]: string[]}}
 */
export const AA_GROUPS = {
    hydrophobic: ['A', 'I', 'L', 'M', 'F', 'W', 'V', 'P'],
    polar: ['S', 'T', 'Y', 'N', 'Q', 'H', 'C'],
    positive: ['R', 'K'],
    negative: ['D', 'E'],
};

// Instability index dipeptide weights (Guruprasad et al. 1990). Pairs absent
// from the table contribute 1.0.
/** @type {{[dipeptide: string]: number}} */
const II_WEIGHTS = {
    AC: 44.94,
    AP: 20.26,
    RP: 20.26,
    RS: 44.94,
    RW: 58.28,
    CP: 20.26,
    CT: 33.6,
    QE: 20.26,
    FP: 20.26,
    LP: 20.26,
    VP: 20.26,
    SE: 20.26,
    SP: 44.94,
    SS: 20.26,
    TE: 20.26,
    EC: 44.94,
    EE: 33.6,
    EQ: 20.26,
    EI: 20.26,
    EP: 20.26,
    GG: 13.34,
    GW: 13.34,
    PA: 20.26,
    PE: 18.38,
    PM: 67.45,
};

/**
 * Isoelectric point by bisection on the Henderson–Hasselbalch net charge.
 *
 * @param {string} sequence
 * @returns {number} pH at which net charge is zero, in [0, 14].
 */
export function computePI(sequence) {
    const upper = sequence.toUpperCase();
    /** @type {{[residue: string]: number}} */
    const count = {};
    for (const c of upper) count[c] = (count[c] || 0) + 1;
    /** @param {string} k */
    const n = k => count[k] || 0;
    const [nD, nE, nC, nY, nH, nK, nR] = [n('D'), n('E'), n('C'), n('Y'), n('H'), n('K'), n('R')];
    const nTerm = 1;
    const cTerm = 1;

    let lo = 0;
    let hi = 14;
    for (let i = 0; i < 200; i++) {
        const pH = (lo + hi) / 2;
        /** @param {number} pKa */
        const basic = pKa => 1 / (1 + Math.pow(10, pH - pKa));
        /** @param {number} pKa */
        const acidic = pKa => 1 / (1 + Math.pow(10, pKa - pH));
        const charge =
            nTerm * basic(PKA.nTerm) +
            nK * basic(PKA.K) +
            nR * basic(PKA.R) +
            nH * basic(PKA.H) -
            cTerm * acidic(PKA.cTerm) -
            nD * acidic(PKA.D) -
            nE * acidic(PKA.E) -
            nC * acidic(PKA.C) -
            nY * acidic(PKA.Y);
        if (charge > 0) lo = pH;
        else hi = pH;
    }
    return (lo + hi) / 2;
}

/**
 * Grand average of hydropathy (Kyte–Doolittle). Unknown residues are ignored.
 *
 * @param {string} sequence
 * @returns {number} 0 when no scorable residue is present.
 */
export function computeGRAVY(sequence) {
    let sum = 0;
    let count = 0;
    for (const c of sequence.toUpperCase()) {
        if (AA_HYDROPATHY[c] !== undefined) {
            sum += AA_HYDROPATHY[c];
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}

/**
 * Instability index (Guruprasad 1990). Values above 40 suggest an unstable
 * protein.
 *
 * @param {string} sequence
 * @returns {number} NaN for an empty sequence, matching the original formula.
 */
export function instabilityIndex(sequence) {
    const upper = sequence.toUpperCase();
    let ii = 0;
    for (let i = 0; i < upper.length - 1; i++) {
        ii += II_WEIGHTS[upper[i] + upper[i + 1]] || 1.0;
    }
    return (10 / upper.length) * ii;
}

/**
 * Count each A–Z residue in a protein sequence.
 *
 * @param {string} sequence
 * @returns {{[residue: string]: number}}
 */
export function aminoAcidComposition(sequence) {
    /** @type {{[residue: string]: number}} */
    const comp = {};
    for (const c of sequence.toUpperCase()) {
        if (c >= 'A' && c <= 'Z') comp[c] = (comp[c] || 0) + 1;
    }
    return comp;
}

/**
 * GC percentage over a sliding window of fixed size.
 *
 * Characters outside ACGTU are removed before windowing, so `x` coordinates
 * and `sequenceLength` are in filtered-residue space.
 *
 * @param {string} sequence
 * @param {number} [windowSize=50]
 * @returns {GcWindowSeries}
 */
export function computeGcWindow(sequence, windowSize = 50) {
    const upper = sequence.toUpperCase().replace(/[^ACGTU]/g, '');
    const step = Math.max(1, Math.floor(windowSize / 2));
    /** @type {Array<{x: number, y: number}>} */
    const points = [];
    for (let i = 0; i + windowSize <= upper.length; i += step) {
        const win = upper.substring(i, i + windowSize);
        let gc = 0;
        for (const c of win) if (c === 'G' || c === 'C') gc++;
        points.push({ x: i + windowSize / 2, y: (gc / win.length) * 100 });
    }
    return { windowSize, step, sequenceLength: upper.length, points };
}

/**
 * Codon counts in reading frame +1. A trailing partial codon is ignored.
 *
 * @param {string} sequence
 * @param {number} [topN=20]
 * @returns {CodonUsage}
 */
export function computeCodonUsage(sequence, topN = 20) {
    const upper = sequence.toUpperCase();
    /** @type {{[codon: string]: number}} */
    const counts = {};
    for (let i = 0; i + 2 < upper.length; i += 3) {
        const codon = upper.substring(i, i + 3);
        counts[codon] = (counts[codon] || 0) + 1;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN);
    return { counts, total, top };
}

/**
 * Every statistic the Statistics panel displays, in one object.
 *
 * `type` is compared against `'protein'` only; any other value is treated as a
 * nucleic acid, and ORF/codon/GC-window series are produced only for `'dna'`
 * and `'rna'`.
 *
 * @param {string} sequence
 * @param {'dna'|'rna'|'protein'|string} type
 * @param {Object} [options]
 * @param {number} [options.orfMinLength=90]
 * @param {number} [options.codonTopN=20]
 * @param {number} [options.gcWindowMinLength=200] Shortest sequence that gets a
 *   sliding-window GC series.
 * @returns {SequenceStats}
 * @throws {BioError} `INVALID_SEQUENCE` when `sequence` is not a string.
 */
export function computeSequenceStats(sequence, type, options = {}) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    const { orfMinLength = 90, codonTopN = 20, gcWindowMinLength = 200 } = options;

    const length = sequence.length;
    const isProtein = type === 'protein';
    const isNucleic = type === 'dna' || type === 'rna';

    /** @type {SequenceStats} */
    const stats = {
        length,
        type,
        molecularWeight: molecularWeight(sequence, type),
        gc: isProtein ? null : gcContent(sequence),
        meltingTemp: isProtein ? null : meltingTemp(sequence),
        composition: isProtein ? aminoAcidComposition(sequence) : nucleotideComposition(sequence),
        protein: null,
        orfs: null,
        codonUsage: null,
        gcWindow: null,
    };

    if (isProtein) {
        const residues = Object.entries(stats.composition)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);
        const total = residues.reduce((s, [, v]) => s + v, 0);
        /** @param {string} group */
        const sumOf = group =>
            residues.reduce((s, [aa, c]) => s + (AA_GROUPS[group].includes(aa) ? c : 0), 0);
        const groups = {
            hydrophobic: sumOf('hydrophobic'),
            polar: sumOf('polar'),
            positive: sumOf('positive'),
            negative: sumOf('negative'),
            special: 0,
        };
        groups.special =
            total - groups.hydrophobic - groups.polar - groups.positive - groups.negative;

        stats.protein = {
            pI: computePI(sequence),
            gravy: computeGRAVY(sequence),
            instabilityIndex: instabilityIndex(sequence),
            total,
            residues,
            groups,
        };
    }

    if (isNucleic) {
        stats.orfs = findORFs(sequence, orfMinLength);
        if (length >= 3) stats.codonUsage = computeCodonUsage(sequence, codonTopN);
        if (length >= gcWindowMinLength) {
            stats.gcWindow = computeGcWindow(sequence, Math.min(100, Math.floor(length / 10)));
        }
    }

    return stats;
}
