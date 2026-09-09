import { describe, expect, it } from 'vitest';
import { PRACTICE_PACKS, LESSONS } from './practice.js';
import { gcContent, translate } from '../utils/bioUtils.js';
describe('teaching examples', () => {
    it('contains 16 uniquely named synthetic examples with valid alphabets', () => {
        const samples=PRACTICE_PACKS.flatMap(p=>p.samples);
        expect(samples).toHaveLength(16);expect(new Set(samples.map(s=>s.name)).size).toBe(16);
        for(const s of samples){ expect(s.organism).toContain('Synthetic');expect(s.sequence).toMatch(s.type==='protein'?/^[ACDEFGHIKLMNPQRSTVWY]+$/:s.type==='rna'?/^[ACGU]+$/:/^[ACGT]+$/); }
    });
    it('matches the translation and GC lesson answers',()=>{
        expect(translate(PRACTICE_PACKS[0].samples[0].sequence)).toBe('MKGFPE*');
        expect(PRACTICE_PACKS[1].samples.slice(0,3).map(s=>gcContent(s.sequence))).toEqual([20,50,80]);
        expect([...PRACTICE_PACKS[1].samples[3].sequence.matchAll(/ATG/g)].map(m=>m.index+1)).toEqual([4,9,15]);
    });
    it('points every lesson step to an existing sample',()=>{
        for(const lesson of LESSONS){const pack=PRACTICE_PACKS.find(p=>p.id===lesson.pack);expect(pack).toBeDefined();for(const step of lesson.steps)expect(pack.samples[step.sample||0]).toBeDefined();}
    });
});
