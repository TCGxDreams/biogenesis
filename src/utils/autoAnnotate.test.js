import { describe, it, expect } from 'vitest';
import { autoAnnotate } from './autoAnnotate.js';
import { reverseComplement } from './bioUtils.js';

const T7_PROMOTER = 'TAATACGACTCACTATAGGG';
const HIS_TAG = 'CATCACCATCACCATCAC';

const dna = sequence => ({ name: 'test', type: 'dna', sequence });

describe('autoAnnotate', () => {
    it('annotates a known feature on the forward strand with 0-based half-open bounds', () => {
        const seq = dna('AAAA' + T7_PROMOTER + 'TTTT');
        const result = autoAnnotate(seq);
        const hit = result.annotations.find(a => a.name === 'T7 promoter');
        expect(hit).toMatchObject({
            name: 'T7 promoter',
            type: 'promoter',
            start: 4,
            end: 4 + T7_PROMOTER.length,
            direction: 'forward',
        });
        expect(seq.sequence.substring(hit.start, hit.end)).toBe(T7_PROMOTER);
    });

    it('annotates a feature on the reverse strand in forward-strand coordinates', () => {
        const seq = dna('AAAA' + reverseComplement(T7_PROMOTER) + 'TTTT');
        const hit = autoAnnotate(seq).annotations.find(a => a.name === 'T7 promoter');
        expect(hit).toMatchObject({ direction: 'reverse', start: 4, end: 24 });
        expect(reverseComplement(seq.sequence.substring(hit.start, hit.end))).toBe(T7_PROMOTER);
    });

    it('finds every occurrence of a repeated feature', () => {
        const seq = dna(T7_PROMOTER + 'GGGG' + T7_PROMOTER);
        const hits = autoAnnotate(seq).annotations.filter(a => a.name === 'T7 promoter');
        expect(hits.map(h => h.start).sort((a, b) => a - b)).toEqual([0, 24]);
    });

    it('finds several distinct features in one sequence', () => {
        const seq = dna(T7_PROMOTER + 'AAAA' + HIS_TAG);
        const names = autoAnnotate(seq).annotations.map(a => a.name);
        expect(names).toContain('T7 promoter');
        expect(names).toContain('6xHis tag');
    });

    it('is idempotent — running twice does not duplicate annotations', () => {
        const seq = dna('AAAA' + T7_PROMOTER + 'TTTT');
        const first = autoAnnotate(seq).annotations.length;
        const second = autoAnnotate(seq).annotations.length;
        expect(second).toBe(first);
    });

    it('preserves pre-existing annotations', () => {
        const seq = dna('AAAA' + T7_PROMOTER);
        seq.annotations = [{ name: 'manual', type: 'misc_feature', start: 0, end: 4 }];
        const names = autoAnnotate(seq).annotations.map(a => a.name);
        expect(names).toContain('manual');
        expect(names).toContain('T7 promoter');
    });

    it('adds no annotations to a sequence with no known features', () => {
        expect(autoAnnotate(dna('AAAAAAAAAAAAAAAAAAAA')).annotations).toEqual([]);
    });

    it('skips protein sequences untouched', () => {
        const protein = { name: 'p', type: 'protein', sequence: 'MKWVTFISLLLL' };
        expect(autoAnnotate(protein)).toBe(protein);
        expect(protein.annotations).toBeUndefined();
    });

    it('returns the input unchanged when there is no sequence', () => {
        expect(autoAnnotate(null)).toBe(null);
        const empty = { name: 'x', type: 'dna', sequence: '' };
        expect(autoAnnotate(empty)).toBe(empty);
    });
});
