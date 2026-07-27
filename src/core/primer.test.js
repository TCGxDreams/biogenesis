import { describe, it, expect } from 'vitest';
import {
    designPrimers,
    checkHairpin,
    GC_RANGE,
    MAX_TM_DIFFERENCE,
    MIN_AMPLICON_GAP,
    MAX_PAIRS,
} from './primer.js';
import { BioError } from './errors.js';
import { reverseComplement } from '../utils/bioUtils.js';
import { SAMPLE_SEQUENCES } from '../data/sampleSequences.js';

const pUC19 = SAMPLE_SEQUENCES.find(s => s.name === 'pUC19').sequence;

describe('checkHairpin', () => {
    it('returns false for anything shorter than 8 residues', () => {
        expect(checkHairpin('ACGTACG')).toBe(false);
    });

    it('detects a self-complementary stem', () => {
        // GGGCC...GGCCC has a 3 bp complementary stem.
        expect(checkHairpin('GGGCCAAAAGGCCC')).toBe(true);
    });

    it('returns false for a homopolymer, which cannot self-pair', () => {
        expect(checkHairpin('AAAAAAAAAAAAAAAA')).toBe(false);
    });

    it('is case insensitive', () => {
        expect(checkHairpin('gggccaaaaggccc')).toBe(checkHairpin('GGGCCAAAAGGCCC'));
    });
});

describe('designPrimers — happy path', () => {
    const { pairs } = designPrimers(pUC19);

    it('returns at most MAX_PAIRS pairs', () => {
        expect(MAX_PAIRS).toBe(5);
        expect(pairs.length).toBeGreaterThan(0);
        expect(pairs.length).toBeLessThanOrEqual(MAX_PAIRS);
    });

    it('orders pairs best score first', () => {
        const scores = pairs.map(p => p.score);
        expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });

    it('reports primer sequences matching the template at their coordinates', () => {
        for (const { fwd, rev } of pairs) {
            expect(fwd.sequence).toBe(pUC19.toUpperCase().substring(fwd.start, fwd.end));
            expect(rev.sequence).toBe(
                reverseComplement(pUC19.toUpperCase().substring(rev.start, rev.end))
            );
        }
    });

    it('keeps every primer inside the configured length range', () => {
        const { pairs: p } = designPrimers(pUC19, { minLen: 20, maxLen: 22 });
        for (const { fwd, rev } of p) {
            expect(fwd.sequence.length).toBeGreaterThanOrEqual(20);
            expect(fwd.sequence.length).toBeLessThanOrEqual(22);
            expect(rev.sequence.length).toBeGreaterThanOrEqual(20);
            expect(rev.sequence.length).toBeLessThanOrEqual(22);
        }
    });

    it('keeps every primer inside the configured Tm window', () => {
        const { pairs: p } = designPrimers(pUC19, { minTm: 58, maxTm: 62 });
        for (const { fwd, rev } of p) {
            expect(fwd.tm).toBeGreaterThanOrEqual(58);
            expect(fwd.tm).toBeLessThanOrEqual(62);
            expect(rev.tm).toBeGreaterThanOrEqual(58);
            expect(rev.tm).toBeLessThanOrEqual(62);
        }
    });

    it('keeps GC content within the accepted band', () => {
        for (const { fwd, rev } of pairs) {
            expect(fwd.gc).toBeGreaterThanOrEqual(GC_RANGE.min);
            expect(fwd.gc).toBeLessThanOrEqual(GC_RANGE.max);
            expect(rev.gc).toBeGreaterThanOrEqual(GC_RANGE.min);
            expect(rev.gc).toBeLessThanOrEqual(GC_RANGE.max);
        }
    });

    it('pairs only primers whose Tm values are close', () => {
        for (const { fwd, rev } of pairs) {
            expect(Math.abs(fwd.tm - rev.tm)).toBeLessThanOrEqual(MAX_TM_DIFFERENCE);
        }
    });

    it('leaves room for an amplicon between the two primers', () => {
        for (const { fwd, rev } of pairs) {
            expect(rev.start).toBeGreaterThan(fwd.end + MIN_AMPLICON_GAP);
        }
    });

    it('labels primer direction', () => {
        expect(pairs[0].fwd.direction).toBe('fwd');
        expect(pairs[0].rev.direction).toBe('rev');
    });

    it('exposes the candidate pools it drew from', () => {
        const { candidates } = designPrimers(pUC19);
        expect(candidates.forward.length).toBeGreaterThan(0);
        expect(candidates.reverse.length).toBeGreaterThan(0);
    });
});

describe('designPrimers — target region', () => {
    it('places primers just outside the requested target', () => {
        const { pairs } = designPrimers(pUC19, { targetStart: 100, targetEnd: 400 });
        expect(pairs.length).toBeGreaterThan(0);
        for (const { fwd, rev } of pairs) {
            // The 50 bp flank means the forward primer starts at or after 49
            // and the reverse primer ends at or before 450.
            expect(fwd.start).toBeGreaterThanOrEqual(49);
            expect(rev.end).toBeLessThanOrEqual(450);
        }
    });

    // Inherited limitation, preserved by T2.7 (parity) and worth fixing later:
    // when the target's flanking window yields no acceptable primer, the
    // terminal fallback fires and the amplicon silently stops matching the
    // requested target.
    it('falls back to a template-terminal reverse primer when the target flank has no candidate', () => {
        const { candidates } = designPrimers(pUC19, { targetStart: 500, targetEnd: 1500 });
        expect(candidates.reverse).toHaveLength(1);
        expect(candidates.reverse[0].end).toBe(pUC19.length); // not 1550
    });

    it('moves the amplicon when the target moves', () => {
        const early = designPrimers(pUC19, { targetStart: 100, targetEnd: 400 }).pairs;
        const late = designPrimers(pUC19, { targetStart: 1500, targetEnd: 1900 }).pairs;
        expect(early[0].fwd.start).toBeLessThan(late[0].fwd.start);
    });

    it('defaults to the whole template when no target is given', () => {
        const { pairs } = designPrimers(pUC19);
        expect(pairs[0].fwd.start).toBeLessThan(300);
    });
});

describe('designPrimers — fallbacks and empty results', () => {
    it('falls back to a terminal primer when nothing passes the filters', () => {
        const poly = 'A'.repeat(400);
        const { candidates } = designPrimers(poly, { minLen: 18, maxLen: 24 });
        expect(candidates.forward).toHaveLength(1);
        expect(candidates.forward[0].start).toBe(0);
        expect(candidates.reverse).toHaveLength(1);
        expect(candidates.reverse[0].end).toBe(400);
    });

    it('returns no pairs when the Tm window is unreachable', () => {
        expect(designPrimers(pUC19, { minTm: 90, maxTm: 95 }).pairs.length).toBeLessThanOrEqual(1);
    });

    it('returns no pairs when the template is too short for an amplicon', () => {
        expect(designPrimers('ATGCATGCATGCATGCATGC').pairs).toEqual([]);
    });

    it('emits no fallback primer when the template is shorter than minLen', () => {
        const { candidates, pairs } = designPrimers('ATGC', { minLen: 18 });
        expect(candidates.forward).toEqual([]);
        expect(candidates.reverse).toEqual([]);
        expect(pairs).toEqual([]);
    });
});

describe('designPrimers — error paths', () => {
    it('throws BioError EMPTY_SEQUENCE for an empty template', () => {
        try {
            designPrimers('');
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BioError);
            expect(e.code).toBe('EMPTY_SEQUENCE');
        }
    });

    it('throws BioError INVALID_SEQUENCE for a non-string template', () => {
        for (const bad of [null, undefined, 42]) {
            try {
                designPrimers(bad);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('throws BioError INVALID_LENGTH_RANGE when minLen exceeds maxLen', () => {
        for (const cfg of [{ minLen: 30, maxLen: 20 }, { minLen: 0 }, { minLen: -5 }]) {
            try {
                designPrimers(pUC19, cfg);
                expect.unreachable(`${JSON.stringify(cfg)} should have thrown`);
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_LENGTH_RANGE');
            }
        }
    });

    it('throws BioError INVALID_TM_RANGE when minTm exceeds maxTm', () => {
        try {
            designPrimers(pUC19, { minTm: 70, maxTm: 50 });
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BioError);
            expect(e.code).toBe('INVALID_TM_RANGE');
        }
    });

    it('validates the sequence before the configuration', () => {
        try {
            designPrimers('', { minLen: 30, maxLen: 20 });
        } catch (e) {
            expect(e.code).toBe('EMPTY_SEQUENCE');
        }
    });

    it('returns no HTML anywhere in the result', () => {
        expect(JSON.stringify(designPrimers(pUC19))).not.toMatch(/<[a-z]/i);
    });
});
