// ============================================
// BioGenesis — Sequence Alignment Algorithms
// ============================================

// BLOSUM62 scoring matrix
/** @type {{[a: string]: {[b: string]: number}}} */
const BLOSUM62_DATA = {
    'A': { 'A': 4, 'R': -1, 'N': -2, 'D': -2, 'C': 0, 'Q': -1, 'E': -1, 'G': 0, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 0, 'W': -3, 'Y': -2, 'V': 0 },
    'R': { 'A': -1, 'R': 5, 'N': 0, 'D': -2, 'C': -3, 'Q': 1, 'E': 0, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 2, 'M': -1, 'F': -3, 'P': -2, 'S': -1, 'T': -1, 'W': -3, 'Y': -2, 'V': -3 },
    'N': { 'A': -2, 'R': 0, 'N': 6, 'D': 1, 'C': -3, 'Q': 0, 'E': 0, 'G': 0, 'H': 1, 'I': -3, 'L': -3, 'K': 0, 'M': -2, 'F': -3, 'P': -2, 'S': 1, 'T': 0, 'W': -4, 'Y': -2, 'V': -3 },
    'D': { 'A': -2, 'R': -2, 'N': 1, 'D': 6, 'C': -3, 'Q': 0, 'E': 2, 'G': -1, 'H': -1, 'I': -3, 'L': -4, 'K': -1, 'M': -3, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -4, 'Y': -3, 'V': -3 },
    'C': { 'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': 9, 'Q': -3, 'E': -4, 'G': -3, 'H': -3, 'I': -1, 'L': -1, 'K': -3, 'M': -1, 'F': -2, 'P': -3, 'S': -1, 'T': -1, 'W': -2, 'Y': -2, 'V': -1 },
    'Q': { 'A': -1, 'R': 1, 'N': 0, 'D': 0, 'C': -3, 'Q': 5, 'E': 2, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 1, 'M': 0, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -2, 'Y': -1, 'V': -2 },
    'E': { 'A': -1, 'R': 0, 'N': 0, 'D': 2, 'C': -4, 'Q': 2, 'E': 5, 'G': -2, 'H': 0, 'I': -3, 'L': -3, 'K': 1, 'M': -2, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2 },
    'G': { 'A': 0, 'R': -2, 'N': 0, 'D': -1, 'C': -3, 'Q': -2, 'E': -2, 'G': 6, 'H': -2, 'I': -4, 'L': -4, 'K': -2, 'M': -3, 'F': -3, 'P': -2, 'S': 0, 'T': -2, 'W': -2, 'Y': -3, 'V': -3 },
    'H': { 'A': -2, 'R': 0, 'N': 1, 'D': -1, 'C': -3, 'Q': 0, 'E': 0, 'G': -2, 'H': 8, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -1, 'P': -2, 'S': -1, 'T': -2, 'W': -2, 'Y': 2, 'V': -3 },
    'I': { 'A': -1, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -3, 'E': -3, 'G': -4, 'H': -3, 'I': 4, 'L': 2, 'K': -3, 'M': 1, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -3, 'Y': -1, 'V': 3 },
    'L': { 'A': -1, 'R': -2, 'N': -3, 'D': -4, 'C': -1, 'Q': -2, 'E': -3, 'G': -4, 'H': -3, 'I': 2, 'L': 4, 'K': -2, 'M': 2, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -2, 'Y': -1, 'V': 1 },
    'K': { 'A': -1, 'R': 2, 'N': 0, 'D': -1, 'C': -3, 'Q': 1, 'E': 1, 'G': -2, 'H': -1, 'I': -3, 'L': -2, 'K': 5, 'M': -1, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2 },
    'M': { 'A': -1, 'R': -1, 'N': -2, 'D': -3, 'C': -1, 'Q': 0, 'E': -2, 'G': -3, 'H': -2, 'I': 1, 'L': 2, 'K': -1, 'M': 5, 'F': 0, 'P': -2, 'S': -1, 'T': -1, 'W': -1, 'Y': -1, 'V': 1 },
    'F': { 'A': -2, 'R': -3, 'N': -3, 'D': -3, 'C': -2, 'Q': -3, 'E': -3, 'G': -3, 'H': -1, 'I': 0, 'L': 0, 'K': -3, 'M': 0, 'F': 6, 'P': -4, 'S': -2, 'T': -2, 'W': 1, 'Y': 3, 'V': -1 },
    'P': { 'A': -1, 'R': -2, 'N': -2, 'D': -1, 'C': -3, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -4, 'P': 7, 'S': -1, 'T': -1, 'W': -4, 'Y': -3, 'V': -2 },
    'S': { 'A': 1, 'R': -1, 'N': 1, 'D': 0, 'C': -1, 'Q': 0, 'E': 0, 'G': 0, 'H': -1, 'I': -2, 'L': -2, 'K': 0, 'M': -1, 'F': -2, 'P': -1, 'S': 4, 'T': 1, 'W': -3, 'Y': -2, 'V': -2 },
    'T': { 'A': 0, 'R': -1, 'N': 0, 'D': -1, 'C': -1, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 5, 'W': -2, 'Y': -2, 'V': 0 },
    'W': { 'A': -3, 'R': -3, 'N': -4, 'D': -4, 'C': -2, 'Q': -2, 'E': -3, 'G': -2, 'H': -2, 'I': -3, 'L': -2, 'K': -3, 'M': -1, 'F': 1, 'P': -4, 'S': -3, 'T': -2, 'W': 11, 'Y': 2, 'V': -3 },
    'Y': { 'A': -2, 'R': -2, 'N': -2, 'D': -3, 'C': -2, 'Q': -1, 'E': -2, 'G': -3, 'H': 2, 'I': -1, 'L': -1, 'K': -2, 'M': -1, 'F': 3, 'P': -3, 'S': -2, 'T': -2, 'W': 2, 'Y': 7, 'V': -1 },
    'V': { 'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -2, 'E': -2, 'G': -3, 'H': -3, 'I': 3, 'L': 1, 'K': -2, 'M': 1, 'F': -1, 'P': -2, 'S': -2, 'T': 0, 'W': -3, 'Y': -1, 'V': 4 }
};

/**
 * Substitution score for one aligned column.
 *
 * @param {string} a
 * @param {string} b
 * @param {boolean} isProtein Score with BLOSUM62 instead of match/mismatch.
 * @returns {number}
 */
function score(a, b, isProtein) {
    if (isProtein) {
        const A = a.toUpperCase(), B = b.toUpperCase();
        return (BLOSUM62_DATA[A] && BLOSUM62_DATA[A][B]) || -1;
    }
    return a.toUpperCase() === b.toUpperCase() ? 2 : -1;
}

// Needleman-Wunsch (Global Alignment)
/**
 * Needleman-Wunsch global alignment.
 *
 * Nucleotides score +2 for a match and -1 for a mismatch; proteins use BLOSUM62.
 *
 * @param {string} seq1
 * @param {string} seq2
 * @param {boolean} [isProtein=false] Score with BLOSUM62 instead.
 * @param {number} [gapPenalty=-2]
 * @returns {import('../core/types.js').PairwiseAlignment}
 */
export function needlemanWunsch(seq1, seq2, isProtein = false, gapPenalty = -2) {
    const m = seq1.length;
    const n = seq2.length;

    // Initialize matrix
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i * gapPenalty;
    for (let j = 0; j <= n; j++) dp[0][j] = j * gapPenalty;

    // Fill matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const match = dp[i - 1][j - 1] + score(seq1[i - 1], seq2[j - 1], isProtein);
            const del = dp[i - 1][j] + gapPenalty;
            const ins = dp[i][j - 1] + gapPenalty;
            dp[i][j] = Math.max(match, del, ins);
        }
    }

    // Traceback
    let alignedSeq1 = '', alignedSeq2 = '';
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + score(seq1[i - 1], seq2[j - 1], isProtein)) {
            alignedSeq1 = seq1[i - 1] + alignedSeq1;
            alignedSeq2 = seq2[j - 1] + alignedSeq2;
            i--; j--;
        } else if (i > 0 && dp[i][j] === dp[i - 1][j] + gapPenalty) {
            alignedSeq1 = seq1[i - 1] + alignedSeq1;
            alignedSeq2 = '-' + alignedSeq2;
            i--;
        } else {
            alignedSeq1 = '-' + alignedSeq1;
            alignedSeq2 = seq2[j - 1] + alignedSeq2;
            j--;
        }
    }

    return {
        aligned1: alignedSeq1,
        aligned2: alignedSeq2,
        score: dp[m][n],
        identity: calculateIdentity(alignedSeq1, alignedSeq2),
        gaps: countGaps(alignedSeq1, alignedSeq2)
    };
}

// Smith-Waterman (Local Alignment)
/**
 * Smith-Waterman local alignment.
 *
 * Returns an empty alignment with score 0 when no positively scoring segment
 * exists.
 *
 * @param {string} seq1
 * @param {string} seq2
 * @param {boolean} [isProtein=false] Score with BLOSUM62 instead.
 * @param {number} [gapPenalty=-2]
 * @returns {import('../core/types.js').PairwiseAlignment} Includes `start1` and
 *   `start2`, the 0-based starts of the local hit.
 */
export function smithWaterman(seq1, seq2, isProtein = false, gapPenalty = -2) {
    const m = seq1.length;
    const n = seq2.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    let maxScore = 0, maxI = 0, maxJ = 0;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const match = dp[i - 1][j - 1] + score(seq1[i - 1], seq2[j - 1], isProtein);
            const del = dp[i - 1][j] + gapPenalty;
            const ins = dp[i][j - 1] + gapPenalty;
            dp[i][j] = Math.max(0, match, del, ins);
            if (dp[i][j] > maxScore) {
                maxScore = dp[i][j];
                maxI = i;
                maxJ = j;
            }
        }
    }

    // Traceback from max score
    let alignedSeq1 = '', alignedSeq2 = '';
    let i = maxI, j = maxJ;
    while (i > 0 && j > 0 && dp[i][j] > 0) {
        if (dp[i][j] === dp[i - 1][j - 1] + score(seq1[i - 1], seq2[j - 1], isProtein)) {
            alignedSeq1 = seq1[i - 1] + alignedSeq1;
            alignedSeq2 = seq2[j - 1] + alignedSeq2;
            i--; j--;
        } else if (dp[i][j] === dp[i - 1][j] + gapPenalty) {
            alignedSeq1 = seq1[i - 1] + alignedSeq1;
            alignedSeq2 = '-' + alignedSeq2;
            i--;
        } else {
            alignedSeq1 = '-' + alignedSeq1;
            alignedSeq2 = seq2[j - 1] + alignedSeq2;
            j--;
        }
    }

    return {
        aligned1: alignedSeq1,
        aligned2: alignedSeq2,
        score: maxScore,
        start1: i, start2: j,
        identity: calculateIdentity(alignedSeq1, alignedSeq2),
        gaps: countGaps(alignedSeq1, alignedSeq2)
    };
}

/**
 * Percent identity over columns where neither row holds a gap.
 *
 * @param {string} aligned1
 * @param {string} aligned2
 * @returns {number} 0-100.
 */
function calculateIdentity(aligned1, aligned2) {
    let matches = 0, total = 0;
    for (let i = 0; i < aligned1.length; i++) {
        if (aligned1[i] !== '-' && aligned2[i] !== '-') {
            total++;
            if (aligned1[i].toUpperCase() === aligned2[i].toUpperCase()) matches++;
        }
    }
    return total > 0 ? (matches / total * 100) : 0;
}

/**
 * Columns where either row holds a gap.
 *
 * @param {string} aligned1
 * @param {string} aligned2
 * @returns {number}
 */
function countGaps(aligned1, aligned2) {
    let gaps = 0;
    for (let i = 0; i < aligned1.length; i++) {
        if (aligned1[i] === '-' || aligned2[i] === '-') gaps++;
    }
    return gaps;
}

// Generate consensus sequence
/**
 * Majority-rule consensus of aligned rows. Gaps are ignored unless a column is
 * entirely gaps, which yields `-`.
 *
 * @param {string[]} alignedSequences Rows of equal length.
 * @returns {string} Uppercase; empty for no input.
 */
export function generateConsensus(alignedSequences) {
    if (alignedSequences.length === 0) return '';
    const len = alignedSequences[0].length;
    let consensus = '';

    for (let i = 0; i < len; i++) {
        /** @type {{[residue: string]: number}} */
        const counts = {};
        for (const seq of alignedSequences) {
            const c = seq[i]?.toUpperCase();
            if (c && c !== '-') {
                counts[c] = (counts[c] || 0) + 1;
            }
        }
        const entries = Object.entries(counts);
        if (entries.length === 0) {
            consensus += '-';
        } else {
            entries.sort((a, b) => b[1] - a[1]);
            consensus += entries[0][0];
        }
    }
    return consensus;
}

// Multiple Sequence Alignment (progressive, simplified)
/**
 * Progressive multiple sequence alignment: each sequence is aligned against the
 * first, and existing rows are re-gapped to match.
 *
 * @param {string[]} sequences
 * @param {boolean} [isProtein=false] Score with BLOSUM62 instead.
 * @returns {string[]} Rows of equal length; stripping gaps recovers the inputs.
 */
export function multipleAlignment(sequences, isProtein = false) {
    if (sequences.length < 2) return sequences.map(s => s);

    // Simple progressive: align first two, then add each subsequent
    let result = [sequences[0]];
    for (let i = 1; i < sequences.length; i++) {
        const ref = result[0]; // align against first
        const aln = needlemanWunsch(ref, sequences[i], isProtein);

        // Re-align all existing sequences with same gap structure
        const newResult = [];
        for (const existing of result) {
            let aligned = '';
            let idx = 0;
            for (let j = 0; j < aln.aligned1.length; j++) {
                if (aln.aligned1[j] === '-') {
                    aligned += '-';
                } else {
                    aligned += existing[idx] || '-';
                    idx++;
                }
            }
            newResult.push(aligned);
        }
        newResult.push(aln.aligned2);
        result = newResult;
    }

    return result;
}
