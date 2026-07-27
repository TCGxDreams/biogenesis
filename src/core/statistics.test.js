import { describe, it, expect } from 'vitest';
import {
    computeSequenceStats,
    computePI,
    computeGRAVY,
    instabilityIndex,
    aminoAcidComposition,
    computeGcWindow,
    computeCodonUsage,
    AA_HYDROPATHY,
} from './statistics.js';
import { BioError } from './errors.js';
import { SAMPLE_SEQUENCES } from '../data/sampleSequences.js';

const pUC19 = SAMPLE_SEQUENCES.find(s => s.name === 'pUC19');

describe('computePI', () => {
    it('returns a neutral-ish pI for a sequence with no ionisable side chains', () => {
        // Only the free N- and C-termini titrate: pI = (8.0 + 3.1) / 2.
        expect(computePI('AAAA')).toBeCloseTo(5.55, 2);
    });

    it('shifts basic for a lysine/arginine-rich peptide', () => {
        expect(computePI('KKKRRR')).toBeGreaterThan(10);
    });

    it('shifts acidic for an aspartate/glutamate-rich peptide', () => {
        expect(computePI('DDDEEE')).toBeLessThan(4.5);
    });

    it('orders basic > neutral > acidic', () => {
        expect(computePI('KKKK')).toBeGreaterThan(computePI('AAAA'));
        expect(computePI('AAAA')).toBeGreaterThan(computePI('DDDD'));
    });

    it('stays inside the 0-14 search range', () => {
        for (const seq of ['', 'KKKKKKKKKK', 'DDDDDDDDDD', 'MKWVTFISLL']) {
            const pI = computePI(seq);
            expect(pI).toBeGreaterThanOrEqual(0);
            expect(pI).toBeLessThanOrEqual(14);
        }
    });

    it('is case insensitive', () => {
        expect(computePI('kkkrrr')).toBeCloseTo(computePI('KKKRRR'), 10);
    });
});

describe('computeGRAVY', () => {
    it('returns the hydropathy value itself for a single residue', () => {
        expect(computeGRAVY('I')).toBeCloseTo(AA_HYDROPATHY.I, 10);
        expect(computeGRAVY('R')).toBeCloseTo(AA_HYDROPATHY.R, 10);
    });

    it('averages over the sequence', () => {
        // (4.5 + -4.5) / 2
        expect(computeGRAVY('IR')).toBeCloseTo(0, 10);
    });

    it('ignores residues with no hydropathy value', () => {
        expect(computeGRAVY('IXXZ')).toBeCloseTo(AA_HYDROPATHY.I, 10);
    });

    it('returns 0 when nothing is scorable', () => {
        expect(computeGRAVY('')).toBe(0);
        expect(computeGRAVY('XXXX')).toBe(0);
    });

    it('scores a hydrophobic stretch above a charged one', () => {
        expect(computeGRAVY('IIVVLL')).toBeGreaterThan(computeGRAVY('RRKKDD'));
    });
});

describe('instabilityIndex', () => {
    it('applies weight 1.0 to dipeptides absent from the table', () => {
        // 'AAAA' -> 3 dipeptides at 1.0 each, times 10/4.
        expect(instabilityIndex('AAAA')).toBeCloseTo((10 / 4) * 3, 10);
    });

    it('applies the tabulated weight to a known destabilising dipeptide', () => {
        // 'PM' = 67.45, the heaviest entry.
        expect(instabilityIndex('PM')).toBeCloseTo((10 / 2) * 67.45, 10);
    });

    it('sums mixed dipeptides', () => {
        // 'AC' = 44.94, 'CP' = 20.26 -> (10/3) * 65.2
        expect(instabilityIndex('ACP')).toBeCloseTo((10 / 3) * 65.2, 8);
    });

    it('returns 0 for a single residue (no dipeptides)', () => {
        expect(instabilityIndex('M')).toBe(0);
    });

    it('returns NaN for an empty sequence (division by zero)', () => {
        expect(Number.isNaN(instabilityIndex(''))).toBe(true);
    });

    it('is case insensitive', () => {
        expect(instabilityIndex('acp')).toBeCloseTo(instabilityIndex('ACP'), 10);
    });
});

describe('aminoAcidComposition', () => {
    it('counts each residue', () => {
        expect(aminoAcidComposition('MKKM')).toEqual({ M: 2, K: 2 });
    });

    it('uppercases before counting', () => {
        expect(aminoAcidComposition('mKkM')).toEqual({ M: 2, K: 2 });
    });

    it('counts any A-Z letter, including non-standard residues', () => {
        expect(aminoAcidComposition('MXB')).toEqual({ M: 1, X: 1, B: 1 });
    });

    it('ignores non-letters', () => {
        expect(aminoAcidComposition('M-K*1 M')).toEqual({ M: 2, K: 1 });
    });

    it('returns an empty object for an empty sequence', () => {
        expect(aminoAcidComposition('')).toEqual({});
    });
});

describe('computeGcWindow', () => {
    it('computes GC percentage per window with a half-window step', () => {
        const series = computeGcWindow('GGGGAAAA', 4);
        expect(series.step).toBe(2);
        expect(series.sequenceLength).toBe(8);
        expect(series.points).toEqual([
            { x: 2, y: 100 },
            { x: 4, y: 50 },
            { x: 6, y: 0 },
        ]);
    });

    it('strips characters outside ACGTU before windowing', () => {
        const series = computeGcWindow('GG--NN--GG', 4);
        expect(series.sequenceLength).toBe(4);
        expect(series.points).toEqual([{ x: 2, y: 100 }]);
    });

    it('returns no points when the sequence is shorter than the window', () => {
        expect(computeGcWindow('ACG', 10).points).toEqual([]);
    });

    it('never steps by less than 1', () => {
        expect(computeGcWindow('ACGT', 1).step).toBe(1);
    });

    it('reports midpoints that stay inside the filtered sequence', () => {
        const series = computeGcWindow(pUC19.sequence, 100);
        expect(series.points.length).toBeGreaterThan(0);
        for (const p of series.points) {
            expect(p.x).toBeGreaterThan(0);
            expect(p.x).toBeLessThanOrEqual(series.sequenceLength);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(100);
        }
    });
});

describe('computeCodonUsage', () => {
    it('counts codons in frame +1', () => {
        const usage = computeCodonUsage('ATGATGAAA');
        expect(usage.counts).toEqual({ ATG: 2, AAA: 1 });
        expect(usage.total).toBe(3);
    });

    it('ignores a trailing partial codon', () => {
        expect(computeCodonUsage('ATGAT').counts).toEqual({ ATG: 1 });
    });

    it('sorts `top` most frequent first and honours topN', () => {
        const usage = computeCodonUsage('AAAAAACCCGGG', 2);
        expect(usage.top).toEqual([
            ['AAA', 2],
            ['CCC', 1],
        ]);
    });

    it('uppercases before counting', () => {
        expect(computeCodonUsage('atgatg').counts).toEqual({ ATG: 2 });
    });

    it('returns zero totals for a sequence shorter than one codon', () => {
        expect(computeCodonUsage('AT')).toEqual({ counts: {}, total: 0, top: [] });
    });

    it('counts every codon of a real sequence exactly once', () => {
        const usage = computeCodonUsage(pUC19.sequence);
        expect(usage.total).toBe(Math.floor(pUC19.sequence.length / 3));
    });
});

describe('computeSequenceStats — nucleic acid', () => {
    const stats = computeSequenceStats(pUC19.sequence, 'dna');

    it('reports length, GC, Tm and molecular weight', () => {
        expect(stats.length).toBe(2622);
        expect(stats.gc).toBeGreaterThan(40);
        expect(stats.gc).toBeLessThan(60);
        expect(stats.meltingTemp).toBeGreaterThan(60);
        expect(stats.molecularWeight).toBeGreaterThan(800000);
    });

    it('returns a nucleotide composition summing to the sequence length', () => {
        const { A, T, C, G, U, other } = stats.composition;
        expect(A + T + C + G + U + other).toBe(stats.length);
    });

    it('has no protein block', () => {
        expect(stats.protein).toBeNull();
    });

    it('finds ORFs at the default 90 bp floor', () => {
        expect(Array.isArray(stats.orfs)).toBe(true);
        for (const orf of stats.orfs) expect(orf.length).toBeGreaterThanOrEqual(90);
    });

    it('honours a custom orfMinLength', () => {
        const loose = computeSequenceStats(pUC19.sequence, 'dna', { orfMinLength: 30 });
        expect(loose.orfs.length).toBeGreaterThanOrEqual(stats.orfs.length);
    });

    it('includes codon usage and a GC window series', () => {
        expect(stats.codonUsage.total).toBe(874);
        expect(stats.gcWindow.windowSize).toBe(100); // min(100, floor(2622/10))
        expect(stats.gcWindow.points.length).toBeGreaterThan(0);
    });

    it('caps the GC window at 100 bp but scales down for short sequences', () => {
        const seq = 'ATGCATGCGC'.repeat(30); // 300 bp
        expect(computeSequenceStats(seq, 'dna').gcWindow.windowSize).toBe(30);
    });

    it('omits the GC window below the 200 bp threshold', () => {
        expect(computeSequenceStats('ATGCATGCAT'.repeat(19), 'dna').gcWindow).toBeNull();
        expect(computeSequenceStats('ATGCATGCAT'.repeat(20), 'dna').gcWindow).not.toBeNull();
    });

    it('omits codon usage below 3 residues', () => {
        expect(computeSequenceStats('AT', 'dna').codonUsage).toBeNull();
        expect(computeSequenceStats('ATG', 'dna').codonUsage).not.toBeNull();
    });

    it('handles RNA the same way as DNA', () => {
        const rna = computeSequenceStats('AUGCAUGCAU'.repeat(25), 'rna');
        expect(rna.orfs).not.toBeNull();
        expect(rna.codonUsage).not.toBeNull();
        expect(rna.gc).toBeGreaterThan(0);
    });
});

describe('computeSequenceStats — protein', () => {
    const seq = 'MKWVTFISLLLLFSSAYSRGVFRRDAHKSEVAHRFKDLGEENFKALVLIAFAQYLQQCPF';
    const stats = computeSequenceStats(seq, 'protein');

    it('nulls the nucleic-acid-only fields', () => {
        expect(stats.gc).toBeNull();
        expect(stats.meltingTemp).toBeNull();
        expect(stats.orfs).toBeNull();
        expect(stats.codonUsage).toBeNull();
        expect(stats.gcWindow).toBeNull();
    });

    it('reports pI, GRAVY and instability index', () => {
        expect(stats.protein.pI).toBeGreaterThan(0);
        expect(stats.protein.pI).toBeLessThan(14);
        expect(stats.protein.gravy).toBeCloseTo(computeGRAVY(seq), 10);
        expect(stats.protein.instabilityIndex).toBeCloseTo(instabilityIndex(seq), 10);
    });

    it('sorts residues most frequent first', () => {
        const counts = stats.protein.residues.map(([, c]) => c);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    it('has property groups that partition the residue total', () => {
        const g = stats.protein.groups;
        expect(g.hydrophobic + g.polar + g.positive + g.negative + g.special).toBe(
            stats.protein.total
        );
        expect(g.special).toBeGreaterThanOrEqual(0);
    });

    it('counts glycine as special', () => {
        const only = computeSequenceStats('GGGG', 'protein');
        expect(only.protein.groups).toEqual({
            hydrophobic: 0,
            polar: 0,
            positive: 0,
            negative: 0,
            special: 4,
        });
    });

    it('assigns each group correctly for a one-of-each peptide', () => {
        const g = computeSequenceStats('AKDSG', 'protein').protein.groups;
        expect(g).toEqual({
            hydrophobic: 1, // A
            polar: 1, // S
            positive: 1, // K
            negative: 1, // D
            special: 1, // G
        });
    });

    it('totals the residues it counted', () => {
        expect(stats.protein.total).toBe(seq.length);
    });
});

describe('computeSequenceStats — edge cases and errors', () => {
    it('handles an empty nucleic-acid sequence', () => {
        const stats = computeSequenceStats('', 'dna');
        expect(stats.length).toBe(0);
        expect(stats.gc).toBe(0);
        expect(stats.meltingTemp).toBe(0);
        expect(stats.molecularWeight).toBe(0);
        expect(stats.orfs).toEqual([]);
        expect(stats.codonUsage).toBeNull();
    });

    it('handles an empty protein sequence', () => {
        const stats = computeSequenceStats('', 'protein');
        expect(stats.protein.total).toBe(0);
        expect(stats.protein.residues).toEqual([]);
        expect(Number.isNaN(stats.protein.instabilityIndex)).toBe(true);
    });

    it('treats an unrecognised type as a nucleic acid but skips ORFs and codons', () => {
        const stats = computeSequenceStats('ATGCATGCATGC', 'unknown');
        expect(stats.gc).not.toBeNull();
        expect(stats.protein).toBeNull();
        expect(stats.orfs).toBeNull();
        expect(stats.codonUsage).toBeNull();
    });

    it('throws BioError INVALID_SEQUENCE for a non-string sequence', () => {
        for (const bad of [null, undefined, 42, {}]) {
            expect(() => computeSequenceStats(bad, 'dna')).toThrow(BioError);
            try {
                computeSequenceStats(bad, 'dna');
            } catch (e) {
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('returns no HTML anywhere in the result', () => {
        const json = JSON.stringify(computeSequenceStats(pUC19.sequence, 'dna'));
        expect(json).not.toMatch(/<[a-z]/i);
    });
});
