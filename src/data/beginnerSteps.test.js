import { describe, expect, it } from 'vitest';
import { BEGINNER_STEPS } from './beginnerSteps.js';
import { LESSONS, PRACTICE_PACKS } from './practice.js';
import { translate } from '../utils/bioUtils.js';

describe('beginner learning flow', () => {
    it('provides one bilingual task and a valid two-choice question per step', () => {
        for (const lesson of LESSONS) {
            const steps = BEGINNER_STEPS[lesson.id];
            expect(steps).toHaveLength(lesson.steps.length);
            for (const step of steps) {
                for (const field of ['title','concept','action','question','explanation']) {
                    expect(step[field]).toHaveLength(2);
                    expect(step[field].every(text => text.trim().length > 0)).toBe(true);
                }
                expect(step.choices).toHaveLength(2);
                expect([0,1]).toContain(step.correct);
                expect(step.choices.every(choice => choice.length === 2)).toBe(true);
            }
        }
    });
    it('opens a compatible tool for every guided action', () => {
        const tools = {select:'viewer','select-all':'viewer',translate:'translation',statistics:'statistics',motif:'motif',pair:'alignment',multiple:'alignment'};
        for (const lesson of LESSONS) {
            BEGINNER_STEPS[lesson.id].forEach((step, index) => expect(lesson.steps[index].tool).toBe(tools[step.task]));
        }
    });
    it('keeps the one-letter difference and peptide explanations consistent with the samples', () => {
        const coding = PRACTICE_PACKS.find(p=>p.id==='translation').samples[0].sequence;
        expect(translate(coding)).toBe('MKGFPE*');
        const [a,b,c] = PRACTICE_PACKS.find(p=>p.id==='alignment').samples.map(s=>s.sequence);
        expect([...a].filter((letter,i)=>letter!==b[i])).toHaveLength(1);
        expect(a.length-c.length).toBe(4);
        expect(a.replace('AGCT','')).toBe(c);
    });
});
