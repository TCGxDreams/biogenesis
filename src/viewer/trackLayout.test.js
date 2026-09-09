import { describe, it, expect } from 'vitest';
import { computeRowLayout, BAND_HEIGHTS, ROW_GAP, DEFAULT_TRACKS } from './trackLayout.js';

/** @param {Partial<import('./trackLayout.js').TrackFlags>} overrides */
const tracks = overrides => ({ ...DEFAULT_TRACKS, ...overrides });

describe('computeRowLayout', () => {
    it('always includes a ruler and a forward strand', () => {
        const layout = computeRowLayout({
            tracks: tracks({ features: false, complement: false }),
            laneCount: 0,
            type: 'dna',
        });
        expect(layout.bands.map(b => b.id)).toEqual(['ruler', 'forward']);
        expect(layout.rowHeight).toBe(BAND_HEIGHTS.ruler + BAND_HEIGHTS.strand + ROW_GAP);
    });

    it('stacks bands without gaps or overlaps', () => {
        const layout = computeRowLayout({
            tracks: tracks({
                features: true,
                enzymes: true,
                translation: true,
                reverseTranslation: true,
                gc: true,
            }),
            laneCount: 3,
            type: 'dna',
        });
        let expected = 0;
        for (const band of layout.bands) {
            expect(band.y).toBe(expected);
            expected += band.height;
        }
        expect(layout.rowHeight).toBe(expected + ROW_GAP);
    });

    it('draws annotations above the ruler and translations below the strands', () => {
        const ids = computeRowLayout({
            tracks: tracks({ features: true, enzymes: true, translation: true, gc: true }),
            laneCount: 1,
            type: 'dna',
        }).bands.map(b => b.id);
        expect(ids.indexOf('enzymes')).toBeLessThan(ids.indexOf('features'));
        expect(ids.indexOf('features')).toBeLessThan(ids.indexOf('ruler'));
        expect(ids.indexOf('forward')).toBeLessThan(ids.indexOf('frame+'));
        expect(ids.indexOf('frame+')).toBeLessThan(ids.indexOf('gc'));
    });

    it('gives one band per annotation lane', () => {
        const layout = computeRowLayout({
            tracks: tracks({ features: true }),
            laneCount: 4,
            type: 'dna',
        });
        const lanes = layout.bands.filter(b => b.id === 'features');
        expect(lanes.map(b => b.lane)).toEqual([0, 1, 2, 3]);
    });

    it('emits three bands per translation direction', () => {
        const layout = computeRowLayout({
            tracks: tracks({ translation: true, reverseTranslation: true }),
            laneCount: 0,
            type: 'dna',
        });
        expect(layout.bands.filter(b => b.id === 'frame+').map(b => b.frame)).toEqual([0, 1, 2]);
        expect(layout.bands.filter(b => b.id === 'frame-').map(b => b.frame)).toEqual([0, 1, 2]);
    });

    it('drops nucleic-acid tracks for a protein however the flags are set', () => {
        const ids = computeRowLayout({
            tracks: tracks({
                complement: true,
                translation: true,
                reverseTranslation: true,
                enzymes: true,
                gc: true,
                features: true,
            }),
            laneCount: 2,
            type: 'protein',
        }).bands.map(b => b.id);
        expect(ids).toEqual(['features', 'features', 'ruler', 'forward']);
    });

    it('looks bands up by id, disambiguating frames and lanes', () => {
        const layout = computeRowLayout({
            tracks: tracks({ features: true, translation: true }),
            laneCount: 2,
            type: 'dna',
        });
        expect(layout.band('frame+2')?.frame).toBe(2);
        expect(layout.band('features1')?.lane).toBe(1);
        expect(layout.band('ruler')?.height).toBe(BAND_HEIGHTS.ruler);
        expect(layout.band('gc')).toBeUndefined();
    });

    it('reserves no lane space when annotations are switched off', () => {
        const layout = computeRowLayout({
            tracks: tracks({ features: false }),
            laneCount: 5,
            type: 'dna',
        });
        expect(layout.bands.some(b => b.id === 'features')).toBe(false);
    });
});
