import { describe, it, expect } from 'vitest';
import {
    RESTRICTION_ENZYMES,
    RESTRICTION_ENZYMES_UNIQUE,
    findRestrictionSites,
    simulateDigest,
    renderGelSVG,
} from './restriction.js';
import { SAMPLE_SEQUENCES } from '../data/sampleSequences.js';

const pUC19 = SAMPLE_SEQUENCES.find(s => s.name === 'pUC19');
const byName = (...names) => RESTRICTION_ENZYMES_UNIQUE.filter(e => names.includes(e.name));

describe('RESTRICTION_ENZYMES_UNIQUE', () => {
    it('deduplicates the raw table by name+site', () => {
        expect(RESTRICTION_ENZYMES_UNIQUE.length).toBeLessThan(RESTRICTION_ENZYMES.length);
        const keys = RESTRICTION_ENZYMES_UNIQUE.map(e => `${e.name}_${e.site}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('is sorted by enzyme name', () => {
        const names = RESTRICTION_ENZYMES_UNIQUE.map(e => e.name);
        expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    });

    it('keeps exactly one EcoRI entry with the canonical site', () => {
        const eco = byName('EcoRI');
        expect(eco).toHaveLength(1);
        expect(eco[0].site).toBe('GAATTC');
        expect(eco[0].cut).toBe(1);
        expect(eco[0].overhang).toBe('5prime');
    });
});

describe('findRestrictionSites', () => {
    it('finds the single EcoRI site in pUC19 at its known position', () => {
        const hits = findRestrictionSites(pUC19.sequence, byName('EcoRI'));
        expect(hits).toHaveLength(1);
        expect(hits[0].positions).toEqual([395]); // 0-based; 396 in 1-based notation
        expect(hits[0].numCuts).toBe(1);
    });

    it('finds the BamHI and HindIII sites in the pUC19 polylinker', () => {
        const hits = findRestrictionSites(pUC19.sequence, byName('BamHI', 'HindIII'));
        expect(hits.map(h => [h.name, h.positions])).toEqual([
            ['BamHI', [416]],
            ['HindIII', [446]],
        ]);
    });

    it('returns nothing for an enzyme with no site in the sequence', () => {
        expect(findRestrictionSites(pUC19.sequence, byName('NotI'))).toEqual([]);
    });

    it('sorts hits by enzyme name', () => {
        const hits = findRestrictionSites(pUC19.sequence, byName('HindIII', 'BamHI', 'EcoRI'));
        expect(hits.map(h => h.name)).toEqual(['BamHI', 'EcoRI', 'HindIII']);
    });

    it('expands IUPAC ambiguity codes in the recognition site', () => {
        // HinfI = GANTC, so both GAATC and GACTC are cut sites.
        const hits = findRestrictionSites('GAATCGACTC', byName('HinfI'));
        expect(hits).toHaveLength(1);
        expect(hits[0].positions).toEqual([0, 5]);
    });

    it('finds overlapping occurrences of the same site', () => {
        // AluI = AGCT; AGCTAGCT contains sites at 0 and 4, and TAGCTA adds no more.
        const hits = findRestrictionSites('AGCTAGCT', byName('AluI'));
        expect(hits[0].positions).toEqual([0, 4]);
    });

    it('is case insensitive', () => {
        const upper = findRestrictionSites(pUC19.sequence, byName('EcoRI'));
        const lower = findRestrictionSites(pUC19.sequence.toLowerCase(), byName('EcoRI'));
        expect(lower[0].positions).toEqual(upper[0].positions);
    });

    it('returns an empty array for an empty sequence', () => {
        expect(findRestrictionSites('', byName('EcoRI'))).toEqual([]);
    });
});

describe('simulateDigest', () => {
    const enzymes = findRestrictionSites(pUC19.sequence, byName('EcoRI', 'BamHI', 'HindIII'));

    it('produces one more fragment than there are cut sites', () => {
        // 3 cuts in a sequence treated linearly -> 4 fragments.
        expect(simulateDigest(pUC19.sequence, enzymes)).toHaveLength(4);
    });

    it('produces fragment sizes that sum to the sequence length', () => {
        const fragments = simulateDigest(pUC19.sequence, enzymes);
        const total = fragments.reduce((sum, f) => sum + f.size, 0);
        expect(total).toBe(pUC19.sequence.length);
    });

    it('returns fragments sorted largest first', () => {
        const sizes = simulateDigest(pUC19.sequence, enzymes).map(f => f.size);
        expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    });

    it('reports fragment coordinates that tile the sequence without overlap', () => {
        const fragments = simulateDigest(pUC19.sequence, enzymes)
            .slice()
            .sort((a, b) => a.start - b.start);
        expect(fragments[0].start).toBe(0);
        expect(fragments[fragments.length - 1].end).toBe(pUC19.sequence.length);
        for (let i = 1; i < fragments.length; i++) {
            expect(fragments[i].start).toBe(fragments[i - 1].end);
        }
    });

    it('returns fragment sequences matching the parent sequence', () => {
        const [largest] = simulateDigest(pUC19.sequence, enzymes);
        expect(largest.sequence).toBe(pUC19.sequence.substring(largest.start, largest.end));
        expect(largest.sequence).toHaveLength(largest.size);
    });

    it('returns the intact sequence as a single fragment when nothing cuts', () => {
        const fragments = simulateDigest(pUC19.sequence, []);
        expect(fragments).toHaveLength(1);
        expect(fragments[0].size).toBe(pUC19.sequence.length);
    });
});

describe('renderGelSVG', () => {
    // Markup churns; only assert that a well-formed SVG root comes back.
    it('returns a non-empty SVG', () => {
        const enzymes = findRestrictionSites(pUC19.sequence, byName('EcoRI', 'BamHI'));
        const svg = renderGelSVG(simulateDigest(pUC19.sequence, enzymes), pUC19.sequence.length);
        expect(svg.length).toBeGreaterThan(0);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
    });

    it('still returns an SVG for a single uncut fragment', () => {
        const svg = renderGelSVG(simulateDigest(pUC19.sequence, []), pUC19.sequence.length);
        expect(svg.startsWith('<svg')).toBe(true);
    });
});
