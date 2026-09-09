import { describe, it, expect } from 'vitest';
import {
    frameCodons,
    findOrfSpans,
    packFeatureLanes,
    buildGcIndex,
    gcWindowFor,
    gcProfile,
    cutsInWindow,
} from './tracks.js';
import { reverseComplement, translate } from '../utils/bioUtils.js';

describe('frameCodons', () => {
    it('translates a forward frame in reading order', () => {
        const cells = frameCodons('ATGGCCTAA', { frame: 0, direction: 'forward', from: 0, to: 9 });
        expect(cells.map(c => c.aa).join('')).toBe('MA*');
        expect(cells.map(c => c.start)).toEqual([0, 3, 6]);
        expect(cells[0].isStart).toBe(true);
        expect(cells[2].isStop).toBe(true);
    });

    it('offsets a forward frame by its frame number', () => {
        const cells = frameCodons('CATGGCCTAA', {
            frame: 1,
            direction: 'forward',
            from: 0,
            to: 10,
        });
        expect(cells.map(c => c.aa).join('')).toBe('MA*');
        expect(cells[0].start).toBe(1);
    });

    it('reports reverse codons by the forward span they cover', () => {
        const seq = 'ATGGCCTAA';
        const cells = frameCodons(seq, { frame: 0, direction: 'reverse', from: 0, to: 9 });
        // The reverse read is TTAGGCCAT: L, G, H.
        expect(cells.map(c => c.aa).join('')).toBe('LGH');
        expect(cells.map(c => c.start)).toEqual([6, 3, 0]);
    });

    it('agrees with translate() on both strands', () => {
        const seq = 'ATGGCCTTAGGCCATTAAGGCATCGGA';
        for (const frame of [0, 1, 2]) {
            const forward = frameCodons(seq, {
                frame,
                direction: 'forward',
                from: 0,
                to: seq.length,
            });
            expect(forward.map(c => c.aa).join('')).toBe(translate(seq, frame));

            const reverse = frameCodons(seq, {
                frame,
                direction: 'reverse',
                from: 0,
                to: seq.length,
            });
            expect(reverse.map(c => c.aa).join('')).toBe(translate(reverseComplement(seq), frame));
        }
    });

    it('includes a codon that merely overlaps the window, whole', () => {
        const cells = frameCodons('ATGGCCTAA', { frame: 0, direction: 'forward', from: 4, to: 5 });
        expect(cells).toHaveLength(1);
        expect(cells[0]).toMatchObject({ start: 3, end: 6, aa: 'A' });
    });

    it('never emits a codon that runs off the end', () => {
        const cells = frameCodons('ATGGC', { frame: 0, direction: 'forward', from: 0, to: 5 });
        expect(cells).toHaveLength(1);
        expect(cells[0].end).toBeLessThanOrEqual(5);
    });

    it('returns nothing for an empty window', () => {
        expect(frameCodons('ATGGCC', { frame: 0, direction: 'forward', from: 4, to: 4 })).toEqual(
            []
        );
    });
});

describe('findOrfSpans', () => {
    const orf = `ATG${'GCC'.repeat(40)}TAA`;

    it('finds a forward ORF and measures its product', () => {
        const spans = findOrfSpans(orf, { minAa: 30 });
        expect(spans).toHaveLength(1);
        expect(spans[0]).toMatchObject({ start: 0, end: orf.length, direction: 'forward' });
        expect(spans[0].aaLength).toBe(41);
    });

    it('reports reverse ORFs in forward coordinates', () => {
        const spans = findOrfSpans(reverseComplement(orf), { minAa: 30 });
        expect(spans).toHaveLength(1);
        expect(spans[0].direction).toBe('reverse');
        expect(spans[0].start).toBe(0);
        expect(spans[0].end).toBe(orf.length);
    });

    it('drops products shorter than the minimum', () => {
        expect(findOrfSpans('ATGGCCTAA', { minAa: 30 })).toEqual([]);
        expect(findOrfSpans('ATGGCCTAA', { minAa: 1 })).toHaveLength(1);
    });

    it('ignores an unterminated ORF unless asked to keep it', () => {
        const noStop = `ATG${'GCC'.repeat(40)}`;
        expect(findOrfSpans(noStop, { minAa: 30 })).toEqual([]);
        expect(findOrfSpans(noStop, { minAa: 30, requireStop: false })).toHaveLength(1);
    });

    it('returns spans sorted by start', () => {
        const spans = findOrfSpans(`${orf}TTTT${orf}`, { minAa: 30 });
        const starts = spans.map(s => s.start);
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
    });
});

describe('packFeatureLanes', () => {
    it('puts non-overlapping features in one lane', () => {
        const lanes = packFeatureLanes([
            { start: 0, end: 10 },
            { start: 10, end: 20 },
            { start: 20, end: 30 },
        ]);
        expect(lanes).toHaveLength(1);
        expect(lanes[0]).toHaveLength(3);
    });

    it('pushes an overlapping feature to a new lane', () => {
        const lanes = packFeatureLanes([
            { start: 0, end: 10 },
            { start: 5, end: 20 },
            { start: 12, end: 30 },
        ]);
        expect(lanes.map(l => l.length)).toEqual([2, 1]);
    });

    it('separates abutting features when padding is required', () => {
        expect(
            packFeatureLanes(
                [
                    { start: 0, end: 10 },
                    { start: 10, end: 20 },
                ],
                5
            )
        ).toHaveLength(2);
    });

    it('keeps each lane in ascending order', () => {
        const lanes = packFeatureLanes([
            { start: 50, end: 60 },
            { start: 0, end: 10 },
            { start: 20, end: 30 },
        ]);
        expect(lanes[0].map(f => f.start)).toEqual([0, 20, 50]);
    });

    it('does not mutate its input', () => {
        const features = [
            { start: 50, end: 60 },
            { start: 0, end: 10 },
        ];
        packFeatureLanes(features);
        expect(features[0].start).toBe(50);
    });

    it('handles no features', () => {
        expect(packFeatureLanes([])).toEqual([]);
    });
});

describe('gcProfile', () => {
    it('reads pure GC and pure AT at the extremes', () => {
        const index = buildGcIndex('GGGGGGGGGG');
        expect(gcProfile(index, { from: 0, to: 10, bins: 1, window: 10 })[0]).toBe(1);
        const at = buildGcIndex('AAAATTTTAA');
        expect(gcProfile(at, { from: 0, to: 10, bins: 1, window: 10 })[0]).toBe(0);
    });

    it('tracks a GC-rich block with a small window', () => {
        const index = buildGcIndex(`${'A'.repeat(50)}${'G'.repeat(50)}`);
        const profile = gcProfile(index, { from: 0, to: 100, bins: 10, window: 5 });
        expect(profile[0]).toBe(0);
        expect(profile[9]).toBe(1);
    });

    it('excludes ambiguity codes from the ratio', () => {
        const index = buildGcIndex('GCNNNN');
        expect(gcProfile(index, { from: 0, to: 6, bins: 1, window: 6 })[0]).toBe(1);
    });

    it('reports the neutral value where nothing is scorable', () => {
        const index = buildGcIndex('NNNNNN');
        expect(gcProfile(index, { from: 0, to: 6, bins: 1, window: 6 })[0]).toBe(0.5);
    });

    it('produces the requested number of bins', () => {
        const index = buildGcIndex('ACGT'.repeat(100));
        expect(gcProfile(index, { from: 0, to: 400, bins: 37, window: 11 })).toHaveLength(37);
    });

    it('is defined for an empty window', () => {
        const index = buildGcIndex('ACGT');
        expect(gcProfile(index, { from: 2, to: 2, bins: 3, window: 11 })).toEqual([0.5, 0.5, 0.5]);
    });

    it('is case-insensitive', () => {
        expect(buildGcIndex('gc').gc[2]).toBe(2);
    });
});

describe('gcWindowFor', () => {
    it('always returns an odd size inside the clamp', () => {
        for (const residues of [1, 100, 4000, 10_000_000]) {
            const w = gcWindowFor(residues);
            expect(w % 2).toBe(1);
            expect(w).toBeGreaterThanOrEqual(11);
            expect(w).toBeLessThanOrEqual(2001);
        }
    });

    it('grows with the amount of sequence on a row', () => {
        expect(gcWindowFor(40_000)).toBeGreaterThan(gcWindowFor(4000));
    });
});

describe('cutsInWindow', () => {
    const sites = [
        { name: 'EcoRI', positions: [10, 500] },
        { name: 'BamHI', positions: [5, 25] },
    ];

    it('keeps only cuts inside the half-open window, sorted', () => {
        expect(cutsInWindow(sites, 0, 100)).toEqual([
            { name: 'BamHI', position: 5 },
            { name: 'EcoRI', position: 10 },
            { name: 'BamHI', position: 25 },
        ]);
    });

    it('excludes the window end', () => {
        expect(cutsInWindow(sites, 5, 10)).toEqual([{ name: 'BamHI', position: 5 }]);
    });

    it('returns nothing when no enzyme cuts', () => {
        expect(cutsInWindow([], 0, 100)).toEqual([]);
    });
});
