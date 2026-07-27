import { describe, it, expect } from 'vitest';
import {
    needlemanWunsch,
    smithWaterman,
    generateConsensus,
    multipleAlignment,
} from './alignment.js';

// Nucleotide scoring used by both algorithms: match +2, mismatch -1, gap -2.

describe('needlemanWunsch', () => {
    it('aligns identical sequences with no gaps', () => {
        expect(needlemanWunsch('ACGT', 'ACGT')).toEqual({
            aligned1: 'ACGT',
            aligned2: 'ACGT',
            score: 8, // 4 matches x +2
            identity: 100,
            gaps: 0,
        });
    });

    it('prefers mismatches over gaps for completely disjoint sequences', () => {
        // 4 mismatches = -4, beats gapping through both sequences (-16).
        expect(needlemanWunsch('AAAA', 'TTTT')).toEqual({
            aligned1: 'AAAA',
            aligned2: 'TTTT',
            score: -4,
            identity: 0,
            gaps: 0,
        });
    });

    it('opens a single gap when that is the optimal path', () => {
        // 3 matches (+6) + 1 gap (-2) = 4, beats 2 matches + 1 mismatch + 1 gap (+1).
        expect(needlemanWunsch('ACGT', 'AGT')).toEqual({
            aligned1: 'ACGT',
            aligned2: 'A-GT',
            score: 4,
            identity: 100, // gapped columns are excluded from identity
            gaps: 1,
        });
    });

    it('handles two empty sequences', () => {
        const r = needlemanWunsch('', '');
        expect(r).toMatchObject({ aligned1: '', aligned2: '', identity: 0, gaps: 0 });
        // The matrix seed is `0 * gapPenalty`, so the score is negative zero.
        // Numerically equal to 0; `+ 0` normalises the sign.
        expect(r.score + 0).toBe(0);
    });

    it('gaps the whole of one sequence when the other is empty', () => {
        expect(needlemanWunsch('ACGT', '')).toEqual({
            aligned1: 'ACGT',
            aligned2: '----',
            score: -8, // 4 gaps x -2
            identity: 0,
            gaps: 4,
        });
    });

    it('scores proteins with BLOSUM62 when isProtein is set', () => {
        // M=5, K=5, V=4
        expect(needlemanWunsch('MKV', 'MKV', true).score).toBe(14);
    });

    it('scores a BLOSUM62 conservative substitution above a radical one', () => {
        const conservative = needlemanWunsch('KKK', 'RRR', true).score; // K/R = +2
        const radical = needlemanWunsch('KKK', 'WWW', true).score; // K/W = -3
        expect(conservative).toBe(6);
        expect(radical).toBe(-9);
    });

    it('honours a custom gap penalty', () => {
        // With a free gap, gapping is never worse than mismatching.
        expect(needlemanWunsch('ACGT', 'AGT', false, 0).score).toBe(6);
    });

    it('produces aligned strings of equal length', () => {
        const r = needlemanWunsch('ACGTACGTTT', 'ACGACGT');
        expect(r.aligned1).toHaveLength(r.aligned2.length);
        expect(r.aligned1.replace(/-/g, '')).toBe('ACGTACGTTT');
        expect(r.aligned2.replace(/-/g, '')).toBe('ACGACGT');
    });

    it('is symmetric in score', () => {
        const a = needlemanWunsch('ACGTTGCA', 'ACGTGCA').score;
        const b = needlemanWunsch('ACGTGCA', 'ACGTTGCA').score;
        expect(a).toBe(b);
    });
});

describe('smithWaterman', () => {
    it('finds the best local segment and reports its start offsets', () => {
        expect(smithWaterman('AAGGTT', 'GGT')).toEqual({
            aligned1: 'GGT',
            aligned2: 'GGT',
            score: 6, // 3 matches x +2
            start1: 2,
            start2: 0,
            identity: 100,
            gaps: 0,
        });
    });

    it('returns an empty alignment with score 0 when nothing aligns positively', () => {
        expect(smithWaterman('AAAA', 'CCCC')).toEqual({
            aligned1: '',
            aligned2: '',
            score: 0,
            start1: 0,
            start2: 0,
            identity: 0,
            gaps: 0,
        });
    });

    it('scores identical sequences the same as the global alignment', () => {
        expect(smithWaterman('ACGT', 'ACGT').score).toBe(needlemanWunsch('ACGT', 'ACGT').score);
    });

    it('handles empty input', () => {
        expect(smithWaterman('', '')).toMatchObject({ score: 0, aligned1: '', aligned2: '' });
        expect(smithWaterman('ACGT', '')).toMatchObject({ score: 0, aligned1: '' });
    });

    it('never scores below zero', () => {
        expect(smithWaterman('AAAAAAAA', 'CCCCCCCC').score).toBe(0);
    });

    it('finds a conserved island inside noisy flanks', () => {
        const r = smithWaterman('CCCCACGTACGTCCCC', 'TTTTACGTACGTTTTT');
        expect(r.aligned1).toContain('ACGTACGT');
        expect(r.score).toBeGreaterThanOrEqual(16); // 8 matches x +2
    });
});

describe('generateConsensus', () => {
    it('picks the most frequent residue per column', () => {
        expect(generateConsensus(['ACGT', 'ACGA', 'ACGT'])).toBe('ACGT');
    });

    it('emits a gap when a column is entirely gaps', () => {
        expect(generateConsensus(['A-GT', 'A-GT'])).toBe('A-GT');
    });

    it('ignores gaps when another residue is present in the column', () => {
        expect(generateConsensus(['A-GT', 'ACGT'])).toBe('ACGT');
    });

    it('uppercases the consensus', () => {
        expect(generateConsensus(['acgt', 'acgt'])).toBe('ACGT');
    });

    it('returns an empty string for no input', () => {
        expect(generateConsensus([])).toBe('');
    });
});

describe('multipleAlignment', () => {
    it('returns the input unchanged for a single sequence', () => {
        expect(multipleAlignment(['ACGT'])).toEqual(['ACGT']);
    });

    it('returns rows of equal length that reduce to the inputs when gaps are stripped', () => {
        const input = ['ACGT', 'ACT', 'ACGTT'];
        const rows = multipleAlignment(input);
        expect(rows).toHaveLength(3);
        const width = rows[0].length;
        for (const row of rows) expect(row).toHaveLength(width);
        expect(rows.map(r => r.replace(/-/g, ''))).toEqual(input);
    });

    it('leaves identical sequences ungapped', () => {
        expect(multipleAlignment(['ACGT', 'ACGT', 'ACGT'])).toEqual(['ACGT', 'ACGT', 'ACGT']);
    });

    it('returns an empty array for no input', () => {
        expect(multipleAlignment([])).toEqual([]);
    });

    it('feeds a usable consensus', () => {
        const rows = multipleAlignment(['ACGTACGT', 'ACGTACGT', 'ACGTACGA']);
        expect(generateConsensus(rows)).toBe('ACGTACGT');
    });
});
