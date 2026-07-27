// ============================================
// BioGenesis — Phylogenetic tree reports (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';
import { calculateDistanceMatrix, neighborJoining, upgma, toNewick } from '../utils/phylo.js';

/**
 * @typedef {import('./types.js').TreeNode} TreeNode
 * @typedef {import('./types.js').TreeReport} TreeReport
 */

/** Longest prefix of each sequence used for the distance matrix. */
export const DEFAULT_MAX_LENGTH = 800;

/** Fewest taxa that make a tree meaningful. */
export const MIN_SEQUENCES = 3;

const ALGORITHMS = ['nj', 'upgma'];

/**
 * Infer a phylogenetic tree from a set of named sequences.
 *
 * Sequences are truncated to `maxLength` before the pairwise distances are
 * computed, because the underlying alignment is quadratic.
 *
 * @param {Array<{name: string, sequence: string}>} sequences
 * @param {Object} [options]
 * @param {'nj'|'upgma'} [options.algorithm='nj']
 * @param {number} [options.maxLength=800]
 * @returns {TreeReport}
 * @throws {BioError} `TOO_FEW_SEQUENCES`, `UNKNOWN_ALGORITHM`
 */
export function buildTree(sequences, options = {}) {
    const { algorithm = 'nj', maxLength = DEFAULT_MAX_LENGTH } = options;
    const list = Array.isArray(sequences) ? sequences : [];

    if (!ALGORITHMS.includes(algorithm)) {
        throw new BioError(
            `Unknown algorithm "${algorithm}". Expected one of: ${ALGORITHMS.join(', ')}.`,
            'UNKNOWN_ALGORITHM'
        );
    }
    if (list.length < MIN_SEQUENCES) {
        throw new BioError('Need at least 3 sequences.', 'TOO_FEW_SEQUENCES');
    }

    const names = list.map(s => s.name);
    const trimmed = list.map(s => String(s.sequence || '').substring(0, maxLength));

    const { matrix } = calculateDistanceMatrix(trimmed, names);
    const tree = algorithm === 'upgma' ? upgma(matrix, names) : neighborJoining(matrix, names);

    return {
        tree,
        newick: toNewick(tree) + ';',
        distanceMatrix: matrix,
        names,
        algorithm,
    };
}
