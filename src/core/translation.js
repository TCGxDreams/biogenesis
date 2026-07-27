// ============================================
// BioGenesis — Six-frame translation (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';
import { translate, reverseComplement } from '../utils/bioUtils.js';

/**
 * @typedef {import('./types.js').FrameOrf} FrameOrf
 * @typedef {import('./types.js').Frame} Frame
 * @typedef {import('./types.js').SixFrameResult} SixFrameResult
 */

/** Shortest ORF, in residues, that is reported. */
export const DEFAULT_MIN_ORF_LENGTH = 10;

/** Residues translated for the on-screen view; the export path passes Infinity. */
export const DEFAULT_MAX_LENGTH = 3000;

/**
 * Collect ORFs from a translated frame: an `M` opens one, the next `*` closes it.
 *
 * Nested or overlapping starts are not reported — once open, an ORF runs to the
 * first stop.
 *
 * @param {string} protein
 * @param {string} frameLabel
 * @param {'forward'|'reverse'} direction
 * @param {number} minLength
 * @returns {FrameOrf[]}
 */
export function findFrameOrfs(protein, frameLabel, direction, minLength = DEFAULT_MIN_ORF_LENGTH) {
    const orfs = [];
    let inOrf = false;
    let orfStart = 0;
    for (let i = 0; i < protein.length; i++) {
        if (protein[i] === 'M' && !inOrf) {
            inOrf = true;
            orfStart = i;
        } else if (protein[i] === '*' && inOrf) {
            const length = i - orfStart;
            if (length >= minLength) {
                orfs.push({
                    frame: frameLabel,
                    direction,
                    start: orfStart,
                    end: i,
                    length,
                    protein: protein.substring(orfStart, i + 1),
                });
            }
            inOrf = false;
        }
    }
    return orfs;
}

/**
 * Translate a nucleotide sequence in all six reading frames.
 *
 * @param {string} sequence
 * @param {Object} [options]
 * @param {number} [options.maxLength=3000] Residues translated. Pass `Infinity`
 *   to translate the whole sequence.
 * @param {number} [options.minOrfLength=10] Shortest ORF reported, in residues.
 * @returns {SixFrameResult}
 * @throws {BioError} `INVALID_SEQUENCE`
 */
export function translateSixFrames(sequence, options = {}) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    const { maxLength = DEFAULT_MAX_LENGTH, minOrfLength = DEFAULT_MIN_ORF_LENGTH } = options;

    const upper = sequence.toUpperCase();
    const displayLen = Math.min(upper.length, maxLength);
    const dna = upper.substring(0, displayLen);
    const rcDna = reverseComplement(upper).substring(0, displayLen);

    /** @type {Frame[]} */
    const frames = [];
    /** @type {FrameOrf[]} */
    const orfs = [];

    for (const [
        strand,
        template,
        sign,
    ] of /** @type {Array<['forward'|'reverse', string, string]>} */ ([
        ['forward', dna, '+'],
        ['reverse', rcDna, '-'],
    ])) {
        for (let f = 0; f < 3; f++) {
            const label = `${sign}${f + 1}`;
            const protein = translate(template, f);
            const frameOrfs = findFrameOrfs(protein, label, strand, minOrfLength);
            frames.push({ label, frame: f, protein, direction: strand, orfs: frameOrfs });
            orfs.push(...frameOrfs);
        }
    }

    orfs.sort((a, b) => b.length - a.length);

    return {
        frames,
        orfs,
        dna,
        rcDna,
        sequenceLength: upper.length,
        truncated: upper.length > displayLen,
    };
}
