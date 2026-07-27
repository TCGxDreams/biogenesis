import { describe, it, expect } from 'vitest';
import {
    calculateDistanceMatrix,
    neighborJoining,
    upgma,
    parseNewick,
    toNewick,
    renderTreeSVG,
} from './phylo.js';

// Two tight pairs: (A,B) and (C,D). Any correct clustering must recover that split.
const SEQS = ['ACGTACGTAA', 'ACGTACGTAT', 'TTTTGGGGCC', 'TTTTGGGGCA'];
const NAMES = ['A', 'B', 'C', 'D'];

const leafNames = node =>
    !node.children || node.children.length === 0 ? [node.name] : node.children.flatMap(leafNames);

/** Names of the leaves under each direct child of the root, as sorted sets. */
const rootClusters = tree => tree.children.map(c => leafNames(c).sort().join('')).sort();

describe('calculateDistanceMatrix', () => {
    it('has a zero diagonal', () => {
        const { matrix } = calculateDistanceMatrix(SEQS, NAMES);
        for (let i = 0; i < matrix.length; i++) expect(matrix[i][i]).toBe(0);
    });

    it('is symmetric', () => {
        const { matrix } = calculateDistanceMatrix(SEQS, NAMES);
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix.length; j++) {
                expect(matrix[i][j]).toBe(matrix[j][i]);
            }
        }
    });

    it('computes distance as 1 - identity', () => {
        // A and B differ at one of ten aligned columns -> 90% identity -> 0.1.
        const { matrix } = calculateDistanceMatrix(SEQS, NAMES);
        expect(matrix[0][1]).toBeCloseTo(0.1, 10);
        expect(matrix[2][3]).toBeCloseTo(0.1, 10);
        expect(matrix[0][2]).toBeGreaterThan(0.5);
    });

    it('gives identical sequences a distance of zero', () => {
        const { matrix } = calculateDistanceMatrix(['ACGTACGT', 'ACGTACGT'], ['X', 'Y']);
        expect(matrix[0][1]).toBe(0);
    });

    it('passes through supplied names', () => {
        expect(calculateDistanceMatrix(SEQS, NAMES).names).toEqual(NAMES);
    });

    it('generates SeqN names when none are supplied', () => {
        expect(calculateDistanceMatrix(SEQS).names).toEqual(['Seq1', 'Seq2', 'Seq3', 'Seq4']);
    });
});

describe('neighborJoining', () => {
    const { matrix } = calculateDistanceMatrix(SEQS, NAMES);

    it('recovers the (A,B)(C,D) topology', () => {
        expect(rootClusters(neighborJoining(matrix, NAMES))).toEqual(['AB', 'CD']);
    });

    it('keeps every input taxon as a leaf exactly once', () => {
        expect(leafNames(neighborJoining(matrix, NAMES)).sort()).toEqual(NAMES);
    });

    it('never emits a negative branch length', () => {
        const collect = n => [n.length ?? 0, ...(n.children || []).flatMap(collect)];
        for (const len of collect(neighborJoining(matrix, NAMES))) {
            expect(len).toBeGreaterThanOrEqual(0);
        }
    });

    it('splits the distance evenly for two taxa', () => {
        expect(
            neighborJoining(
                [
                    [0, 0.4],
                    [0.4, 0],
                ],
                ['A', 'B']
            )
        ).toEqual({
            name: '',
            children: [
                { name: 'A', length: 0.2 },
                { name: 'B', length: 0.2 },
            ],
        });
    });

    it('returns a bare leaf for a single taxon', () => {
        expect(neighborJoining([[0]], ['A'])).toEqual({ name: 'A', length: 0 });
    });
});

describe('upgma', () => {
    const { matrix } = calculateDistanceMatrix(SEQS, NAMES);

    it('recovers the (A,B)(C,D) topology', () => {
        expect(rootClusters(upgma(matrix, NAMES))).toEqual(['AB', 'CD']);
    });

    it('is ultrametric for the tight pairs: both siblings get the same branch length', () => {
        const tree = upgma(matrix, NAMES);
        for (const child of tree.children) {
            if (child.children) {
                expect(child.children[0].length).toBeCloseTo(child.children[1].length, 10);
            }
        }
    });

    it('keeps every input taxon as a leaf exactly once', () => {
        expect(leafNames(upgma(matrix, NAMES)).sort()).toEqual(NAMES);
    });
});

describe('parseNewick / toNewick', () => {
    it('parses names, branch lengths and nesting', () => {
        const tree = parseNewick('((A:0.1,B:0.2):0.3,C:0.4);');
        expect(tree.children).toHaveLength(2);
        expect(tree.children[0].length).toBeCloseTo(0.3, 10);
        expect(tree.children[0].children.map(c => c.name)).toEqual(['A', 'B']);
        expect(tree.children[0].children[0].length).toBeCloseTo(0.1, 10);
        expect(tree.children[1]).toMatchObject({ name: 'C', length: 0.4 });
    });

    it('parses a single leaf', () => {
        expect(parseNewick('A:0.5;')).toMatchObject({ name: 'A', length: 0.5, children: [] });
    });

    it('defaults a missing branch length to 0', () => {
        expect(parseNewick('(A,B);').children[0].length).toBe(0);
    });

    it('serialises to Newick with 4-decimal branch lengths', () => {
        const tree = parseNewick('((A:0.1,B:0.2):0.3,C:0.4);');
        expect(toNewick(tree)).toBe('((A:0.1000,B:0.2000):0.3000,C:0.4000)');
    });

    it('round-trips structure and branch lengths', () => {
        const original = parseNewick('((A:0.125,B:0.25):0.5,(C:0.0625,D:0.75):0.375);');
        const reparsed = parseNewick(toNewick(original) + ';');
        expect(leafNames(reparsed)).toEqual(leafNames(original));
        expect(rootClusters(reparsed)).toEqual(rootClusters(original));
        expect(reparsed.children[0].children[0].length).toBeCloseTo(0.125, 4);
        expect(reparsed.children[1].children[1].length).toBeCloseTo(0.75, 4);
    });

    it('round-trips a neighbour-joining tree', () => {
        const { matrix } = calculateDistanceMatrix(SEQS, NAMES);
        const tree = neighborJoining(matrix, NAMES);
        const reparsed = parseNewick(toNewick(tree) + ';');
        expect(rootClusters(reparsed)).toEqual(['AB', 'CD']);
    });
});

describe('renderTreeSVG', () => {
    // Markup churns; only assert that a well-formed SVG root comes back.
    it('returns a non-empty SVG for a real tree', () => {
        const { matrix } = calculateDistanceMatrix(SEQS, NAMES);
        const svg = renderTreeSVG(neighborJoining(matrix, NAMES));
        expect(svg.length).toBeGreaterThan(0);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    });

    it('escapes HTML-special characters in leaf labels', () => {
        const svg = renderTreeSVG(parseNewick('(<script>:0.1,B:0.2);'));
        expect(svg).not.toContain('<script>');
        expect(svg).toContain('&lt;script&gt;');
    });
});
