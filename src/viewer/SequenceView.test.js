import { describe, it, expect } from 'vitest';
import { parseCoordinate } from './SequenceView.js';

describe('parseCoordinate', () => {
    it('turns a 1-based position into a single-residue range', () => {
        expect(parseCoordinate('100', 1000)).toEqual({ start: 99, end: 100 });
    });

    it('accepts GenBank, hyphen and colon range separators', () => {
        for (const text of ['100..200', '100-200', '100:200']) {
            expect(parseCoordinate(text, 1000)).toEqual({ start: 99, end: 200 });
        }
    });

    it('ignores commas and whitespace', () => {
        expect(parseCoordinate(' 1,234 .. 5,678 ', 10_000)).toEqual({ start: 1233, end: 5678 });
    });

    it('clamps beyond the end of the sequence', () => {
        expect(parseCoordinate('900..5000', 1000)).toEqual({ start: 899, end: 1000 });
        expect(parseCoordinate('9999', 1000)).toEqual({ start: 999, end: 1000 });
    });

    it('collapses a reversed range to its start', () => {
        expect(parseCoordinate('500..100', 1000)).toEqual({ start: 499, end: 500 });
    });

    it('rejects anything that is not a coordinate', () => {
        for (const text of ['', '   ', 'ATG', '12x', '..', '1..']) {
            expect(parseCoordinate(text, 1000)).toBeNull();
        }
    });
});
