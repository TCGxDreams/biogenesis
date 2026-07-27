import { describe, it, expect } from 'vitest';
import { computeDotMatrix, DEFAULT_MAX_LENGTH } from './dotplot.js';
import { BioError } from './errors.js';

describe('computeDotMatrix — happy path', () => {
    it('plots the main diagonal for identical sequences', () => {
        const { points } = computeDotMatrix('ACGTACGTAC', 'ACGTACGTAC', {
            windowSize: 4,
            threshold: 100,
        });
        // Every window on the diagonal is a perfect match.
        const diagonal = points.filter(p => p.x === p.y);
        expect(diagonal).toHaveLength(7); // offsets 0..6
        for (const p of diagonal) {
            expect(p.matches).toBe(4);
            expect(p.identity).toBe(1);
        }
    });

    it('reports matches and identity per plotted window', () => {
        const { points } = computeDotMatrix('AAAA', 'AAAA', { windowSize: 2, threshold: 100 });
        expect(points[0]).toEqual({ x: 0, y: 0, matches: 2, identity: 1 });
    });

    it('plots nothing when the sequences share no window above threshold', () => {
        const { points } = computeDotMatrix('AAAAAAAA', 'CCCCCCCC', {
            windowSize: 4,
            threshold: 70,
        });
        expect(points).toEqual([]);
    });

    it('emits points ordered by x then y', () => {
        const { points } = computeDotMatrix('ACGTACGT', 'ACGTACGT', {
            windowSize: 2,
            threshold: 100,
        });
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const cur = points[i];
            expect(cur.x > prev.x || (cur.x === prev.x && cur.y > prev.y)).toBe(true);
        }
    });

    it('is symmetric under swapping the two sequences', () => {
        const a = computeDotMatrix('ACGTTGCA', 'ACGTACGT', { windowSize: 3, threshold: 100 });
        const b = computeDotMatrix('ACGTACGT', 'ACGTTGCA', { windowSize: 3, threshold: 100 });
        expect(b.points.map(p => [p.y, p.x, p.matches]).sort()).toEqual(
            a.points.map(p => [p.x, p.y, p.matches]).sort()
        );
    });

    it('finds an off-diagonal repeat', () => {
        // 'ACGTACGT' repeats at offset 4, so windows at (0,4) and (4,0) match.
        const { points } = computeDotMatrix('ACGTACGT', 'ACGTACGT', {
            windowSize: 4,
            threshold: 100,
        });
        const coords = points.map(p => `${p.x},${p.y}`);
        expect(coords).toContain('0,4');
        expect(coords).toContain('4,0');
    });
});

describe('computeDotMatrix — threshold and window', () => {
    it('derives thresholdCount by rounding up', () => {
        // ceil(10 * 70 / 100) = 7
        expect(computeDotMatrix('A'.repeat(20), 'A'.repeat(20)).dimensions.thresholdCount).toBe(7);
        expect(
            computeDotMatrix('A'.repeat(20), 'A'.repeat(20), { windowSize: 3, threshold: 70 })
                .dimensions.thresholdCount
        ).toBe(3); // ceil(2.1)
    });

    it('plots more windows as the threshold falls', () => {
        const a = 'ACGTACGTACGTACGT';
        const b = 'ACGAACGAACGAACGA';
        const strict = computeDotMatrix(a, b, { windowSize: 4, threshold: 100 }).points.length;
        const loose = computeDotMatrix(a, b, { windowSize: 4, threshold: 60 }).points.length;
        expect(loose).toBeGreaterThan(strict);
    });

    it('treats windowSize 1 as an exact per-residue comparison', () => {
        const { points } = computeDotMatrix('AC', 'CA', { windowSize: 1, threshold: 100 });
        expect(points.map(p => [p.x, p.y])).toEqual([
            [0, 1],
            [1, 0],
        ]);
    });

    it('plots nothing when the window is longer than either sequence', () => {
        expect(computeDotMatrix('ACGT', 'ACGT', { windowSize: 10 }).points).toEqual([]);
    });

    it('reports the parameters it used', () => {
        const { dimensions } = computeDotMatrix('ACGTACGT', 'ACGT', {
            windowSize: 3,
            threshold: 80,
        });
        expect(dimensions).toMatchObject({
            lengthA: 8,
            lengthB: 4,
            windowSize: 3,
            threshold: 80,
            truncatedA: false,
            truncatedB: false,
        });
    });
});

describe('computeDotMatrix — truncation and sampling', () => {
    it('truncates both sequences at maxLength and says so', () => {
        const long = 'ACGT'.repeat(300); // 1200
        const { dimensions } = computeDotMatrix(long, 'ACGT', {});
        expect(dimensions.lengthA).toBe(DEFAULT_MAX_LENGTH);
        expect(dimensions.truncatedA).toBe(true);
        expect(dimensions.truncatedB).toBe(false);
    });

    it('honours a custom maxLength', () => {
        const { dimensions } = computeDotMatrix('A'.repeat(100), 'A'.repeat(100), {
            maxLength: 50,
        });
        expect(dimensions.lengthA).toBe(50);
        expect(dimensions.lengthB).toBe(50);
    });

    it('uses a stride of 1 below the sampling target', () => {
        const { dimensions } = computeDotMatrix('ACGT'.repeat(10), 'ACGT'.repeat(10));
        expect(dimensions.stepA).toBe(1);
        expect(dimensions.stepB).toBe(1);
    });

    it('strides above the sampling target to bound the scan', () => {
        const long = 'ACGT'.repeat(200); // 800 residues -> floor(800/300) = 2
        const { dimensions } = computeDotMatrix(long, long);
        expect(dimensions.stepA).toBe(2);
        expect(dimensions.stepB).toBe(2);
    });

    it('keeps the point count bounded for large inputs', () => {
        const long = 'A'.repeat(800);
        const { points } = computeDotMatrix(long, long, { windowSize: 10, threshold: 100 });
        // ~396 sampled offsets per axis, squared, is the hard ceiling.
        expect(points.length).toBeLessThanOrEqual(400 * 400);
        expect(points.length).toBeGreaterThan(0);
    });
});

describe('computeDotMatrix — case and error paths', () => {
    it('is case insensitive', () => {
        const upper = computeDotMatrix('ACGTACGT', 'ACGTACGT', { windowSize: 4 });
        const lower = computeDotMatrix('acgtacgt', 'ACGTACGT', { windowSize: 4 });
        expect(lower.points).toEqual(upper.points);
    });

    it('throws BioError EMPTY_SEQUENCE when either sequence is empty', () => {
        for (const args of [
            ['', 'ACGT'],
            ['ACGT', ''],
            ['', ''],
            [null, 'ACGT'],
        ]) {
            expect(() => computeDotMatrix(...args)).toThrow(BioError);
            try {
                computeDotMatrix(...args);
            } catch (e) {
                expect(e.code).toBe('EMPTY_SEQUENCE');
                expect(e.message).toBe('Sequences are empty');
            }
        }
    });

    it('throws BioError INVALID_WINDOW for a non-positive window', () => {
        for (const w of [0, -5, NaN, Infinity]) {
            try {
                computeDotMatrix('ACGT', 'ACGT', { windowSize: w });
                expect.unreachable(`windowSize ${w} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_WINDOW');
            }
        }
    });

    it('throws BioError INVALID_THRESHOLD outside 0-100', () => {
        for (const t of [-1, 101, NaN]) {
            try {
                computeDotMatrix('ACGT', 'ACGT', { threshold: t });
                expect.unreachable(`threshold ${t} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_THRESHOLD');
            }
        }
    });

    it('validates parameters before looking at the sequences', () => {
        try {
            computeDotMatrix('', '', { windowSize: 0 });
        } catch (e) {
            expect(e.code).toBe('INVALID_WINDOW');
        }
    });

    it('returns no HTML anywhere in the result', () => {
        const json = JSON.stringify(computeDotMatrix('ACGTACGT', 'ACGTACGT'));
        expect(json).not.toMatch(/<[a-z]/i);
    });
});
