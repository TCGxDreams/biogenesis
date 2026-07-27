// ============================================
// BioGenesis — Alignment reports (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

/**
 * @typedef {import('./types.js').AlignmentResult} AlignmentResult
 * @typedef {import('./types.js').AlignmentReport} AlignmentReport
 */

import {
    needlemanWunsch,
    smithWaterman,
    multipleAlignment,
    generateConsensus,
} from '../utils/alignment.js';

/** Longest prefix of each sequence that is aligned, to bound the O(n·m) matrices. */
export const DEFAULT_MAX_LENGTH = 3000;

const PAIRWISE_ALGORITHMS = ['nw', 'sw'];
const ALGORITHMS = ['msa', ...PAIRWISE_ALGORITHMS];

/**
 * Build the `|`/space match line for two aligned rows.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function buildMatchLine(a, b) {
    let line = '';
    for (let i = 0; i < a.length; i++) {
        const same =
            a[i] !== '-' && b[i] !== '-' && a[i].toUpperCase() === (b[i] || '').toUpperCase();
        line += same ? '|' : ' ';
    }
    return line;
}

/**
 * Align two sequences globally (`nw`) or locally (`sw`).
 *
 * @param {string} seqA
 * @param {string} seqB
 * @param {Object} [options]
 * @param {'nw'|'sw'} [options.algorithm='nw']
 * @param {boolean} [options.isProtein=false] Score with BLOSUM62 instead of
 *   the nucleotide match/mismatch scheme.
 * @param {number} [options.gapPenalty=-2]
 * @param {number} [options.maxLength=3000]
 * @returns {AlignmentResult}
 * @throws {BioError} `UNKNOWN_ALGORITHM`
 */
export function alignPair(seqA, seqB, options = {}) {
    const {
        algorithm = 'nw',
        isProtein = false,
        gapPenalty = -2,
        maxLength = DEFAULT_MAX_LENGTH,
    } = options;

    if (!PAIRWISE_ALGORITHMS.includes(algorithm)) {
        throw new BioError(
            `Unknown pairwise algorithm "${algorithm}". Expected one of: ${PAIRWISE_ALGORITHMS.join(', ')}.`,
            'UNKNOWN_ALGORITHM'
        );
    }

    const a = String(seqA || '').substring(0, maxLength);
    const b = String(seqB || '').substring(0, maxLength);
    const res =
        algorithm === 'nw'
            ? needlemanWunsch(a, b, isProtein, gapPenalty)
            : smithWaterman(a, b, isProtein, gapPenalty);

    return {
        alignedA: res.aligned1,
        alignedB: res.aligned2,
        score: res.score,
        identity: res.identity,
        gaps: res.gaps,
        matchLine: buildMatchLine(res.aligned1, res.aligned2),
        length: res.aligned1.length,
        algorithm,
        startA: algorithm === 'sw' ? (res.start1 ?? null) : null,
        startB: algorithm === 'sw' ? (res.start2 ?? null) : null,
    };
}

/**
 * Per-column conservation of an aligned block.
 *
 * A column's score is the number of rows matching the consensus residue divided
 * by the *total* row count, so gapped rows dilute the score. Columns whose
 * consensus is a gap score 0.
 *
 * @param {string[]} rows Aligned rows, all the same length.
 * @param {string} consensus
 * @returns {number[]} One value per consensus column, in [0, 1].
 */
export function computeConservation(rows, consensus) {
    const conservation = [];
    for (let i = 0; i < consensus.length; i++) {
        const consChar = consensus[i];
        if (consChar === '-') {
            conservation.push(0);
            continue;
        }
        let matchCount = 0;
        let validCount = 0;
        for (const row of rows) {
            if (row[i] !== '-') {
                validCount++;
                if (row[i].toUpperCase() === consChar.toUpperCase()) matchCount++;
            }
        }
        conservation.push(validCount > 0 ? matchCount / rows.length : 0);
    }
    return conservation;
}

/**
 * Align two or more named sequences and derive everything the alignment view
 * displays: aligned rows, consensus, per-column conservation, and — for the
 * pairwise algorithms — score, identity and gap counts.
 *
 * @param {Array<{name: string, sequence: string, type?: string}>} entries
 * @param {Object} [options]
 * @param {'msa'|'nw'|'sw'} [options.algorithm='msa']
 * @param {number} [options.maxLength=3000]
 * @param {boolean} [options.isProtein] Defaults to true when any entry is a
 *   protein.
 * @returns {AlignmentReport}
 * @throws {BioError} `TOO_FEW_SEQUENCES`, `PAIRWISE_TOO_MANY_SEQUENCES`,
 *   `UNKNOWN_ALGORITHM`
 */
export function buildAlignmentReport(entries, options = {}) {
    const { algorithm = 'msa', maxLength = DEFAULT_MAX_LENGTH } = options;
    const list = Array.isArray(entries) ? entries : [];

    if (!ALGORITHMS.includes(algorithm)) {
        throw new BioError(
            `Unknown algorithm "${algorithm}". Expected one of: ${ALGORITHMS.join(', ')}.`,
            'UNKNOWN_ALGORITHM'
        );
    }
    if (list.length < 2) {
        throw new BioError('Please select at least 2 sequences.', 'TOO_FEW_SEQUENCES');
    }
    if (PAIRWISE_ALGORITHMS.includes(algorithm) && list.length > 2) {
        throw new BioError(
            'Needleman-Wunsch and Smith-Waterman only support 2 sequences.',
            'PAIRWISE_TOO_MANY_SEQUENCES'
        );
    }

    const isProtein =
        options.isProtein !== undefined ? options.isProtein : list.some(s => s.type === 'protein');

    const truncated = list.map(s => ({
        name: s.name,
        sequence: String(s.sequence || '').substring(0, maxLength),
    }));

    /** @type {string[]} */
    let aligned;
    /** @type {AlignmentResult|null} */
    let pairwise = null;

    if (algorithm === 'msa') {
        aligned = multipleAlignment(
            truncated.map(s => s.sequence),
            isProtein
        );
    } else {
        pairwise = alignPair(truncated[0].sequence, truncated[1].sequence, {
            algorithm,
            isProtein,
            maxLength,
        });
        aligned = [pairwise.alignedA, pairwise.alignedB];
    }

    const consensus = generateConsensus(aligned);

    return {
        algorithm,
        isProtein,
        rows: truncated.map((s, i) => ({ name: s.name, aligned: aligned[i] })),
        consensus,
        conservation: computeConservation(aligned, consensus),
        length: aligned[0].length,
        pairwise,
    };
}
