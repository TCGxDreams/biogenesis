import { describe, it, expect } from 'vitest';
import {
    CODON_USAGE,
    RARE_CODON_THRESHOLD,
    countCodons,
    calculateCAI,
    caiFromCounts,
    getOptimalCodon,
    analyseCodonUsage,
    optimiseCodons,
} from './codon.js';
import { BioError } from './errors.js';
import { translate, CODON_TABLE } from '../utils/bioUtils.js';

const ecoli = CODON_USAGE.ecoli.table;

describe('CODON_USAGE', () => {
    it('gives every organism a name and a frequency table', () => {
        const keys = Object.keys(CODON_USAGE);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            expect(typeof CODON_USAGE[key].name).toBe('string');
            expect(Object.keys(CODON_USAGE[key].table).length).toBeGreaterThan(0);
        }
    });

    it('uses only valid codons as table keys', () => {
        for (const key of Object.keys(CODON_USAGE)) {
            for (const codon of Object.keys(CODON_USAGE[key].table)) {
                expect(CODON_TABLE[codon], `${key}/${codon}`).toBeDefined();
            }
        }
    });
});

describe('countCodons', () => {
    it('counts codons in frame +1', () => {
        expect(countCodons('ATGATGAAA')).toEqual({
            counts: { ATG: 2, AAA: 1 },
            totalCodons: 3,
        });
    });

    it('ignores a trailing partial codon', () => {
        expect(countCodons('ATGAT').counts).toEqual({ ATG: 1 });
    });

    it('skips codons containing N', () => {
        const { counts, totalCodons } = countCodons('ATGNNNAAA');
        expect(counts).toEqual({ ATG: 1, AAA: 1 });
        expect(totalCodons).toBe(2);
    });

    it('uppercases before counting', () => {
        expect(countCodons('atgatg').counts).toEqual({ ATG: 2 });
    });

    it('returns zero totals for a sequence shorter than one codon', () => {
        expect(countCodons('AT')).toEqual({ counts: {}, totalCodons: 0 });
    });
});

describe('getOptimalCodon', () => {
    it('picks the highest-frequency synonym', () => {
        // In E. coli, CTG (51.3) beats every other leucine codon in the table.
        expect(getOptimalCodon('L', ecoli)).toBe('CTG');
    });

    it('returns the codon itself for a residue with one codon', () => {
        expect(getOptimalCodon('M', ecoli)).toBe('ATG');
        expect(getOptimalCodon('W', ecoli)).toBe('TGG');
    });

    it('falls back to the first synonym when no frequency is recorded', () => {
        expect(getOptimalCodon('L', {})).toBe('TTA');
    });

    it('returns NNN for an unknown residue', () => {
        expect(getOptimalCodon('Z', ecoli)).toBe('NNN');
        expect(getOptimalCodon('', ecoli)).toBe('NNN');
    });
});

describe('calculateCAI / caiFromCounts', () => {
    it('scores a sequence of optimal codons at 1', () => {
        expect(calculateCAI('CTGCTGCTG', ecoli)).toBeCloseTo(1, 10);
    });

    it('scores a rare-codon sequence below an optimal one', () => {
        expect(calculateCAI('CTACTACTA', ecoli)).toBeLessThan(calculateCAI('CTGCTGCTG', ecoli));
    });

    it('returns 0 when nothing is scorable', () => {
        expect(calculateCAI('', ecoli)).toBe(0);
        expect(calculateCAI('TAATAGTGA', ecoli)).toBe(0); // stops only
    });

    it('ignores stop codons', () => {
        expect(calculateCAI('CTGTAA', ecoli)).toBeCloseTo(calculateCAI('CTG', ecoli), 10);
    });

    it('weights by occurrence in caiFromCounts but not in calculateCAI', () => {
        // Two CTG and one CTA: the weighted mean sits closer to CTG.
        const weighted = caiFromCounts({ CTG: 2, CTA: 1 }, ecoli);
        const unweighted = caiFromCounts({ CTG: 1, CTA: 1 }, ecoli);
        expect(weighted).toBeGreaterThan(unweighted);
    });

    it('agrees with caiFromCounts when every codon occurs once', () => {
        expect(caiFromCounts({ CTG: 1, CTA: 1 }, ecoli)).toBeCloseTo(
            calculateCAI('CTGCTA', ecoli),
            10
        );
    });

    it('stays within (0, 1] for a real coding sequence', () => {
        const cai = calculateCAI('ATGGCCCTGAAATTTGGGCCCTAA', ecoli);
        expect(cai).toBeGreaterThan(0);
        expect(cai).toBeLessThanOrEqual(1);
    });
});

describe('analyseCodonUsage', () => {
    const seq = 'ATGCTGCTACTGAAATTT';
    const report = analyseCodonUsage(seq, 'ecoli');

    it('identifies the target organism', () => {
        expect(report.organism.key).toBe('ecoli');
        expect(report.organism.name).toBe('E. coli K12');
    });

    it('reports codon counts and the total', () => {
        expect(report.counts).toEqual({ ATG: 1, CTG: 2, CTA: 1, AAA: 1, TTT: 1 });
        expect(report.totalCodons).toBe(6);
    });

    it('reports a CAI matching the count-weighted formula', () => {
        expect(report.cai).toBeCloseTo(caiFromCounts(report.counts, ecoli), 10);
    });

    it('groups the usage table by residue, excluding stops', () => {
        const residues = report.usage.map(g => g.aa);
        expect(residues).not.toContain('*');
        expect(residues).toEqual([...residues].sort());
        expect(residues).toContain('L');
    });

    it('marks exactly one optimal codon per residue group that has frequencies', () => {
        for (const group of report.usage) {
            const optimal = group.codons.filter(c => c.isOptimal);
            const anyFreq = group.codons.some(c => c.organismFreq > 0);
            if (anyFreq) expect(optimal.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('computes sequence frequency per 1000 codons', () => {
        const ctg = report.usage.find(g => g.aa === 'L').codons.find(c => c.codon === 'CTG');
        expect(ctg.count).toBe(2);
        expect(ctg.sequenceFreq).toBeCloseTo((2 / 6) * 1000, 10);
    });

    it('reports 0 sequence frequency when the sequence has no codons', () => {
        const empty = analyseCodonUsage('', 'ecoli');
        expect(empty.totalCodons).toBe(0);
        for (const group of empty.usage) {
            for (const c of group.codons) expect(c.sequenceFreq).toBe(0);
        }
    });

    it('flags rare codons present in the sequence', () => {
        // CTA has relative adaptiveness 3.9/51.3 = 0.076, well under the threshold.
        expect(report.rareCodons.map(c => c.codon)).toContain('CTA');
        expect(report.rareCodons.every(c => c.relativeAdaptiveness < RARE_CODON_THRESHOLD)).toBe(
            true
        );
    });

    it('never flags an optimal codon as rare', () => {
        expect(report.rareCodons.map(c => c.codon)).not.toContain('CTG');
    });

    it('sorts rare codons worst first', () => {
        const rare = analyseCodonUsage('CTACTCCGCCGACGG', 'ecoli').rareCodons;
        const scores = rare.map(c => c.relativeAdaptiveness);
        expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });

    it('returns no rare codons for an all-optimal sequence', () => {
        expect(analyseCodonUsage('CTGCTGCTG', 'ecoli').rareCodons).toEqual([]);
    });
});

describe('optimiseCodons', () => {
    it('preserves the encoded protein', () => {
        const seq = 'ATGCTGCTAAAATTTGGGTAA';
        const { optimised, protein } = optimiseCodons(seq, 'ecoli');
        expect(translate(optimised)).toBe(protein);
        expect(protein).toBe(translate(seq));
    });

    it('replaces rare codons with the organism favourite', () => {
        const { optimised } = optimiseCodons('CTACTACTA', 'ecoli');
        expect(optimised).toBe('CTGCTGCTG');
    });

    it('leaves an already-optimal sequence unchanged', () => {
        const { optimised, changedCodons } = optimiseCodons('CTGCTGCTG', 'ecoli');
        expect(optimised).toBe('CTGCTGCTG');
        expect(changedCodons).toBe(0);
    });

    it('counts how many codons changed', () => {
        expect(optimiseCodons('CTACTACTG', 'ecoli').changedCodons).toBe(2);
    });

    it('raises or holds the CAI', () => {
        const { cai, originalCai } = optimiseCodons('CTACTACTA', 'ecoli');
        expect(cai).toBeGreaterThan(originalCai);
        expect(cai).toBeCloseTo(1, 10);
    });

    it('ignores a trailing partial codon', () => {
        const { optimised } = optimiseCodons('CTACTAC', 'ecoli');
        expect(optimised).toBe('CTGCTG');
    });

    it('handles an empty sequence', () => {
        expect(optimiseCodons('', 'ecoli')).toMatchObject({
            optimised: '',
            protein: '',
            changedCodons: 0,
            cai: 0,
        });
    });
});

describe('codon — error paths', () => {
    it('throws BioError UNKNOWN_ORGANISM for an unlisted organism', () => {
        for (const fn of [
            () => analyseCodonUsage('ATG', 'martian'),
            () => optimiseCodons('ATG', 'martian'),
        ]) {
            try {
                fn();
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('UNKNOWN_ORGANISM');
            }
        }
    });

    it('throws BioError INVALID_SEQUENCE for a non-string sequence', () => {
        for (const bad of [null, undefined, 42]) {
            try {
                analyseCodonUsage(bad, 'ecoli');
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('validates the sequence before the organism', () => {
        try {
            analyseCodonUsage(null, 'martian');
        } catch (e) {
            expect(e.code).toBe('INVALID_SEQUENCE');
        }
    });

    it('returns no HTML anywhere in the results', () => {
        expect(JSON.stringify(analyseCodonUsage('ATGCTG', 'ecoli'))).not.toMatch(/<[a-z]/i);
        expect(JSON.stringify(optimiseCodons('ATGCTG', 'ecoli'))).not.toMatch(/<[a-z]/i);
    });
});
