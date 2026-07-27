import { describe, it, expect } from 'vitest';
import {
    translateSixFrames,
    findFrameOrfs,
    DEFAULT_MAX_LENGTH,
    DEFAULT_MIN_ORF_LENGTH,
} from './translation.js';
import { BioError } from './errors.js';
import { translate, reverseComplement } from '../utils/bioUtils.js';
import { SAMPLE_SEQUENCES } from '../data/sampleSequences.js';

const pUC19 = SAMPLE_SEQUENCES.find(s => s.name === 'pUC19').sequence;

describe('findFrameOrfs', () => {
    it('opens on M and closes on the next stop', () => {
        const protein = 'AAM' + 'K'.repeat(10) + '*AA';
        expect(findFrameOrfs(protein, '+1', 'forward')).toEqual([
            {
                frame: '+1',
                direction: 'forward',
                start: 2,
                end: 13,
                length: 11,
                protein: 'M' + 'K'.repeat(10) + '*',
            },
        ]);
    });

    it('includes the stop character in the reported protein', () => {
        const [orf] = findFrameOrfs('M' + 'K'.repeat(10) + '*', '+1', 'forward');
        expect(orf.protein.endsWith('*')).toBe(true);
        expect(orf.protein).toHaveLength(orf.length + 1);
    });

    it('drops ORFs shorter than the minimum', () => {
        expect(findFrameOrfs('MKKK*', '+1', 'forward')).toEqual([]);
        expect(findFrameOrfs('MKKK*', '+1', 'forward', 4)).toHaveLength(1);
    });

    it('ignores an ORF with no stop codon', () => {
        expect(findFrameOrfs('M' + 'K'.repeat(50), '+1', 'forward')).toEqual([]);
    });

    it('does not open a nested ORF on an internal M', () => {
        const protein = 'M' + 'K'.repeat(5) + 'M' + 'K'.repeat(5) + '*';
        const orfs = findFrameOrfs(protein, '+1', 'forward');
        expect(orfs).toHaveLength(1);
        expect(orfs[0].start).toBe(0);
    });

    it('finds several ORFs in sequence', () => {
        const unit = 'M' + 'K'.repeat(10) + '*';
        const orfs = findFrameOrfs(unit + unit, '+1', 'forward');
        expect(orfs.map(o => o.start)).toEqual([0, 12]);
    });

    it('returns an empty array for an empty protein', () => {
        expect(findFrameOrfs('', '+1', 'forward')).toEqual([]);
    });

    it('defaults the minimum ORF length to 10', () => {
        expect(DEFAULT_MIN_ORF_LENGTH).toBe(10);
    });
});

describe('translateSixFrames — frames', () => {
    const result = translateSixFrames('ATGAAATTTGGGCCCTAA');

    it('returns three forward then three reverse frames', () => {
        expect(result.frames.map(f => f.label)).toEqual(['+1', '+2', '+3', '-1', '-2', '-3']);
        expect(result.frames.map(f => f.direction)).toEqual([
            'forward',
            'forward',
            'forward',
            'reverse',
            'reverse',
            'reverse',
        ]);
    });

    it('translates each forward frame at its own offset', () => {
        for (let f = 0; f < 3; f++) {
            expect(result.frames[f].protein).toBe(translate(result.dna, f));
            expect(result.frames[f].frame).toBe(f);
        }
    });

    it('translates reverse frames from the reverse complement', () => {
        expect(result.rcDna).toBe(reverseComplement('ATGAAATTTGGGCCCTAA'));
        for (let f = 0; f < 3; f++) {
            expect(result.frames[3 + f].protein).toBe(translate(result.rcDna, f));
        }
    });

    it('translates frame +1 correctly', () => {
        expect(result.frames[0].protein).toBe('MKFGP*');
    });

    it('uppercases the input', () => {
        expect(translateSixFrames('atgaaatttgggccctaa').frames[0].protein).toBe('MKFGP*');
    });

    it('emits X for codons containing N', () => {
        expect(translateSixFrames('ATGNNNAAA').frames[0].protein).toBe('MXK');
    });
});

describe('translateSixFrames — ORFs', () => {
    const seq = 'ATG' + 'AAA'.repeat(12) + 'TAA';

    it('finds the ORF in frame +1', () => {
        const { orfs } = translateSixFrames(seq);
        expect(orfs.length).toBeGreaterThanOrEqual(1);
        // M + 12 K + stop: the stop sits at index 13, so length is 13.
        expect(orfs[0]).toMatchObject({ frame: '+1', direction: 'forward', start: 0, length: 13 });
        expect(orfs[0].protein).toBe('M' + 'K'.repeat(12) + '*');
    });

    it('sorts ORFs longest first', () => {
        const lengths = translateSixFrames(pUC19).orfs.map(o => o.length);
        expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
    });

    it('collects the same ORFs that each frame reports', () => {
        const { frames, orfs } = translateSixFrames(pUC19);
        const fromFrames = frames.flatMap(f => f.orfs);
        expect(orfs).toHaveLength(fromFrames.length);
        expect([...orfs].sort((a, b) => a.protein.localeCompare(b.protein))).toEqual(
            fromFrames.sort((a, b) => a.protein.localeCompare(b.protein))
        );
    });

    it('honours a custom minimum ORF length', () => {
        const loose = translateSixFrames(pUC19, { minOrfLength: 5 });
        const strict = translateSixFrames(pUC19, { minOrfLength: 50 });
        expect(loose.orfs.length).toBeGreaterThan(strict.orfs.length);
        for (const orf of strict.orfs) expect(orf.length).toBeGreaterThanOrEqual(50);
    });

    it('finds no ORFs in a sequence with no ATG', () => {
        expect(translateSixFrames('TTTTTTTTTTTTTTTTTTTTTT').orfs).toEqual([]);
    });

    it('labels reverse-strand ORFs with a minus sign', () => {
        const rcSeq = reverseComplement('ATG' + 'AAA'.repeat(12) + 'TAA');
        const { orfs } = translateSixFrames(rcSeq);
        expect(orfs.some(o => o.frame.startsWith('-'))).toBe(true);
    });
});

describe('translateSixFrames — truncation', () => {
    it('truncates at maxLength and flags it', () => {
        const long = 'ATGAAATTTGGGCCCTAA'.repeat(200); // 3600 bp
        const result = translateSixFrames(long);
        expect(DEFAULT_MAX_LENGTH).toBe(3000);
        expect(result.dna).toHaveLength(3000);
        expect(result.rcDna).toHaveLength(3000);
        expect(result.sequenceLength).toBe(3600);
        expect(result.truncated).toBe(true);
    });

    it('translates everything when maxLength is Infinity', () => {
        const long = 'ATGAAATTTGGGCCCTAA'.repeat(200);
        const result = translateSixFrames(long, { maxLength: Infinity });
        expect(result.dna).toHaveLength(3600);
        expect(result.truncated).toBe(false);
    });

    it('finds more ORFs on the full sequence than on the truncated view', () => {
        const long = ('ATG' + 'AAA'.repeat(12) + 'TAA').repeat(100); // 4800 bp
        const view = translateSixFrames(long);
        const full = translateSixFrames(long, { maxLength: Infinity });
        expect(full.orfs.length).toBeGreaterThan(view.orfs.length);
    });

    it('takes the reverse complement of the whole sequence before truncating', () => {
        // The displayed reverse strand is the 3' end of the input, not the 5'.
        const seq = 'ATGC'.repeat(100); // 400 bp
        const result = translateSixFrames(seq, { maxLength: 100 });
        expect(result.rcDna).toBe(reverseComplement(seq).substring(0, 100));
    });

    it('reports truncated false when the sequence fits', () => {
        expect(translateSixFrames('ATGAAA').truncated).toBe(false);
    });
});

describe('translateSixFrames — edge cases and errors', () => {
    it('handles an empty sequence', () => {
        const result = translateSixFrames('');
        expect(result.frames).toHaveLength(6);
        for (const f of result.frames) expect(f.protein).toBe('');
        expect(result.orfs).toEqual([]);
        expect(result.sequenceLength).toBe(0);
    });

    it('handles a sequence shorter than one codon', () => {
        expect(translateSixFrames('AT').frames[0].protein).toBe('');
    });

    it('throws BioError INVALID_SEQUENCE for a non-string sequence', () => {
        for (const bad of [null, undefined, 42, {}]) {
            try {
                translateSixFrames(bad);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('returns no HTML anywhere in the result', () => {
        expect(JSON.stringify(translateSixFrames(pUC19))).not.toMatch(/<[a-z]/i);
    });
});
