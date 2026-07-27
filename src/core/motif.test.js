import { describe, it, expect } from 'vitest';
import { findMotifs, compileMotifPattern } from './motif.js';
import { BioError } from './errors.js';

describe('findMotifs — happy path', () => {
    it('finds an exact match on the forward strand with 0-based coordinates', () => {
        const result = findMotifs('AAAGAATTCAAA', 'GAATTC', { strand: 'forward' });
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]).toEqual({
            position: 3,
            length: 6,
            match: 'GAATTC',
            strand: '+',
            forwardSlice: 'GAATTC',
            contextBefore: 'AAA',
            contextAfter: 'AAA',
        });
    });

    it('reports forwardSlice as the forward-strand residues under the match', () => {
        // The reverse-strand hit reads GGGG, but spans CCCC on the forward strand.
        const [hit] = findMotifs('TTTTCCCC', 'GGGG').matches;
        expect(hit.strand).toBe('-');
        expect(hit.match).toBe('GGGG');
        expect(hit.forwardSlice).toBe('CCCC');
    });

    it('reports counts, pattern and sequence length alongside the matches', () => {
        const result = findMotifs('AAAGAATTCAAA', 'GAATTC', { strand: 'forward' });
        expect(result).toMatchObject({
            pattern: 'GAATTC',
            mode: 'exact',
            strand: 'forward',
            sequenceLength: 12,
            forwardCount: 1,
            reverseCount: 0,
        });
    });

    it('finds every occurrence, sorted by position', () => {
        const result = findMotifs('ATGCCCATGCCCATG', 'ATG', { strand: 'forward' });
        expect(result.matches.map(m => m.position)).toEqual([0, 6, 12]);
        expect(result.forwardCount).toBe(3);
    });

    it('is case insensitive in both sequence and pattern', () => {
        const lower = findMotifs('aaagaattcaaa', 'gaattc', { strand: 'forward' });
        expect(lower.matches.map(m => m.position)).toEqual([3]);
        expect(lower.matches[0].match).toBe('GAATTC');
    });

    it('truncates flanking context at the sequence boundaries', () => {
        const result = findMotifs('ATGCC', 'ATG', { strand: 'forward' });
        expect(result.matches[0].contextBefore).toBe('');
        expect(result.matches[0].contextAfter).toBe('CC');
    });

    it('honours a custom contextFlank', () => {
        const result = findMotifs('AAAAAAATGAAAAAA', 'ATG', {
            strand: 'forward',
            contextFlank: 2,
        });
        expect(result.matches[0].contextBefore).toBe('AA');
        expect(result.matches[0].contextAfter).toBe('AA');
    });

    it('returns contextBefore/contextAfter as plain residues, never markup', () => {
        const result = findMotifs('AAAGAATTCAAA', 'GAATTC', { strand: 'forward' });
        const m = result.matches[0];
        expect(m.contextBefore + m.contextAfter).toMatch(/^[A-Z]*$/);
    });
});

describe('findMotifs — strand handling', () => {
    // GAATTC is palindromic: one site yields one hit per strand at the same position.
    it('searches both strands by default', () => {
        const result = findMotifs('AAAGAATTCAAA', 'GAATTC');
        expect(result.forwardCount).toBe(1);
        expect(result.reverseCount).toBe(1);
        expect(result.matches.map(m => m.strand).sort()).toEqual(['+', '-']);
    });

    it('maps a reverse-strand hit back onto forward-strand coordinates', () => {
        // CCCGGG is not present; its reverse complement of AAATTT is present.
        const result = findMotifs('GGGAAATTTGGG', 'AAATTT', { strand: 'reverse' });
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]).toMatchObject({ position: 3, length: 6, strand: '-' });
        expect(result.forwardCount).toBe(0);
        expect(result.reverseCount).toBe(1);
    });

    it('finds a non-palindromic motif on the reverse strand only', () => {
        // Forward strand reads TTTTCCCC; the motif GGGG only exists as the
        // reverse complement of CCCC at position 4.
        const result = findMotifs('TTTTCCCC', 'GGGG');
        expect(result.forwardCount).toBe(0);
        expect(result.reverseCount).toBe(1);
        expect(result.matches[0].position).toBe(4);
    });

    it('skips the reverse strand for protein sequences', () => {
        const result = findMotifs('MKWVTFISLL', 'MKW', { type: 'protein' });
        expect(result.forwardCount).toBe(1);
        expect(result.reverseCount).toBe(0);
    });

    it('searches the reverse strand for RNA', () => {
        // Inherited behaviour: the complement map sends A -> T (not A -> U), so
        // the reverse strand of an RNA sequence is read in the DNA alphabet.
        const result = findMotifs('GGGAAAUUUGGG', 'AAATTT', { type: 'rna' });
        expect(result.reverseCount).toBe(1);
        expect(result.matches[0]).toMatchObject({ position: 3, strand: '-' });
    });

    // Behaviour change, not a refactor — deliberately out of scope for T2.2,
    // which requires parity with the previous component. Reported in the PR.
    it.todo('should complement RNA into the RNA alphabet (A -> U), so AAAUUU matches');

    it('returns no matches when the motif is absent', () => {
        const result = findMotifs('AAAAAAAAAA', 'GAATTC');
        expect(result.matches).toEqual([]);
        expect(result.forwardCount).toBe(0);
        expect(result.reverseCount).toBe(0);
    });
});

describe('findMotifs — search modes', () => {
    it('treats regex metacharacters literally in exact mode', () => {
        const result = findMotifs('AT.CG', 'AT.CG', { mode: 'exact', strand: 'forward' });
        expect(result.matches).toHaveLength(1);
        // The same pattern as a regex would also match ATGCG, exact mode must not.
        expect(findMotifs('ATGCG', 'AT.CG', { mode: 'exact', strand: 'forward' }).matches).toEqual(
            []
        );
    });

    it('honours regex syntax in regex mode', () => {
        const result = findMotifs('ATGCGATTCG', 'AT[CG]{1,2}G', {
            mode: 'regex',
            strand: 'forward',
        });
        expect(result.matches.map(m => m.match)).toEqual(['ATGCG']);
    });

    it('matches alternation in regex mode', () => {
        const result = findMotifs('TAATAGTGA', 'T(AA|AG|GA)', { mode: 'regex', strand: 'forward' });
        expect(result.matches.map(m => m.match)).toEqual(['TAA', 'TAG', 'TGA']);
    });

    it('expands IUPAC ambiguity codes in iupac mode', () => {
        // GANTC matches GAATC and GACTC.
        const result = findMotifs('GAATCGACTC', 'GANTC', { mode: 'iupac', strand: 'forward' });
        expect(result.matches.map(m => [m.position, m.match])).toEqual([
            [0, 'GAATC'],
            [5, 'GACTC'],
        ]);
    });

    it('expands every documented IUPAC code', () => {
        const cases = [
            ['R', 'AG'],
            ['Y', 'CT'],
            ['S', 'GC'],
            ['W', 'AT'],
            ['K', 'GT'],
            ['M', 'AC'],
            ['B', 'CGT'],
            ['D', 'AGT'],
            ['H', 'ACT'],
            ['V', 'ACG'],
            ['N', 'ACGT'],
        ];
        for (const [code, bases] of cases) {
            for (const base of bases) {
                const r = findMotifs(base, code, { mode: 'iupac', strand: 'forward' });
                expect(r.matches, `${code} should match ${base}`).toHaveLength(1);
            }
        }
    });

    it('escapes non-IUPAC characters in iupac mode', () => {
        const result = findMotifs('AT.CG', 'AT.CG', { mode: 'iupac', strand: 'forward' });
        expect(result.matches).toHaveLength(1);
        expect(findMotifs('ATGCG', 'AT.CG', { mode: 'iupac', strand: 'forward' }).matches).toEqual(
            []
        );
    });
});

describe('findMotifs — boundaries', () => {
    it('matches at the very start and very end of the sequence', () => {
        const result = findMotifs('ATGCCCATG', 'ATG', { strand: 'forward' });
        expect(result.matches.map(m => m.position)).toEqual([0, 6]);
        expect(result.matches[1].position + result.matches[1].length).toBe(9);
    });

    it('handles an empty sequence without throwing', () => {
        const result = findMotifs('', 'ATG');
        expect(result.matches).toEqual([]);
        expect(result.sequenceLength).toBe(0);
    });

    it('handles a motif longer than the sequence', () => {
        expect(findMotifs('AT', 'ATGCATGC').matches).toEqual([]);
    });

    it('does not loop forever on a zero-length regex match', () => {
        const result = findMotifs('ATGC', 'A*', { mode: 'regex', strand: 'forward' });
        expect(result.matches.length).toBeGreaterThan(0);
        expect(result.matches.length).toBeLessThan(5);
    });

    it('finds overlapping-adjacent repeats without double counting', () => {
        const result = findMotifs('AAAA', 'AA', { strand: 'forward' });
        // JS global regex does not rescan inside a match: 0 and 2, not 0,1,2.
        expect(result.matches.map(m => m.position)).toEqual([0, 2]);
    });
});

describe('findMotifs — error paths', () => {
    it('throws BioError INVALID_PATTERN for an uncompilable regex', () => {
        expect(() => findMotifs('ATGC', 'AT[', { mode: 'regex' })).toThrow(BioError);
        try {
            findMotifs('ATGC', 'AT[', { mode: 'regex' });
        } catch (e) {
            expect(e.code).toBe('INVALID_PATTERN');
            expect(e.name).toBe('BioError');
            expect(e.message).toContain('Invalid pattern');
        }
    });

    it('throws BioError EMPTY_PATTERN for an empty or non-string pattern', () => {
        for (const bad of ['', null, undefined, 5]) {
            expect(() => findMotifs('ATGC', bad)).toThrow(BioError);
            try {
                findMotifs('ATGC', bad);
            } catch (e) {
                expect(e.code).toBe('EMPTY_PATTERN');
            }
        }
    });

    it('throws BioError INVALID_MODE for an unknown mode', () => {
        try {
            findMotifs('ATGC', 'ATG', { mode: 'fuzzy' });
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BioError);
            expect(e.code).toBe('INVALID_MODE');
        }
    });

    it('throws BioError INVALID_STRAND for an unknown strand', () => {
        try {
            findMotifs('ATGC', 'ATG', { strand: 'sideways' });
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BioError);
            expect(e.code).toBe('INVALID_STRAND');
        }
    });

    it('never puts HTML in an error message', () => {
        try {
            findMotifs('ATGC', 'AT[', { mode: 'regex' });
        } catch (e) {
            expect(e.message).not.toMatch(/<[a-z]/i);
        }
    });
});

describe('compileMotifPattern', () => {
    it('returns a global RegExp', () => {
        const re = compileMotifPattern('ATG', 'exact');
        expect(re).toBeInstanceOf(RegExp);
        expect(re.global).toBe(true);
    });

    it('uppercases the pattern', () => {
        expect(compileMotifPattern('atg', 'exact').source).toBe('ATG');
    });

    it('escapes metacharacters in exact mode', () => {
        expect(compileMotifPattern('A.G', 'exact').source).toBe('A\\.G');
    });

    it('throws BioError INVALID_PATTERN on a malformed regex', () => {
        expect(() => compileMotifPattern('AT[', 'regex')).toThrow(BioError);
    });
});
