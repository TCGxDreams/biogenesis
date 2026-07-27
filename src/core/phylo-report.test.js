import { describe, it, expect } from 'vitest';
import { buildTree, MIN_SEQUENCES, DEFAULT_MAX_LENGTH } from './phylo-report.js';
import { BioError } from './errors.js';
import { parseNewick } from '../utils/phylo.js';

// Two tight pairs: (A,B) and (C,D). Any correct method must recover that split.
const TAXA = [
    { name: 'A', sequence: 'ACGTACGTAA' },
    { name: 'B', sequence: 'ACGTACGTAT' },
    { name: 'C', sequence: 'TTTTGGGGCC' },
    { name: 'D', sequence: 'TTTTGGGGCA' },
];

const leafNames = node =>
    !node.children || node.children.length === 0 ? [node.name] : node.children.flatMap(leafNames);

const rootClusters = tree => tree.children.map(c => leafNames(c).sort().join('')).sort();

describe('buildTree — neighbour joining', () => {
    const report = buildTree(TAXA);

    it('defaults to nj', () => {
        expect(report.algorithm).toBe('nj');
    });

    it('recovers the (A,B)(C,D) topology', () => {
        expect(rootClusters(report.tree)).toEqual(['AB', 'CD']);
    });

    it('keeps every taxon as a leaf exactly once', () => {
        expect(leafNames(report.tree).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('returns names in input order', () => {
        expect(report.names).toEqual(['A', 'B', 'C', 'D']);
    });

    it('returns a symmetric distance matrix with a zero diagonal', () => {
        const m = report.distanceMatrix;
        expect(m).toHaveLength(4);
        for (let i = 0; i < 4; i++) {
            expect(m[i][i]).toBe(0);
            for (let j = 0; j < 4; j++) expect(m[i][j]).toBe(m[j][i]);
        }
    });

    it('places the tight pairs closer than the cross pairs', () => {
        const m = report.distanceMatrix;
        expect(m[0][1]).toBeLessThan(m[0][2]);
        expect(m[2][3]).toBeLessThan(m[1][2]);
    });

    it('emits Newick terminated with a semicolon that reparses to the same tree', () => {
        expect(report.newick.endsWith(';')).toBe(true);
        expect(rootClusters(parseNewick(report.newick))).toEqual(['AB', 'CD']);
    });
});

describe('buildTree — UPGMA', () => {
    const report = buildTree(TAXA, { algorithm: 'upgma' });

    it('reports the algorithm it used', () => {
        expect(report.algorithm).toBe('upgma');
    });

    it('recovers the same topology as neighbour joining on this data', () => {
        expect(rootClusters(report.tree)).toEqual(['AB', 'CD']);
    });

    it('produces different branch lengths from neighbour joining', () => {
        // UPGMA is ultrametric, NJ is not, so the serialisations must differ.
        expect(report.newick).not.toBe(buildTree(TAXA, { algorithm: 'nj' }).newick);
    });

    it('is ultrametric: siblings in a cherry get equal branch lengths', () => {
        for (const child of report.tree.children) {
            if (child.children) {
                expect(child.children[0].length).toBeCloseTo(child.children[1].length, 10);
            }
        }
    });

    it('shares the distance matrix with the nj run', () => {
        expect(report.distanceMatrix).toEqual(buildTree(TAXA, { algorithm: 'nj' }).distanceMatrix);
    });
});

describe('buildTree — truncation', () => {
    it('truncates sequences at maxLength before computing distances', () => {
        const long = [
            { name: 'A', sequence: 'ACGT'.repeat(50) + 'GGGGGGGGGG' },
            { name: 'B', sequence: 'ACGT'.repeat(50) + 'TTTTTTTTTT' },
            { name: 'C', sequence: 'ACGT'.repeat(50) + 'AAAAAAAAAA' },
        ];
        // Truncating to the shared prefix makes all three identical.
        const trimmed = buildTree(long, { maxLength: 200 });
        for (const row of trimmed.distanceMatrix) {
            for (const v of row) expect(v).toBe(0);
        }
        // Without truncation the tails differ, so distances are non-zero.
        const full = buildTree(long, { maxLength: 1000 });
        expect(full.distanceMatrix[0][1]).toBeGreaterThan(0);
    });

    it('defaults maxLength to 800', () => {
        expect(DEFAULT_MAX_LENGTH).toBe(800);
    });

    it('tolerates an empty sequence among the taxa', () => {
        const report = buildTree([...TAXA.slice(0, 2), { name: 'E', sequence: '' }]);
        expect(leafNames(report.tree).sort()).toEqual(['A', 'B', 'E']);
    });
});

describe('buildTree — error paths', () => {
    it('requires at least 3 sequences', () => {
        expect(MIN_SEQUENCES).toBe(3);
        for (const set of [[], TAXA.slice(0, 1), TAXA.slice(0, 2), null, undefined]) {
            try {
                buildTree(set);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('TOO_FEW_SEQUENCES');
                expect(e.message).toBe('Need at least 3 sequences.');
            }
        }
    });

    it('accepts exactly 3 sequences', () => {
        expect(leafNames(buildTree(TAXA.slice(0, 3)).tree)).toHaveLength(3);
    });

    it('throws BioError UNKNOWN_ALGORITHM for an unsupported method', () => {
        for (const algorithm of ['ml', 'parsimony', '', null]) {
            try {
                buildTree(TAXA, { algorithm });
                expect.unreachable(`${algorithm} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('UNKNOWN_ALGORITHM');
            }
        }
    });

    it('validates the algorithm before the sequence count', () => {
        try {
            buildTree([], { algorithm: 'bogus' });
        } catch (e) {
            expect(e.code).toBe('UNKNOWN_ALGORITHM');
        }
    });

    it('returns no HTML anywhere in the result', () => {
        expect(JSON.stringify(buildTree(TAXA))).not.toMatch(/<[a-z]/i);
    });
});
