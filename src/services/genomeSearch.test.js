import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    lengthWindow,
    buildGenomeQuery,
    parseMultiFasta,
    searchGenomes,
    fetchGenomes,
    GENOME_LIMIT,
    MAX_RELATIVES,
} from './genomeSearch.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

/** Reply to each call in order, matching on a fragment of the URL. */
function mockFetch(handlers) {
    const calls = [];
    globalThis.fetch = vi.fn(async (url) => {
        calls.push(String(url));
        const handler = handlers.find(([fragment]) => String(url).includes(fragment));
        if (!handler) throw new Error(`Unexpected request: ${url}`);
        const [, body, status = 200] = handler;
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
            text: async () => body,
        };
    });
    return calls;
}

describe('lengthWindow', () => {
    it('brackets a genome by a fraction of its length', () => {
        expect(lengthWindow(350000, 0.2)).toEqual({ min: 280000, max: 420000 });
    });

    it('collapses to the exact length at zero tolerance', () => {
        expect(lengthWindow(1000, 0)).toEqual({ min: 1000, max: 1000 });
    });

    it('never drops below one base', () => {
        expect(lengthWindow(10, 5).min).toBe(1);
    });
});

describe('buildGenomeQuery', () => {
    it('combines the term with the length filter and adds nothing else', () => {
        expect(buildGenomeQuery('phage[Title]', { min: 100, max: 200 })).toBe(
            '(phage[Title]) AND 100:200[SLEN]'
        );
    });

    it('does not force a molecule-type filter that would drop plasmids', () => {
        expect(buildGenomeQuery('pUC19[Title]', { min: 2149, max: 3223 })).not.toContain(
            'biomol_genomic'
        );
    });

    it('refuses an empty term', () => {
        expect(() => buildGenomeQuery('   ', { min: 1, max: 2 })).toThrow(/search term/);
    });
});

describe('parseMultiFasta', () => {
    it('splits records and takes the accession from each header', () => {
        const records = parseMultiFasta(
            '>MT001829.1 Salmonella phage SE_PL\nACGT\nACGT\n>KY630187.1 Serratia phage BF\nTTTT\n'
        );
        expect(records).toHaveLength(2);
        expect(records[0].accession).toBe('MT001829.1');
        expect(records[0].sequence).toBe('ACGTACGT');
        expect(records[1].name).toContain('Serratia');
    });

    it('drops headers with no sequence under them', () => {
        expect(parseMultiFasta('>empty record\n>other\nACGT\n')).toHaveLength(1);
    });

    it('returns nothing for junk', () => {
        expect(parseMultiFasta('')).toEqual([]);
        expect(parseMultiFasta('no header here')).toEqual([]);
    });
});

describe('searchGenomes', () => {
    const window = { min: 280000, max: 420000 };

    it('returns summaries for the ids the search found', async () => {
        const calls = mockFetch([
            ['esearch', { esearchresult: { count: '2', idlist: ['1', '2'] } }],
            [
                'esummary',
                {
                    result: {
                        1: {
                            accessionversion: 'MT001829.1',
                            title: 'Salmonella phage SE_PL',
                            organism: 'Salmonella phage SE_PL',
                            slen: 348657,
                        },
                        2: {
                            accessionversion: 'KY630187.1',
                            title: 'Serratia phage BF',
                            organism: 'Serratia phage BF',
                            slen: 357154,
                        },
                    },
                },
            ],
        ]);

        const result = await searchGenomes('phage[Title]', { window, limit: 10 });
        expect(result.total).toBe(2);
        expect(result.records.map((r) => r.accession)).toEqual(['MT001829.1', 'KY630187.1']);
        expect(calls[0]).toContain('280000%3A420000%5BSLEN%5D');
    });

    it('caps the request at MAX_RELATIVES', async () => {
        const calls = mockFetch([
            ['esearch', { esearchresult: { count: '0', idlist: [] } }],
        ]);
        await searchGenomes('phage[Title]', { window, limit: 5000 });
        expect(calls[0]).toContain(`retmax=${MAX_RELATIVES}`);
    });

    it('leaves out records longer than the genome limit', async () => {
        mockFetch([
            ['esearch', { esearchresult: { count: '1', idlist: ['1'] } }],
            ['esummary', { result: { 1: { accessionversion: 'X', slen: GENOME_LIMIT + 1 } } }],
        ]);
        const result = await searchGenomes('phage[Title]', { window });
        expect(result.records).toEqual([]);
    });

    it('skips the summary call when nothing matched', async () => {
        const calls = mockFetch([['esearch', { esearchresult: { count: '0', idlist: [] } }]]);
        const result = await searchGenomes('nothing[Title]', { window });
        expect(result.records).toEqual([]);
        expect(calls).toHaveLength(1);
    });

    it('surfaces a rate limit as its own message', async () => {
        mockFetch([['esearch', '', 429]]);
        await expect(searchGenomes('phage[Title]', { window })).rejects.toThrow(/rate limit/i);
    });

    it('rejects a query NCBI could not parse', async () => {
        mockFetch([['esearch', { esearchresult: { ERROR: 'bad query' } } ]]);
        await expect(searchGenomes('((', { window })).rejects.toThrow(/could not interpret/);
    });

    it('needs a length window', async () => {
        await expect(searchGenomes('phage[Title]', {})).rejects.toThrow(/length window/);
    });
});

describe('fetchGenomes', () => {
    it('parses the sequences and reports progress', async () => {
        mockFetch([
            ['efetch', '>MT001829.1 SE_PL\nACGTACGT\n>KY630187.1 BF\nTTTTAAAA\n'],
        ]);
        const seen = [];
        const genomes = await fetchGenomes(
            [
                { id: '1', accession: 'MT001829.1', length: 8 },
                { id: '2', accession: 'KY630187.1', length: 8 },
            ],
            { onProgress: (done, total) => seen.push([done, total]) }
        );
        expect(genomes.map((g) => g.accession)).toEqual(['MT001829.1', 'KY630187.1']);
        expect(seen).toEqual([[2, 2]]);
    });

    it('refuses an empty list', async () => {
        await expect(fetchGenomes([])).rejects.toThrow(/No records/);
    });

    it('reports when NCBI sends nothing usable', async () => {
        mockFetch([['efetch', 'no fasta here']]);
        await expect(fetchGenomes([{ id: '1', accession: 'X', length: 10 }])).rejects.toThrow(
            /no usable sequences/
        );
    });
});
