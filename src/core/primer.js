// ============================================
// BioGenesis — PCR primer design (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';
import { gcContent, calculateTmNN, reverseComplement } from '../utils/bioUtils.js';

/**
 * @typedef {import('./types.js').Primer} Primer
 * @typedef {import('./types.js').PrimerPair} PrimerPair
 */

/** How far outside a target region primers may be placed. */
const TARGET_FLANK = 50;

/** How far into each flank candidate start positions are scanned. */
const SEARCH_SPAN = 300;

/** Acceptable GC content for a candidate primer, as a percentage. */
export const GC_RANGE = { min: 40, max: 60 };

/** Largest Tm difference allowed between the two primers of a pair. */
export const MAX_TM_DIFFERENCE = 5;

/** Smallest gap required between the forward 3' end and the reverse 5' end. */
export const MIN_AMPLICON_GAP = 10;

/** How many pairs are returned. */
export const MAX_PAIRS = 5;

/**
 * Detect a short self-complementary stem, a crude hairpin proxy.
 *
 * @param {string} seq
 * @returns {boolean}
 */
export function checkHairpin(seq) {
    const len = seq.length;
    if (len < 8) return false;
    for (let i = 0; i < len - 6; i++) {
        for (let j = i + 4; j < len - 2; j++) {
            let matches = 0;
            for (let k = 0; k < 3; k++) if (isComplement(seq[i + k], seq[j + 2 - k])) matches++;
            if (matches >= 3) return true;
        }
    }
    return false;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isComplement(a, b) {
    /** @type {{[base: string]: string}} */
    const pairs = { A: 'T', T: 'A', C: 'G', G: 'C' };
    return pairs[a.toUpperCase()] === b.toUpperCase();
}

/**
 * @param {string} pSeq
 * @param {number} minTm
 * @param {number} maxTm
 * @returns {{tm: number, gc: number}|null}
 */
function isAcceptable(pSeq, minTm, maxTm) {
    const tm = calculateTmNN(pSeq);
    if (tm < minTm || tm > maxTm) return null;
    const gc = gcContent(pSeq);
    if (gc < GC_RANGE.min || gc > GC_RANGE.max) return null;
    if (checkHairpin(pSeq)) return null;
    return { tm, gc };
}

/**
 * Design candidate PCR primer pairs across a template.
 *
 * Forward candidates are scanned from the 5' search window and reverse
 * candidates from the 3' window; the first acceptable length is taken at each
 * start position. If no candidate on a side passes the filters, a terminal
 * fallback primer is emitted so the caller always has something to show.
 *
 * @param {string} sequence Template, 5'->3'.
 * @param {Object} [config]
 * @param {number} [config.minLen=18] Shortest primer considered.
 * @param {number} [config.maxLen=24] Longest primer considered.
 * @param {number} [config.minTm=55]
 * @param {number} [config.maxTm=65]
 * @param {number} [config.targetStart] 1-based start of the region to amplify.
 * @param {number} [config.targetEnd] 1-based end of the region to amplify.
 * @returns {{pairs: PrimerPair[], candidates: {forward: Primer[], reverse: Primer[]}}}
 * @throws {BioError} `INVALID_SEQUENCE`, `EMPTY_SEQUENCE`, `INVALID_LENGTH_RANGE`,
 *   `INVALID_TM_RANGE`
 */
export function designPrimers(sequence, config = {}) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    if (sequence.length === 0) {
        throw new BioError('Sequence is empty.', 'EMPTY_SEQUENCE');
    }

    const { minLen = 18, maxLen = 24, minTm = 55, maxTm = 65, targetStart, targetEnd } = config;

    if (!(minLen >= 1) || !(maxLen >= minLen)) {
        throw new BioError(
            'Primer length range is invalid: minLen must be at least 1 and no greater than maxLen.',
            'INVALID_LENGTH_RANGE'
        );
    }
    if (!(maxTm >= minTm)) {
        throw new BioError('Tm range is invalid: minTm must not exceed maxTm.', 'INVALID_TM_RANGE');
    }

    const upper = sequence.toUpperCase();
    const len = upper.length;

    // A target region pushes the search windows outward by TARGET_FLANK, so the
    // primers sit outside the region they amplify.
    const searchStart = targetStart ? Math.max(0, targetStart - 1 - TARGET_FLANK) : 0;
    const searchEnd = targetEnd
        ? Math.min(len, targetEnd + (targetEnd < len ? TARGET_FLANK : 0))
        : len;

    /** @type {Primer[]} */
    const forward = [];
    /** @type {Primer[]} */
    const reverse = [];

    for (let pos = searchStart; pos < Math.min(len, searchStart + SEARCH_SPAN); pos++) {
        for (let pLen = minLen; pLen <= maxLen; pLen++) {
            if (pos + pLen > len) continue;
            const pSeq = upper.substring(pos, pos + pLen);
            const ok = isAcceptable(pSeq, minTm, maxTm);
            if (ok) {
                forward.push({
                    sequence: pSeq,
                    start: pos,
                    end: pos + pLen,
                    tm: ok.tm,
                    gc: ok.gc,
                    direction: 'fwd',
                    hairpin: false,
                });
                break; // one candidate per start position
            }
        }
    }

    const revSearchFloor = targetEnd
        ? Math.max(0, targetEnd - TARGET_FLANK)
        : Math.max(0, len - SEARCH_SPAN);

    for (let pos = searchEnd; pos > revSearchFloor; pos--) {
        for (let pLen = minLen; pLen <= maxLen; pLen++) {
            if (pos - pLen < 0) continue;
            const pSeq = reverseComplement(upper.substring(pos - pLen, pos));
            const ok = isAcceptable(pSeq, minTm, maxTm);
            if (ok) {
                reverse.push({
                    sequence: pSeq,
                    start: pos - pLen,
                    end: pos,
                    tm: ok.tm,
                    gc: ok.gc,
                    direction: 'rev',
                    hairpin: false,
                });
                break;
            }
        }
    }

    // Terminal fallbacks so a template always yields something to inspect.
    if (forward.length === 0 && len >= minLen) {
        const fallSeq = upper.substring(0, minLen);
        forward.push({
            sequence: fallSeq,
            start: 0,
            end: minLen,
            tm: calculateTmNN(fallSeq),
            gc: gcContent(fallSeq),
            hairpin: checkHairpin(fallSeq),
        });
    }
    if (reverse.length === 0 && len >= minLen) {
        const fallSeq = reverseComplement(upper.substring(len - minLen, len));
        reverse.push({
            sequence: fallSeq,
            start: len - minLen,
            end: len,
            tm: calculateTmNN(fallSeq),
            gc: gcContent(fallSeq),
            hairpin: checkHairpin(fallSeq),
        });
    }

    /** @type {PrimerPair[]} */
    const pairs = [];
    for (const f of forward) {
        for (const r of reverse) {
            if (r.start <= f.end + MIN_AMPLICON_GAP) continue;
            const tmDiff = Math.abs(f.tm - r.tm);
            if (tmDiff <= MAX_TM_DIFFERENCE) {
                pairs.push({
                    fwd: f,
                    rev: r,
                    score: tmDiff + Math.abs(50 - f.gc) * 0.1 + Math.abs(50 - r.gc) * 0.1,
                    heterodimer: checkHairpin(f.sequence) || checkHairpin(r.sequence),
                });
            }
        }
    }

    pairs.sort((a, b) => a.score - b.score);

    return { pairs: pairs.slice(0, MAX_PAIRS), candidates: { forward, reverse } };
}
