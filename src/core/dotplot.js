// ============================================
// BioGenesis — Dot matrix comparison (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

/**
 * @typedef {import('./types.js').DotPoint} DotPoint
 * @typedef {import('./types.js').DotMatrixDimensions} DotMatrixDimensions
 * @typedef {import('./types.js').DotMatrix} DotMatrix
 */

/** Longest prefix of each sequence that is compared, to bound the O(n·m) scan. */
export const DEFAULT_MAX_LENGTH = 800;

/** Target number of sampled positions along each axis. */
const TARGET_SAMPLES = 300;

/**
 * Build a dot matrix comparing two sequences.
 *
 * Both sequences are truncated to `maxLength` and sampled on a stride chosen so
 * that roughly `TARGET_SAMPLES` positions are tested per axis, which keeps the
 * scan bounded regardless of input size.
 *
 * @param {string} seqA Residues for the horizontal axis.
 * @param {string} seqB Residues for the vertical axis.
 * @param {Object} [options]
 * @param {number} [options.windowSize=10] Residues compared per test.
 * @param {number} [options.threshold=70] Percent identity a window must reach.
 * @param {number} [options.maxLength=800]
 * @returns {DotMatrix}
 * @throws {BioError} `EMPTY_SEQUENCE`, `INVALID_WINDOW`, `INVALID_THRESHOLD`.
 */
export function computeDotMatrix(seqA, seqB, options = {}) {
    const { windowSize = 10, threshold = 70, maxLength = DEFAULT_MAX_LENGTH } = options;

    if (!Number.isFinite(windowSize) || windowSize < 1) {
        throw new BioError('Window size must be a positive number.', 'INVALID_WINDOW');
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
        throw new BioError('Threshold must be between 0 and 100.', 'INVALID_THRESHOLD');
    }

    const a = String(seqA || '')
        .toUpperCase()
        .substring(0, maxLength);
    const b = String(seqB || '')
        .toUpperCase()
        .substring(0, maxLength);
    const lengthA = a.length;
    const lengthB = b.length;

    if (lengthA === 0 || lengthB === 0) {
        throw new BioError('Sequences are empty', 'EMPTY_SEQUENCE');
    }

    const stepA = Math.max(1, Math.floor(lengthA / TARGET_SAMPLES));
    const stepB = Math.max(1, Math.floor(lengthB / TARGET_SAMPLES));
    const thresholdCount = Math.ceil((windowSize * threshold) / 100);

    /** @type {DotPoint[]} */
    const points = [];
    for (let i = 0; i <= lengthA - windowSize; i += stepA) {
        for (let j = 0; j <= lengthB - windowSize; j += stepB) {
            let matches = 0;
            for (let k = 0; k < windowSize; k++) {
                if (a[i + k] === b[j + k]) matches++;
            }
            if (matches >= thresholdCount) {
                points.push({ x: i, y: j, matches, identity: matches / windowSize });
            }
        }
    }

    return {
        points,
        dimensions: {
            lengthA,
            lengthB,
            truncatedA: String(seqA || '').length > maxLength,
            truncatedB: String(seqB || '').length > maxLength,
            windowSize,
            threshold,
            thresholdCount,
            stepA,
            stepB,
        },
    };
}
