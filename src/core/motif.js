// ============================================
// BioGenesis — Motif search (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

/**
 * @typedef {import('./types.js').MotifMatch} MotifMatch
 * @typedef {import('./types.js').MotifSearchResult} MotifSearchResult
 */

/** @type {{[code: string]: string}} */
const IUPAC_TO_REGEX = {
    R: '[AG]',
    Y: '[CT]',
    S: '[GC]',
    W: '[AT]',
    K: '[GT]',
    M: '[AC]',
    B: '[CGT]',
    D: '[AGT]',
    H: '[ACT]',
    V: '[ACG]',
    N: '[ACGT]',
};

/** @type {{[base: string]: string}} */
const COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C', U: 'A' };

const SEARCH_MODES = ['exact', 'regex', 'iupac'];
const STRANDS = ['both', 'forward', 'reverse'];

/**
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} pattern
 * @returns {string}
 */
function iupacToRegex(pattern) {
    return pattern
        .split('')
        .map(c => IUPAC_TO_REGEX[c] || escapeRegex(c))
        .join('');
}

/**
 * Compile a search pattern into a global RegExp according to `mode`.
 *
 * @param {string} pattern
 * @param {'exact'|'regex'|'iupac'} mode
 * @returns {RegExp}
 * @throws {BioError} code `INVALID_PATTERN` when the pattern will not compile.
 */
export function compileMotifPattern(pattern, mode = 'exact') {
    const upper = pattern.toUpperCase();
    const source =
        mode === 'exact' ? escapeRegex(upper) : mode === 'iupac' ? iupacToRegex(upper) : upper;

    try {
        return new RegExp(source, 'g');
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new BioError(`Invalid pattern: ${message}`, 'INVALID_PATTERN');
    }
}

/**
 * @param {string} haystack
 * @param {RegExp} regex
 * @param {(match: RegExpExecArray) => void} onMatch
 * @returns {void}
 */
function scan(haystack, regex, onMatch) {
    const re = new RegExp(regex.source, 'g');
    let m;
    while ((m = re.exec(haystack)) !== null) {
        onMatch(m);
        if (m[0].length === 0) break; // zero-length match would loop forever
    }
}

/**
 * @param {string} seq
 * @returns {string}
 */
function reverseComplement(seq) {
    return seq
        .split('')
        .reverse()
        .map(c => COMPLEMENT[c] || c)
        .join('');
}

/**
 * Find every occurrence of a motif in a sequence.
 *
 * Coordinates are 0-based on the forward strand, for both strands.
 *
 * @param {string} sequence Residues. Case-insensitive.
 * @param {string} pattern The motif to search for.
 * @param {Object} [options]
 * @param {'exact'|'regex'|'iupac'} [options.mode='exact']
 * @param {'both'|'forward'|'reverse'} [options.strand='both']
 * @param {'dna'|'rna'|'protein'} [options.type='dna'] Reverse-strand search is
 *   skipped for protein sequences, which have no complement.
 * @param {number} [options.contextFlank=10] Residues of flanking context to
 *   include with each match.
 * @returns {MotifSearchResult}
 * @throws {BioError} `EMPTY_PATTERN`, `INVALID_MODE`, `INVALID_STRAND`,
 *   `INVALID_PATTERN`.
 */
export function findMotifs(sequence, pattern, options = {}) {
    const { mode = 'exact', strand = 'both', type = 'dna', contextFlank = 10 } = options;

    if (typeof pattern !== 'string' || pattern.length === 0) {
        throw new BioError('Enter a search pattern.', 'EMPTY_PATTERN');
    }
    if (!SEARCH_MODES.includes(mode)) {
        throw new BioError(
            `Unknown search mode "${mode}". Expected one of: ${SEARCH_MODES.join(', ')}.`,
            'INVALID_MODE'
        );
    }
    if (!STRANDS.includes(strand)) {
        throw new BioError(
            `Unknown strand "${strand}". Expected one of: ${STRANDS.join(', ')}.`,
            'INVALID_STRAND'
        );
    }

    const upper = String(sequence || '').toUpperCase();
    const regex = compileMotifPattern(pattern, mode);

    /** @type {MotifMatch[]} */
    const matches = [];

    /**
     * @param {number} position
     * @param {number} length
     */
    const context = (position, length) => ({
        forwardSlice: upper.substring(position, position + length),
        contextBefore: upper.substring(Math.max(0, position - contextFlank), position),
        contextAfter: upper.substring(
            position + length,
            Math.min(upper.length, position + length + contextFlank)
        ),
    });

    if (strand !== 'reverse') {
        scan(upper, regex, m => {
            matches.push({
                position: m.index,
                length: m[0].length,
                match: m[0],
                strand: '+',
                ...context(m.index, m[0].length),
            });
        });
    }

    const hasComplement = type === 'dna' || type === 'rna';
    if (strand !== 'forward' && hasComplement) {
        const revComp = reverseComplement(upper);
        scan(revComp, regex, m => {
            // Map the reverse-strand index back onto forward-strand coordinates.
            const position = upper.length - m.index - m[0].length;
            matches.push({
                position,
                length: m[0].length,
                match: m[0],
                strand: '-',
                ...context(position, m[0].length),
            });
        });
    }

    matches.sort((a, b) => a.position - b.position);

    return {
        matches,
        pattern,
        mode,
        strand,
        sequenceLength: upper.length,
        forwardCount: matches.filter(m => m.strand === '+').length,
        reverseCount: matches.filter(m => m.strand === '-').length,
    };
}
