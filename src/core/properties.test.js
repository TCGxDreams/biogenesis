import { describe, it, expect } from 'vitest';
import { computeProperty, computeSlidingProperties, estimatePi, METRICS } from './properties.js';
import { BioError } from './errors.js';

describe('estimatePi', () => {
    it('classifies a basic peptide', () => {
        expect(estimatePi('KKKRRR')).toBe('> 7.0 (Basic)');
    });

    it('classifies an acidic peptide', () => {
        expect(estimatePi('DDDEEE')).toBe('< 7.0 (Acidic)');
    });

    it('classifies a balanced peptide as neutral', () => {
        expect(estimatePi('KD')).toBe('~ 7.0 (Neutral)');
        expect(estimatePi('AAAA')).toBe('~ 7.0 (Neutral)');
        expect(estimatePi('')).toBe('~ 7.0 (Neutral)');
    });

    it('counts histidine as half a positive charge', () => {
        expect(estimatePi('HHD')).toBe('~ 7.0 (Neutral)'); // 1.0 vs 1.0
        expect(estimatePi('HHHD')).toBe('> 7.0 (Basic)'); // 1.5 vs 1.0
    });
});

describe('computeProperty — windowing', () => {
    it('produces n - w + 1 left-aligned values', () => {
        const { values } = computeProperty('ACGTACGTAC', 'gc_content', 4);
        expect(values).toHaveLength(7);
    });

    it('produces no values when the window exceeds the sequence', () => {
        expect(computeProperty('ACGT', 'gc_content', 10).values).toEqual([]);
    });

    it('produces exactly one value when the window equals the length', () => {
        expect(computeProperty('GGCC', 'gc_content', 4).values).toEqual([100]);
    });

    it('defaults the window to 50', () => {
        expect(computeProperty('A'.repeat(60), 'gc_content').windowSize).toBe(50);
    });

    it('uppercases the sequence first', () => {
        expect(computeProperty('ggcc', 'gc_content', 4).values).toEqual([100]);
    });

    it('reports the metric label and unit', () => {
        const series = computeProperty('ACGT', 'gc_content', 4);
        expect(series.label).toBe(METRICS.gc_content.label);
        expect(series.unit).toBe('%');
        expect(series.metric).toBe('gc_content');
    });
});

describe('computeProperty — nucleic metrics', () => {
    it('computes GC percentage per window', () => {
        expect(computeProperty('GGGGAAAA', 'gc_content', 4).values).toEqual([100, 75, 50, 25, 0]);
    });

    it('reports overall GC, AT/GC ratio and length', () => {
        const { stats } = computeProperty('GGCCAATT', 'gc_content', 4);
        expect(stats.overallGc).toBe(50);
        expect(stats.atGcRatio).toBe(1);
        expect(stats.length).toBe(8);
    });

    it('computes AT skew, and returns 0 for a window with no A or T', () => {
        expect(computeProperty('AAAA', 'at_skew', 4).values).toEqual([1]);
        expect(computeProperty('TTTT', 'at_skew', 4).values).toEqual([-1]);
        expect(computeProperty('ATAT', 'at_skew', 4).values).toEqual([0]);
        expect(computeProperty('GGCC', 'at_skew', 4).values).toEqual([0]);
    });

    it('computes GC skew, and returns 0 for a window with no G or C', () => {
        expect(computeProperty('GGGG', 'gc_skew', 4).values).toEqual([1]);
        expect(computeProperty('CCCC', 'gc_skew', 4).values).toEqual([-1]);
        expect(computeProperty('AAAA', 'gc_skew', 4).values).toEqual([0]);
    });

    it('scores a repetitive window below a varied one for complexity', () => {
        const repeat = computeProperty('AAAAAAAA', 'complexity', 8).values[0];
        const varied = computeProperty('ACGTACGT', 'complexity', 8).values[0];
        expect(repeat).toBeLessThan(varied);
        // A homopolymer has exactly 3 distinct k-mers for k = 1..3.
        expect(repeat).toBe(3 / 8);
    });

    it('computes CpG observed/expected, and 0 when none is expected', () => {
        expect(computeProperty('AAAA', 'cpg', 4).values).toEqual([0]);
        expect(computeProperty('CGCG', 'cpg', 4).values[0]).toBeGreaterThan(0);
    });

    it('reports CpG site count and density', () => {
        const { stats } = computeProperty('CGCGCGCGCG', 'cpg', 4);
        expect(stats.cpgSites).toBe(5);
        expect(stats.cpgDensityPer100bp).toBe(50);
    });
});

describe('computeProperty — protein metrics', () => {
    it('averages Kyte-Doolittle hydropathy over the window', () => {
        expect(computeProperty('IIII', 'hydrophobicity', 4).values).toEqual([4.5]);
        expect(computeProperty('RRRR', 'hydrophobicity', 4).values).toEqual([-4.5]);
    });

    it('scores unknown residues as 0 hydropathy', () => {
        expect(computeProperty('XXXX', 'hydrophobicity', 4).values).toEqual([0]);
    });

    it('reports average hydrophobicity and length', () => {
        const { stats } = computeProperty('IIII', 'hydrophobicity', 4);
        expect(stats.averageHydrophobicity).toBe(4.5);
        expect(stats.length).toBe(4);
    });

    it('averages net charge over the window', () => {
        expect(computeProperty('KKKK', 'charge', 4).values).toEqual([1]);
        expect(computeProperty('DDDD', 'charge', 4).values).toEqual([-1]);
        expect(computeProperty('KKDD', 'charge', 4).values).toEqual([0]);
    });

    it('reports total net charge and a pI band', () => {
        const { stats } = computeProperty('KKKK', 'charge', 4);
        expect(stats.totalNetCharge).toBe(4);
        expect(stats.isoelectricPoint).toBe('> 7.0 (Basic)');
    });

    it('averages residue mass, defaulting unknown residues to 110 Da', () => {
        expect(computeProperty('GGGG', 'molecular_weight', 4).values).toEqual([75]);
        expect(computeProperty('XXXX', 'molecular_weight', 4).values).toEqual([110]);
    });

    it('reports total and average residue mass', () => {
        const { stats } = computeProperty('GGGG', 'molecular_weight', 4);
        expect(stats.totalMw).toBeCloseTo(300, 6);
        expect(stats.averageResidueMw).toBeCloseTo(75, 6);
    });

    it('averages flexibility, defaulting unknown residues to 0.4', () => {
        expect(computeProperty('GGGG', 'flexibility', 4).values).toEqual([0.54]);
        expect(computeProperty('XXXX', 'flexibility', 4).values).toEqual([0.4]);
    });

    it('reports no stats for metrics that define none', () => {
        for (const metric of ['at_skew', 'gc_skew', 'complexity', 'flexibility']) {
            expect(computeProperty('ACGTACGT', metric, 4).stats).toEqual({});
        }
    });
});

describe('computeSlidingProperties', () => {
    it('computes every metric by default', () => {
        const { series } = computeSlidingProperties('ACGTACGTAC', { windowSize: 4 });
        expect(Object.keys(series).sort()).toEqual(Object.keys(METRICS).sort());
    });

    it('computes only the requested metrics', () => {
        const { series } = computeSlidingProperties('ACGTACGTAC', {
            windowSize: 4,
            metrics: ['gc_content', 'gc_skew'],
        });
        expect(Object.keys(series)).toEqual(['gc_content', 'gc_skew']);
    });

    it('reports the window size and sequence length', () => {
        const result = computeSlidingProperties('ACGTACGTAC', {
            windowSize: 4,
            metrics: ['gc_content'],
        });
        expect(result.windowSize).toBe(4);
        expect(result.sequenceLength).toBe(10);
    });

    it('gives every series the same value count', () => {
        const { series } = computeSlidingProperties('ACGTACGTAC', { windowSize: 4 });
        const counts = Object.values(series).map(s => s.values.length);
        expect(new Set(counts).size).toBe(1);
    });
});

describe('properties — error paths', () => {
    it('throws BioError UNKNOWN_METRIC for an unlisted metric', () => {
        for (const metric of ['entropy', '', null]) {
            try {
                computeProperty('ACGT', metric, 4);
                expect.unreachable(`${metric} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('UNKNOWN_METRIC');
            }
        }
    });

    it('throws BioError INVALID_WINDOW for a non-positive window', () => {
        for (const w of [0, -1, NaN, Infinity]) {
            try {
                computeProperty('ACGT', 'gc_content', w);
                expect.unreachable(`${w} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_WINDOW');
            }
        }
    });

    it('throws BioError INVALID_SEQUENCE for a non-string sequence', () => {
        for (const bad of [null, undefined, 42]) {
            try {
                computeProperty(bad, 'gc_content', 4);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('validates the sequence before the metric', () => {
        try {
            computeProperty(null, 'nonsense', 4);
        } catch (e) {
            expect(e.code).toBe('INVALID_SEQUENCE');
        }
    });

    it('returns empty stats for an empty sequence rather than NaN', () => {
        const series = computeProperty('', 'gc_content', 4);
        expect(series.values).toEqual([]);
        expect(series.stats).toEqual({});
    });

    it('returns no HTML anywhere in the result', () => {
        const json = JSON.stringify(computeSlidingProperties('ACGTACGTAC', { windowSize: 4 }));
        expect(json).not.toMatch(/<[a-z]/i);
    });
});
