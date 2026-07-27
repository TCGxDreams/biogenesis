import { describe, it, expect } from 'vitest';
import {
    CODON_TABLE,
    complement,
    reverseComplement,
    transcribe,
    reverseTranscribe,
    translate,
    gcContent,
    nucleotideComposition,
    molecularWeight,
    meltingTemp,
    calculateTmNN,
    findORFs,
    detectSequenceType,
    getNucleotideClass,
    getAminoAcidClass,
    parseFasta,
    parseGenBank,
    toFasta,
} from './bioUtils.js';

describe('complement / reverseComplement', () => {
    it('complements each DNA base', () => {
        expect(complement('ATGC')).toBe('TACG');
    });

    it('preserves case', () => {
        expect(complement('atgc')).toBe('tacg');
    });

    it('passes unknown characters through unchanged', () => {
        expect(complement('ATGCN-')).toBe('TACGN-');
    });

    it('complements U as A (RNA input)', () => {
        expect(complement('AUGC')).toBe('TACG');
    });

    it('reverses after complementing', () => {
        expect(reverseComplement('ATGC')).toBe('GCAT');
        expect(reverseComplement('AAAACCC')).toBe('GGGTTTT');
    });

    it('is its own inverse', () => {
        const seq = 'ATGCATTACGGCTA';
        expect(reverseComplement(reverseComplement(seq))).toBe(seq);
    });

    it('returns empty string for empty input', () => {
        expect(complement('')).toBe('');
        expect(reverseComplement('')).toBe('');
    });
});

describe('transcribe / reverseTranscribe', () => {
    it('replaces T with U preserving case', () => {
        expect(transcribe('ATGCtgc')).toBe('AUGCugc');
    });

    it('replaces U with T preserving case', () => {
        expect(reverseTranscribe('AUGCugc')).toBe('ATGCtgc');
    });

    it('round-trips', () => {
        expect(reverseTranscribe(transcribe('ATGCATGC'))).toBe('ATGCATGC');
    });
});

describe('translate', () => {
    it('translates frame 0 including the stop codon', () => {
        expect(translate('ATGGCCTGA')).toBe('MA*');
    });

    it('translates frame 1', () => {
        expect(translate('AATGGCCTGA', 1)).toBe('MA*');
    });

    it('translates frame 2', () => {
        expect(translate('AAATGGCCTGA', 2)).toBe('MA*');
    });

    it('drops a trailing partial codon when length is not a multiple of 3', () => {
        expect(translate('ATGGCCTG')).toBe('MA');
        expect(translate('ATGGCCT')).toBe('MA');
    });

    it('emits X for codons outside the standard table', () => {
        expect(translate('ATGNNN')).toBe('MX');
    });

    it('accepts lowercase input', () => {
        expect(translate('atggcctga')).toBe('MA*');
    });

    it('returns an empty string for input shorter than one codon', () => {
        expect(translate('AT')).toBe('');
        expect(translate('')).toBe('');
    });

    it('has all 64 codons in the standard genetic code table', () => {
        expect(Object.keys(CODON_TABLE)).toHaveLength(64);
        expect(CODON_TABLE.ATG).toBe('M');
        expect(CODON_TABLE.TAA).toBe('*');
        expect(CODON_TABLE.TAG).toBe('*');
        expect(CODON_TABLE.TGA).toBe('*');
    });
});

describe('gcContent', () => {
    it('returns 100 for an all-GC sequence', () => {
        expect(gcContent('GGCC')).toBe(100);
    });

    it('returns 50 for a balanced sequence', () => {
        expect(gcContent('ATGC')).toBe(50);
    });

    it('returns 0 for an empty sequence rather than NaN', () => {
        expect(gcContent('')).toBe(0);
    });

    it('excludes non-ATCGU characters from the denominator', () => {
        // N is not counted at all, so GGCCNN is still 100% GC.
        expect(gcContent('GGCCNN')).toBe(100);
    });

    it('is case insensitive', () => {
        expect(gcContent('ggcc')).toBe(100);
    });
});

describe('nucleotideComposition', () => {
    it('counts each base and buckets the rest into `other`', () => {
        expect(nucleotideComposition('AATTCCGGUX')).toEqual({
            A: 2,
            T: 2,
            C: 2,
            G: 2,
            U: 1,
            other: 1,
        });
    });

    it('returns all zeroes for an empty sequence', () => {
        expect(nucleotideComposition('')).toEqual({ A: 0, T: 0, C: 0, G: 0, U: 0, other: 0 });
    });
});

describe('molecularWeight', () => {
    it('sums nucleotide weights for DNA', () => {
        // 331.2 + 307.2 + 347.2 + 322.2
        expect(molecularWeight('ACGT')).toBeCloseTo(1307.8, 4);
    });

    it('defaults to DNA when no type is given', () => {
        expect(molecularWeight('A')).toBeCloseTo(331.2, 4);
    });

    it('adds one water for a protein and subtracts water per peptide bond', () => {
        expect(molecularWeight('A', 'protein')).toBeCloseTo(89.09, 4);
        // 18.02 + (89.09 - 18.02) + (75.03 - 18.02)
        expect(molecularWeight('AG', 'protein')).toBeCloseTo(146.1, 4);
    });

    it('returns 0 for an empty DNA sequence and water for an empty protein', () => {
        expect(molecularWeight('')).toBe(0);
        expect(molecularWeight('', 'protein')).toBeCloseTo(18.02, 4);
    });
});

describe('meltingTemp', () => {
    it('uses the Wallace rule below 14 nt', () => {
        // 2*(A+T) + 4*(G+C) = 2*2 + 4*2
        expect(meltingTemp('ATGC')).toBe(12);
    });

    it('switches to the salt-adjusted formula at 14 nt and above', () => {
        // 64.9 + 41 * (8 - 16.4) / 16
        expect(meltingTemp('ATGCATGCATGCATGC')).toBeCloseTo(43.375, 6);
    });

    it('returns 0 for an empty sequence', () => {
        expect(meltingTemp('')).toBe(0);
    });

    it('crosses formulas exactly at length 14', () => {
        const thirteen = 'ATGCATGCATGCA'; // Wallace
        const fourteen = 'ATGCATGCATGCAT'; // salt-adjusted
        expect(thirteen).toHaveLength(13);
        expect(fourteen).toHaveLength(14);
        expect(meltingTemp(thirteen)).toBe(2 * 7 + 4 * 6);
        expect(meltingTemp(fourteen)).toBeCloseTo(64.9 + (41 * (6 - 16.4)) / 14, 6);
    });
});

describe('calculateTmNN', () => {
    it('falls back to the Wallace rule below 8 nt', () => {
        expect(calculateTmNN('ATGCAT')).toBe(meltingTemp('ATGCAT'));
    });

    it('returns a plausible Tm for a 16-mer', () => {
        const tm = calculateTmNN('ATGCATGCATGCATGC');
        expect(tm).toBeGreaterThan(35);
        expect(tm).toBeLessThan(70);
        expect(tm).toBeCloseTo(48.035, 2);
    });

    it('gives a GC-rich primer a higher Tm than an AT-rich one of equal length', () => {
        expect(calculateTmNN('GCGCGCGCGCGCGCGC')).toBeGreaterThan(
            calculateTmNN('ATATATATATATATAT')
        );
    });

    it('never returns a negative temperature', () => {
        expect(calculateTmNN('ATATATATAT')).toBeGreaterThanOrEqual(0);
    });
});

describe('findORFs', () => {
    it('finds an ORF from ATG to a stop codon, 0-based half-open', () => {
        const orfs = findORFs('ATGAAATTTGGGCCCTAA', 9);
        expect(orfs).toHaveLength(1);
        expect(orfs[0]).toEqual({
            frame: 1,
            start: 0,
            end: 18,
            length: 18,
            protein: 'MKFGP*',
        });
    });

    it('filters out ORFs shorter than minLength', () => {
        expect(findORFs('ATGAAATAA', 30)).toEqual([]);
    });

    it('ignores an ORF with no stop codon', () => {
        expect(findORFs('ATGAAATTTGGGCCCAAA', 9)).toEqual([]);
    });

    it('sorts results longest first', () => {
        const seq = 'ATGAAATAA' + 'ATGAAATTTGGGCCCAAATAA';
        const orfs = findORFs(seq, 6);
        expect(orfs.length).toBeGreaterThan(1);
        for (let i = 1; i < orfs.length; i++) {
            expect(orfs[i - 1].length).toBeGreaterThanOrEqual(orfs[i].length);
        }
    });

    it('returns an empty array for an empty sequence', () => {
        expect(findORFs('')).toEqual([]);
    });
});

describe('detectSequenceType', () => {
    it('detects DNA', () => {
        expect(detectSequenceType('ATGCATGCATGC')).toBe('dna');
    });

    it('detects RNA by the presence of U and absence of T', () => {
        expect(detectSequenceType('AUGCAUGCAUGC')).toBe('rna');
    });

    it('detects protein from residues that cannot be nucleotides', () => {
        expect(detectSequenceType('MKWVTFISLLLLFSSAYSRGVFRR')).toBe('protein');
    });

    it('returns unknown for an empty sequence', () => {
        expect(detectSequenceType('')).toBe('unknown');
    });

    it('ignores whitespace, digits and stop characters', () => {
        expect(detectSequenceType('  1 ATGC\nATGC ATGC*')).toBe('dna');
    });

    it('treats an ambiguous short run of protein-exclusive letters as protein', () => {
        // 'DEFHIK' are all protein-exclusive; > 5% of the sequence.
        expect(detectSequenceType('ATGCDEFHIK')).toBe('protein');
    });
});

describe('getNucleotideClass / getAminoAcidClass', () => {
    it('maps each nucleotide to its CSS class', () => {
        expect(getNucleotideClass('a')).toBe('nt-a');
        expect(getNucleotideClass('T')).toBe('nt-t');
        expect(getNucleotideClass('C')).toBe('nt-c');
        expect(getNucleotideClass('G')).toBe('nt-g');
        expect(getNucleotideClass('U')).toBe('nt-u');
        expect(getNucleotideClass('-')).toBe('nt-gap');
        expect(getNucleotideClass('N')).toBe('');
    });

    it('groups amino acids by chemistry', () => {
        expect(getAminoAcidClass('A')).toBe('aa-hydrophobic');
        expect(getAminoAcidClass('S')).toBe('aa-polar');
        expect(getAminoAcidClass('K')).toBe('aa-positive');
        expect(getAminoAcidClass('D')).toBe('aa-negative');
        expect(getAminoAcidClass('G')).toBe('aa-special');
        expect(getAminoAcidClass('*')).toBe('');
    });
});

describe('parseFasta', () => {
    it('parses a single record, joining wrapped lines', () => {
        expect(parseFasta('>seq1 my description\nATGC\nATGC\n')).toEqual([
            {
                name: 'seq1',
                description: 'my description',
                sequence: 'ATGCATGC',
                type: 'dna',
            },
        ]);
    });

    it('parses multiple records and skips blank lines', () => {
        const records = parseFasta('>a\nATGC\n\n>b desc here\nGGGG\nCCCC');
        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({ name: 'a', description: '', sequence: 'ATGC' });
        expect(records[1]).toMatchObject({
            name: 'b',
            description: 'desc here',
            sequence: 'GGGGCCCC',
        });
    });

    it('handles CRLF line endings', () => {
        const records = parseFasta('>a d\r\nATGC\r\nTTTT\r\n');
        expect(records).toHaveLength(1);
        expect(records[0].sequence).toBe('ATGCTTTT');
        expect(records[0].description).toBe('d');
    });

    it('returns an empty array for empty input', () => {
        expect(parseFasta('')).toEqual([]);
    });

    it('returns an empty array for a headerless body (not valid FASTA)', () => {
        expect(parseFasta('ATGCATGC')).toEqual([]);
    });

    it('names an unnamed record "Unnamed"', () => {
        expect(parseFasta('> \nATGC')[0].name).toBe('Unnamed');
    });
});

describe('parseGenBank', () => {
    const record = [
        'LOCUS       TESTSEQ    12 bp    DNA     linear   SYN 01-JAN-2020',
        'DEFINITION  A test record.',
        'FEATURES             Location/Qualifiers',
        '     gene            1..6',
        '                     /gene="testGene"',
        '     CDS             complement(7..12)',
        '                     /product="testProduct"',
        'ORIGIN',
        '        1 atgcatgcat gc',
        '//',
    ].join('\n');

    it('extracts locus, definition and uppercased sequence', () => {
        const [entry] = parseGenBank(record);
        expect(entry.name).toBe('TESTSEQ');
        expect(entry.description).toBe('A test record.');
        expect(entry.sequence).toBe('ATGCATGCATGC');
        expect(entry.type).toBe('dna');
        expect(entry.format).toBe('genbank');
    });

    it('converts 1-based GenBank locations to 0-based half-open coordinates', () => {
        const [entry] = parseGenBank(record);
        expect(entry.features).toHaveLength(2);
        expect(entry.features[0]).toEqual({
            type: 'gene',
            start: 0,
            end: 6,
            complement: false,
            qualifiers: { gene: 'testGene' },
        });
        expect(entry.features[1]).toEqual({
            type: 'CDS',
            start: 6,
            end: 12,
            complement: true,
            qualifiers: { product: 'testProduct' },
        });
    });

    it('returns an empty array when there is no ORIGIN block', () => {
        expect(parseGenBank('LOCUS  EMPTY\nDEFINITION nothing\n//')).toEqual([]);
    });

    it('returns an empty array for empty input', () => {
        expect(parseGenBank('')).toEqual([]);
    });
});

describe('toFasta', () => {
    it('wraps the sequence at lineWidth', () => {
        expect(toFasta('x', 'AAAAATTTTT', 5)).toBe('>x\nAAAAA\nTTTTT\n');
    });

    it('does not emit a trailing blank line when the length is an exact multiple', () => {
        expect(toFasta('x', 'AAAAA', 5)).toBe('>x\nAAAAA\n');
    });

    it('emits a short final line when the length is not a multiple', () => {
        expect(toFasta('x', 'AAAAAT', 5)).toBe('>x\nAAAAA\nT\n');
    });

    it('defaults to 70 characters per line', () => {
        const seq = 'A'.repeat(150);
        const lines = toFasta('x', seq).trimEnd().split('\n');
        expect(lines).toHaveLength(4); // header + 70 + 70 + 10
        expect(lines[1]).toHaveLength(70);
        expect(lines[3]).toHaveLength(10);
    });

    it('emits only the header for an empty sequence', () => {
        expect(toFasta('x', '')).toBe('>x\n');
    });

    it('round-trips through parseFasta', () => {
        const seq = 'ATGCATGCATGCATGCATGCATGC';
        const [parsed] = parseFasta(toFasta('roundtrip', seq, 7));
        expect(parsed.name).toBe('roundtrip');
        expect(parsed.sequence).toBe(seq);
    });
});
