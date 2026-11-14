import { describe, it, expect } from 'vitest';
import {
    matrixReport,
    relativesReport,
    reportToTsv,
    reportToMarkdown,
    reportFilename,
    METHOD_NOTE,
} from './genome-similarity-report.js';
import { BioError } from './errors.js';

const AT = '2026-11-14T10:20:30.000Z';

function comparison(similarity, verdict, containment = 0.8, mash = 0.01) {
    return { similarity, verdict, containmentA: containment, mashDistance: mash };
}

const MATRIX = {
    names: ['query', 'SE_PL', 'BF'],
    matrix: [
        [null, comparison(99.39, 'same-species'), comparison(null, 'unmeasurable', 0.003, 0.28)],
        [comparison(99.39, 'same-species'), null, comparison(null, 'unmeasurable', 0.004, 0.27)],
        [
            comparison(null, 'unmeasurable', 0.003, 0.28),
            comparison(null, 'unmeasurable', 0.004, 0.27),
            null,
        ],
    ],
    similarity: [
        [100, 99.39, null],
        [99.39, 100, null],
        [null, null, 100],
    ],
};

describe('matrixReport', () => {
    it('flattens the matrix to pairs, closest first', () => {
        const report = matrixReport(MATRIX, { k: 21, generatedAt: AT });
        expect(report.kind).toBe('matrix');
        expect(report.pairs).toHaveLength(3);
        expect(report.pairs[0]).toMatchObject({ a: 'query', b: 'SE_PL', similarity: 99.39 });
        expect(report.pairs.at(-1).similarity).toBeNull();
    });

    it('refuses a comparison with nothing in it', () => {
        expect(() => matrixReport({ names: ['only'] }, { k: 21 })).toThrow(BioError);
        expect(() => matrixReport(null, { k: 21 })).toThrow(/Nothing to report/);
    });
});

describe('relativesReport', () => {
    const ranked = [
        { name: 'MT001829.1 SE_PL', comparison: comparison(99.39, 'same-species') },
        { name: 'KY630187.1 BF', comparison: comparison(null, 'unmeasurable', 0.003, 0.28) },
    ];

    it('records the search that produced it', () => {
        const report = relativesReport({ name: 'query' }, ranked, {
            k: 21,
            total: 186,
            range: { min: 280000, max: 420000 },
            term: 'phage[Title]',
            generatedAt: AT,
        });
        expect(report.notes.join(' ')).toContain('phage[Title]');
        expect(report.notes.join(' ')).toContain('280,000–420,000 bp');
        expect(report.notes.join(' ')).toContain('reads as novelty');
        expect(report.pairs[0].a).toBe('query');
    });

    it('leaves out notes for details it was not given', () => {
        const report = relativesReport({ name: 'q' }, ranked, { k: 21, generatedAt: AT });
        expect(report.notes).toEqual([]);
    });

    it('refuses an empty ranking', () => {
        expect(() => relativesReport({ name: 'q' }, [], { k: 21 })).toThrow(/Nothing to report/);
    });
});

describe('reportToTsv', () => {
    const tsv = reportToTsv(matrixReport(MATRIX, { k: 21, generatedAt: AT }));

    it('puts the method note in the header comments', () => {
        expect(tsv).toContain(`# ${METHOD_NOTE}`);
        expect(tsv).toContain('# k-mer size: 21');
        expect(tsv.split('\n')[0]).toMatch(/^# Genome similarity/);
    });

    it('writes one tab-separated row per pair', () => {
        const dataLines = tsv
            .trim()
            .split('\n')
            .filter(l => !l.startsWith('#'));
        expect(dataLines[0].split('\t')).toEqual([
            'genome_a',
            'genome_b',
            'identity_percent',
            'kmer_containment',
            'mash_distance',
            'verdict',
        ]);
        expect(dataLines).toHaveLength(4); // header + three pairs
        expect(dataLines[1]).toContain('99.39');
    });

    it('writes NA rather than a number it does not have', () => {
        expect(tsv).toContain('\tNA\t');
        expect(tsv).not.toContain('\t0.00\t0.0030');
    });
});

describe('reportToMarkdown', () => {
    const md = reportToMarkdown(
        relativesReport(
            { name: 'query' },
            [{ name: 'SE_PL', comparison: comparison(99.39, 'same-species') }],
            { k: 21, term: 'phage[Title]', generatedAt: AT }
        )
    );

    it('renders a table with a header separator', () => {
        expect(md).toContain('| Genome A | Genome B | Identity % |');
        expect(md).toContain('| --- |');
        expect(md).toContain('| query | SE_PL | 99.39 |');
    });

    it('spells the verdict out rather than printing the slug', () => {
        expect(md).toContain('same species');
        expect(md).not.toContain('same-species');
    });

    it('carries the method note as a blockquote', () => {
        expect(md).toContain(`> ${METHOD_NOTE}`);
    });
});

describe('reportFilename', () => {
    it('builds a name with no characters a filesystem minds', () => {
        const name = reportFilename(matrixReport(MATRIX, { k: 21, generatedAt: AT }), 'tsv');
        expect(name).toBe('genome-similarity-matrix-2026-11-14-10-20-30.tsv');
        expect(name).not.toMatch(/[:/\\?*]/);
    });
});
