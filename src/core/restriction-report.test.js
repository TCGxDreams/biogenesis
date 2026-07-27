import { describe, it, expect } from 'vitest';
import { surveySites, analyseDigest, ENZYME_GROUPS } from './restriction-report.js';
import { BioError } from './errors.js';
import { RESTRICTION_ENZYMES_UNIQUE } from '../utils/restriction.js';
import { SAMPLE_SEQUENCES } from '../data/sampleSequences.js';

const pUC19 = SAMPLE_SEQUENCES.find(s => s.name === 'pUC19').sequence;
const panel = (...names) => RESTRICTION_ENZYMES_UNIQUE.filter(e => names.includes(e.name));

describe('surveySites', () => {
    it('finds the known pUC19 polylinker sites', () => {
        const { sites } = surveySites(pUC19, { enzymes: panel('EcoRI', 'BamHI', 'HindIII') });
        expect(sites.map(s => [s.name, s.positions])).toEqual([
            ['BamHI', [416]],
            ['EcoRI', [395]],
            ['HindIII', [446]],
        ]);
    });

    it('summarises cutters, unique cutters and total cuts', () => {
        const { summary } = surveySites(pUC19, {
            enzymes: panel('EcoRI', 'BamHI', 'HindIII', 'NotI', 'AluI'),
        });
        expect(summary.panelSize).toBe(5);
        expect(summary.cutterCount).toBe(4); // NotI does not cut pUC19
        expect(summary.nonCutterCount).toBe(1);
        expect(summary.uniqueCutterCount).toBe(3); // AluI cuts many times
        expect(summary.totalCuts).toBeGreaterThan(3);
    });

    it('counts cutters per enzyme group', () => {
        const { summary } = surveySites(pUC19, { enzymes: panel('EcoRI', 'AluI') });
        expect(summary.groups.common).toBe(1); // EcoRI
        expect(summary.groups['4cutter']).toBe(1); // AluI
        expect(Object.keys(summary.groups).sort()).toEqual([...ENZYME_GROUPS].sort());
    });

    it('totals cuts as the sum of every occurrence', () => {
        const survey = surveySites(pUC19, { enzymes: panel('AluI') });
        expect(survey.summary.totalCuts).toBe(survey.sites[0].positions.length);
    });

    it('builds a cut map sorted by position, one entry per occurrence', () => {
        const survey = surveySites(pUC19, { enzymes: panel('EcoRI', 'BamHI', 'HindIII') });
        expect(survey.cutMap).toEqual([
            { position: 395, enzyme: 'EcoRI', overhang: '5prime' },
            { position: 416, enzyme: 'BamHI', overhang: '5prime' },
            { position: 446, enzyme: 'HindIII', overhang: '5prime' },
        ]);
    });

    it('keeps the cut map ascending across many enzymes', () => {
        const { cutMap, summary } = surveySites(pUC19);
        expect(cutMap).toHaveLength(summary.totalCuts);
        for (let i = 1; i < cutMap.length; i++) {
            expect(cutMap[i].position).toBeGreaterThanOrEqual(cutMap[i - 1].position);
        }
    });

    it('defaults to the full enzyme panel', () => {
        expect(surveySites(pUC19).summary.panelSize).toBe(RESTRICTION_ENZYMES_UNIQUE.length);
    });

    it('reports every enzyme as a non-cutter when nothing cuts', () => {
        const survey = surveySites('AAAAAAAAAAAAAAAAAAAA', { enzymes: panel('EcoRI', 'NotI') });
        expect(survey.sites).toEqual([]);
        expect(survey.cutMap).toEqual([]);
        expect(survey.summary).toMatchObject({
            cutterCount: 0,
            totalCuts: 0,
            uniqueCutterCount: 0,
            nonCutterCount: 2,
        });
    });

    it('reports the sequence length', () => {
        expect(surveySites(pUC19).sequenceLength).toBe(2622);
    });
});

describe('analyseDigest', () => {
    it('returns n+1 fragments for n cuts', () => {
        const report = analyseDigest(pUC19, ['EcoRI', 'BamHI', 'HindIII']);
        expect(report.enzymeSummary.totalCuts).toBe(3);
        expect(report.fragments).toHaveLength(4);
        expect(report.enzymeSummary.fragmentCount).toBe(4);
    });

    it('produces fragments whose sizes sum to the sequence length', () => {
        const { fragments } = analyseDigest(pUC19, ['EcoRI', 'BamHI', 'HindIII']);
        expect(fragments.reduce((s, f) => s + f.size, 0)).toBe(pUC19.length);
    });

    it('returns the intact sequence for an empty enzyme list', () => {
        const report = analyseDigest(pUC19, []);
        expect(report.fragments).toHaveLength(1);
        expect(report.fragments[0].size).toBe(pUC19.length);
        expect(report.enzymeSummary).toMatchObject({
            requested: [],
            matched: [],
            unmatched: [],
            totalCuts: 0,
        });
    });

    it('separates matched from unmatched enzyme names', () => {
        const report = analyseDigest(pUC19, ['EcoRI', 'NotI', 'NoSuchEnzyme']);
        expect(report.enzymeSummary.matched).toEqual(['EcoRI']);
        expect(report.enzymeSummary.unmatched.sort()).toEqual(['NoSuchEnzyme', 'NotI']);
    });

    it('ignores enzyme names that are not in the panel', () => {
        const a = analyseDigest(pUC19, ['EcoRI']);
        const b = analyseDigest(pUC19, ['EcoRI', 'NoSuchEnzyme']);
        expect(b.fragments).toEqual(a.fragments);
    });

    it('returns fragments largest first with sequences matching the parent', () => {
        const { fragments } = analyseDigest(pUC19, ['EcoRI', 'BamHI']);
        const sizes = fragments.map(f => f.size);
        expect(sizes).toEqual([...sizes].sort((x, y) => y - x));
        for (const f of fragments) {
            expect(f.sequence).toBe(pUC19.substring(f.start, f.end));
            expect(f.sequence).toHaveLength(f.size);
        }
    });

    it('returns only the sites of the selected enzymes', () => {
        const report = analyseDigest(pUC19, ['EcoRI']);
        expect(report.sites).toHaveLength(1);
        expect(report.sites[0].name).toBe('EcoRI');
    });

    it('handles a frequent cutter', () => {
        const report = analyseDigest(pUC19, ['AluI']);
        expect(report.enzymeSummary.totalCuts).toBeGreaterThan(5);
        expect(report.fragments.length).toBe(report.enzymeSummary.totalCuts + 1);
    });
});

describe('restriction reports — error paths', () => {
    it('throws BioError EMPTY_SEQUENCE for an empty sequence', () => {
        for (const fn of [() => surveySites(''), () => analyseDigest('', ['EcoRI'])]) {
            try {
                fn();
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('EMPTY_SEQUENCE');
            }
        }
    });

    it('throws BioError INVALID_SEQUENCE for a non-string sequence', () => {
        for (const bad of [null, undefined, 42, {}]) {
            try {
                surveySites(bad);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e.code).toBe('INVALID_SEQUENCE');
            }
        }
    });

    it('throws BioError INVALID_ENZYME_LIST when names are not an array', () => {
        for (const bad of [null, 'EcoRI', 42]) {
            try {
                analyseDigest(pUC19, bad);
                expect.unreachable('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(BioError);
                expect(e.code).toBe('INVALID_ENZYME_LIST');
            }
        }
    });

    it('validates the sequence before the enzyme list', () => {
        try {
            analyseDigest('', null);
        } catch (e) {
            expect(e.code).toBe('EMPTY_SEQUENCE');
        }
    });

    it('returns no HTML anywhere in the results', () => {
        expect(JSON.stringify(surveySites(pUC19))).not.toMatch(/<[a-z]/i);
        expect(JSON.stringify(analyseDigest(pUC19, ['EcoRI']))).not.toMatch(/<[a-z]/i);
    });
});
