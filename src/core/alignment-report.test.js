import { describe, it, expect } from 'vitest';
import {
    alignPair,
    buildAlignmentReport,
    buildMatchLine,
    computeConservation,
    DEFAULT_MAX_LENGTH,
} from './alignment-report.js';
import { BioError } from './errors.js';

const dna = (name, sequence) => ({ name, type: 'dna', sequence });

describe('buildMatchLine', () => {
    it('marks identical columns with a pipe', () => {
        expect(buildMatchLine('ACGT', 'ACGT')).toBe('||||');
    });

    it('marks mismatches with a space', () => {
        expect(buildMatchLine('ACGT', 'AGGT')).toBe('| ||');
    });

    it('never marks a gapped column', () => {
        expect(buildMatchLine('A-GT', 'A-GT')).toBe('| ||');
    });

    it('is case insensitive', () => {
        expect(buildMatchLine('acgt', 'ACGT')).toBe('||||');
    });

    it('returns an empty line for empty input', () => {
        expect(buildMatchLine('', '')).toBe('');
    });
});

describe('alignPair', () => {
    it('aligns globally with Needleman-Wunsch', () => {
        const r = alignPair('ACGT', 'ACGT', { algorithm: 'nw' });
        expect(r).toMatchObject({
            alignedA: 'ACGT',
            alignedB: 'ACGT',
            score: 8,
            identity: 100,
            gaps: 0,
            matchLine: '||||',
            length: 4,
            algorithm: 'nw',
            startA: null,
            startB: null,
        });
    });

    it('aligns locally with Smith-Waterman and reports start offsets', () => {
        const r = alignPair('AAGGTT', 'GGT', { algorithm: 'sw' });
        expect(r).toMatchObject({
            alignedA: 'GGT',
            alignedB: 'GGT',
            score: 6,
            startA: 2,
            startB: 0,
            algorithm: 'sw',
        });
    });

    it('defaults to Needleman-Wunsch', () => {
        expect(alignPair('ACGT', 'ACGT').algorithm).toBe('nw');
    });

    it('scores proteins with BLOSUM62 when isProtein is set', () => {
        expect(alignPair('MKV', 'MKV', { isProtein: true }).score).toBe(14);
        expect(alignPair('MKV', 'MKV', { isProtein: false }).score).toBe(6);
    });

    it('honours a custom gap penalty', () => {
        expect(alignPair('ACGT', 'AGT', { gapPenalty: 0 }).score).toBe(6);
    });

    it('truncates both sequences at maxLength', () => {
        const r = alignPair('A'.repeat(50), 'A'.repeat(50), { maxLength: 10 });
        expect(r.length).toBe(10);
    });

    it('defaults maxLength to 3000', () => {
        expect(DEFAULT_MAX_LENGTH).toBe(3000);
    });

    it('handles empty input', () => {
        expect(alignPair('', '')).toMatchObject({ alignedA: '', alignedB: '', length: 0 });
    });

    it('throws BioError UNKNOWN_ALGORITHM for anything but nw/sw', () => {
        for (const algorithm of ['msa', 'bogus', '', null]) {
            try {
                alignPair('ACGT', 'ACGT', { algorithm });
                expect.unreachable(`${algorithm} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('UNKNOWN_ALGORITHM');
            }
        }
    });
});

describe('computeConservation', () => {
    it('scores a fully conserved column as 1', () => {
        expect(computeConservation(['AC', 'AC', 'AC'], 'AC')).toEqual([1, 1]);
    });

    it('scores a column against the total row count, so gaps dilute it', () => {
        // Column 0: two rows hold A, one holds a gap -> 2/3, not 2/2.
        expect(computeConservation(['A', 'A', '-'], 'A')[0]).toBeCloseTo(2 / 3, 10);
    });

    it('scores a column whose consensus is a gap as 0', () => {
        expect(computeConservation(['-', '-'], '-')).toEqual([0]);
    });

    it('scores a split column proportionally', () => {
        expect(computeConservation(['A', 'A', 'C', 'C'], 'A')[0]).toBe(0.5);
    });

    it('is case insensitive', () => {
        expect(computeConservation(['a', 'A'], 'A')).toEqual([1]);
    });

    it('returns one value per consensus column', () => {
        expect(computeConservation(['ACGT', 'ACGT'], 'ACGT')).toHaveLength(4);
    });
});

describe('buildAlignmentReport — MSA', () => {
    const entries = [dna('a', 'ACGTACGT'), dna('b', 'ACGTACGT'), dna('c', 'ACGTACGA')];
    const report = buildAlignmentReport(entries, { algorithm: 'msa' });

    it('returns one row per input, in order, with names preserved', () => {
        expect(report.rows.map(r => r.name)).toEqual(['a', 'b', 'c']);
    });

    it('returns rows of equal length matching the reported length', () => {
        for (const row of report.rows) expect(row.aligned).toHaveLength(report.length);
    });

    it('derives a consensus of the same length', () => {
        expect(report.consensus).toHaveLength(report.length);
        expect(report.consensus).toBe('ACGTACGT');
    });

    it('returns one conservation value per column, all in [0, 1]', () => {
        expect(report.conservation).toHaveLength(report.length);
        for (const c of report.conservation) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(1);
        }
    });

    it('scores the divergent final column below the conserved ones', () => {
        expect(report.conservation[7]).toBeLessThan(report.conservation[0]);
    });

    it('has no pairwise block', () => {
        expect(report.pairwise).toBeNull();
    });

    it('detects protein input from the entry type', () => {
        const p = buildAlignmentReport(
            [
                { name: 'p', type: 'protein', sequence: 'MKV' },
                { name: 'q', type: 'dna', sequence: 'MKV' },
            ],
            { algorithm: 'msa' }
        );
        expect(p.isProtein).toBe(true);
    });

    it('accepts an explicit isProtein override', () => {
        const r = buildAlignmentReport(entries, { algorithm: 'msa', isProtein: true });
        expect(r.isProtein).toBe(true);
    });

    it('truncates long sequences at maxLength', () => {
        const long = [dna('a', 'A'.repeat(100)), dna('b', 'A'.repeat(100))];
        expect(buildAlignmentReport(long, { maxLength: 20 }).length).toBe(20);
    });
});

describe('buildAlignmentReport — pairwise', () => {
    const entries = [dna('a', 'ACGTACGT'), dna('b', 'ACGTCGT')];

    it('exposes the pairwise metrics for nw', () => {
        const report = buildAlignmentReport(entries, { algorithm: 'nw' });
        expect(report.pairwise).not.toBeNull();
        expect(report.pairwise.algorithm).toBe('nw');
        expect(report.pairwise.identity).toBeGreaterThan(0);
        expect(report.rows).toHaveLength(2);
        expect(report.rows[0].aligned).toBe(report.pairwise.alignedA);
        expect(report.rows[1].aligned).toBe(report.pairwise.alignedB);
    });

    it('exposes the pairwise metrics for sw', () => {
        const report = buildAlignmentReport(entries, { algorithm: 'sw' });
        expect(report.pairwise.algorithm).toBe('sw');
        expect(report.pairwise.startA).toBeGreaterThanOrEqual(0);
    });

    it('reports a length matching the aligned rows', () => {
        const report = buildAlignmentReport(entries, { algorithm: 'nw' });
        expect(report.length).toBe(report.rows[0].aligned.length);
        expect(report.length).toBe(report.rows[1].aligned.length);
    });
});

describe('buildAlignmentReport — error paths', () => {
    it('throws BioError TOO_FEW_SEQUENCES below two entries', () => {
        for (const entries of [[], [dna('a', 'ACGT')], null, undefined]) {
            try {
                buildAlignmentReport(entries, { algorithm: 'msa' });
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('TOO_FEW_SEQUENCES');
                expect(e.message).toBe('Please select at least 2 sequences.');
            }
        }
    });

    it('throws BioError PAIRWISE_TOO_MANY_SEQUENCES for nw/sw with three entries', () => {
        const three = [dna('a', 'ACGT'), dna('b', 'ACGT'), dna('c', 'ACGT')];
        for (const algorithm of ['nw', 'sw']) {
            try {
                buildAlignmentReport(three, { algorithm });
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e.code).toBe('PAIRWISE_TOO_MANY_SEQUENCES');
            }
        }
    });

    it('accepts three entries for msa', () => {
        const three = [dna('a', 'ACGT'), dna('b', 'ACGT'), dna('c', 'ACGT')];
        expect(buildAlignmentReport(three, { algorithm: 'msa' }).rows).toHaveLength(3);
    });

    // Behaviour change vs. the pre-refactor component, which silently fell
    // through to Smith-Waterman for any unrecognised algorithm. Not reachable
    // from the UI, whose algorithm dropdown only offers msa/nw/sw.
    it('throws BioError UNKNOWN_ALGORITHM instead of silently running sw', () => {
        try {
            buildAlignmentReport([dna('a', 'ACGT'), dna('b', 'ACGT')], { algorithm: 'bogus' });
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e.code).toBe('UNKNOWN_ALGORITHM');
        }
    });

    it('validates the algorithm before the sequence count', () => {
        try {
            buildAlignmentReport([], { algorithm: 'bogus' });
        } catch (e) {
            expect(e.code).toBe('UNKNOWN_ALGORITHM');
        }
    });

    it('returns no HTML anywhere in the result', () => {
        const json = JSON.stringify(
            buildAlignmentReport([dna('a', 'ACGTACGT'), dna('b', 'ACGTCGT')], { algorithm: 'nw' })
        );
        expect(json).not.toMatch(/<[a-z]/i);
    });
});
