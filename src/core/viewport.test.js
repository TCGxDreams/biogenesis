import { describe, it, expect } from 'vitest';
import {
    MIN_CHAR_WIDTH,
    MAX_CHAR_WIDTH,
    zoomToCharWidth,
    charWidthToZoom,
    zoomToFit,
    detailFor,
    computeLayout,
    rowOfResidue,
    rowRange,
    visibleRowRange,
    residueAtPoint,
    xOfResidue,
    tickStep,
    clamp,
} from './viewport.js';

describe('zoomToCharWidth', () => {
    it('spans the full character width range', () => {
        expect(zoomToCharWidth(0)).toBeCloseTo(MIN_CHAR_WIDTH, 6);
        expect(zoomToCharWidth(1)).toBeCloseTo(MAX_CHAR_WIDTH, 6);
    });

    it('is monotonic', () => {
        let previous = 0;
        for (let z = 0; z <= 1; z += 0.05) {
            const cw = zoomToCharWidth(z);
            expect(cw).toBeGreaterThan(previous);
            previous = cw;
        }
    });

    it('clamps out-of-range zoom', () => {
        expect(zoomToCharWidth(-3)).toBeCloseTo(MIN_CHAR_WIDTH, 6);
        expect(zoomToCharWidth(9)).toBeCloseTo(MAX_CHAR_WIDTH, 6);
    });

    it('round-trips through charWidthToZoom', () => {
        for (const z of [0, 0.13, 0.5, 0.77, 1]) {
            expect(charWidthToZoom(zoomToCharWidth(z))).toBeCloseTo(z, 6);
        }
    });
});

describe('detailFor', () => {
    it('draws letters only when residues are wide enough to read', () => {
        expect(detailFor(12)).toBe('letters');
        expect(detailFor(3)).toBe('blocks');
        expect(detailFor(0.2)).toBe('density');
    });
});

describe('zoomToFit', () => {
    it('produces a layout of exactly one row', () => {
        const length = 48_502;
        const zoom = zoomToFit(length, 928);
        const layout = computeLayout({ length, viewportWidth: 1000, zoom });
        expect(layout.rowCount).toBe(1);
        expect(layout.singleRow).toBe(true);
    });

    it('fits every length on exactly one row, despite float error', () => {
        // A width derived from zoomToFit round-trips through two logarithms and
        // lands a hair wide, which used to wrap one residue onto a second row.
        for (const length of [1, 2, 99, 2686, 4361, 5386, 48_502, 1_000_003]) {
            for (const viewportWidth of [640, 1000, 1287, 1920]) {
                const zoom = zoomToFit(length, viewportWidth - 72);
                const layout = computeLayout({ length, viewportWidth, zoom });
                expect({ length, viewportWidth, rowCount: layout.rowCount }).toEqual({
                    length,
                    viewportWidth,
                    rowCount: 1,
                });
            }
        }
    });

    it('is defined for degenerate inputs', () => {
        expect(zoomToFit(0, 900)).toBe(0);
        expect(zoomToFit(100, 0)).toBe(0);
    });
});

describe('computeLayout', () => {
    it('rounds residues per row to a multiple of ten at letter detail', () => {
        const layout = computeLayout({ length: 5000, viewportWidth: 1000, zoom: 1 });
        expect(layout.detail).toBe('letters');
        expect(layout.basesPerRow % 10).toBe(0);
    });

    it('covers the whole sequence', () => {
        for (const zoom of [0.2, 0.5, 0.8, 1]) {
            const length = 3717;
            const layout = computeLayout({ length, viewportWidth: 1000, zoom });
            expect(layout.rowCount * layout.basesPerRow).toBeGreaterThanOrEqual(length);
            expect((layout.rowCount - 1) * layout.basesPerRow).toBeLessThan(length);
        }
    });

    it('does not wrap a sequence that fits, despite the multiple-of-ten rounding', () => {
        // 928px of track at 20px per residue holds 46 residues; rounding down to
        // 40 would have pushed the last six onto a second row.
        const layout = computeLayout({ length: 44, viewportWidth: 1000, zoom: 1 });
        expect(layout.rowCount).toBe(1);
        expect(layout.basesPerRow).toBe(44);
    });

    it('never reports fewer than one row or one residue per row', () => {
        const layout = computeLayout({ length: 0, viewportWidth: 40, zoom: 1 });
        expect(layout.rowCount).toBe(1);
        expect(layout.basesPerRow).toBeGreaterThanOrEqual(1);
    });

    it('reserves the gutter from the track width', () => {
        const layout = computeLayout({ length: 100, viewportWidth: 500, zoom: 1, gutterWidth: 80 });
        expect(layout.trackWidth).toBe(420);
        expect(layout.gutterWidth).toBe(80);
    });
});

describe('rowOfResidue and rowRange', () => {
    it('agree with each other', () => {
        const basesPerRow = 60;
        for (const index of [0, 59, 60, 61, 599, 600]) {
            const row = rowOfResidue(index, basesPerRow);
            const { start, end } = rowRange(row, basesPerRow, 1000);
            expect(index).toBeGreaterThanOrEqual(start);
            expect(index).toBeLessThan(end);
        }
    });

    it('clips the final row to the sequence length', () => {
        expect(rowRange(2, 60, 130)).toEqual({ start: 120, end: 130 });
    });
});

describe('visibleRowRange', () => {
    it('includes a row of overscan on each side', () => {
        const range = visibleRowRange({
            scrollTop: 500,
            viewportHeight: 300,
            rowHeight: 100,
            rowCount: 50,
        });
        expect(range.first).toBe(4);
        expect(range.last).toBe(9);
    });

    it('stays inside the sequence at the extremes', () => {
        const top = visibleRowRange({
            scrollTop: 0,
            viewportHeight: 300,
            rowHeight: 100,
            rowCount: 2,
        });
        expect(top.first).toBe(0);
        expect(top.last).toBe(1);
    });

    it('survives a zero row height', () => {
        expect(
            visibleRowRange({ scrollTop: 0, viewportHeight: 100, rowHeight: 0, rowCount: 5 })
        ).toEqual({ first: 0, last: 0 });
    });
});

describe('residueAtPoint', () => {
    const layout = computeLayout({ length: 1000, viewportWidth: 1000, zoom: 1 });

    it('inverts xOfResidue', () => {
        for (const index of [0, 7, 39, 40, 83]) {
            const x = xOfResidue(index, layout);
            const row = rowOfResidue(index, layout.basesPerRow);
            const hit = residueAtPoint({
                x: x + layout.charWidth / 2,
                y: row * 100 + 50,
                layout,
                rowHeight: 100,
                length: 1000,
            });
            expect(hit).toBe(index);
        }
    });

    it('clamps a point in the gutter to the start of its row', () => {
        const hit = residueAtPoint({ x: 4, y: 150, layout, rowHeight: 100, length: 1000 });
        expect(hit).toBe(layout.basesPerRow);
    });

    it('clamps past the end of the sequence', () => {
        const hit = residueAtPoint({ x: 9999, y: 999999, layout, rowHeight: 100, length: 1000 });
        expect(hit).toBe(999);
    });

    it('returns 0 for an empty sequence', () => {
        expect(residueAtPoint({ x: 500, y: 500, layout, rowHeight: 100, length: 0 })).toBe(0);
    });
});

describe('tickStep', () => {
    it('leaves room for a label', () => {
        for (const charWidth of [0.1, 1, 4, 9.5, 20]) {
            expect(tickStep(charWidth, 56) * charWidth).toBeGreaterThanOrEqual(56);
        }
    });

    it('uses round numbers', () => {
        for (const charWidth of [0.05, 0.7, 3, 12]) {
            const step = tickStep(charWidth);
            const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
            expect([1, 2, 5]).toContain(Math.round(mantissa));
        }
    });
});

describe('clamp', () => {
    it('bounds on both sides', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(50, 0, 10)).toBe(10);
    });
});
