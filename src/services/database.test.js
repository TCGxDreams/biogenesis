import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchDatabase, fetchDatabaseRecord, IMPORT_LIMIT } from './database.js';
const signal = () => new AbortController().signal;
const json = data => new Response(JSON.stringify(data), {status:200, headers:{'Content-Type':'application/json'}});
const record = {id:'123',accession:'NM_000546.6',title:'p53',organism:'Homo sapiens',length:6,source:'nucleotide',url:'https://www.ncbi.nlm.nih.gov/nuccore/123'};
afterEach(() => vi.unstubAllGlobals());
describe('database search', () => {
    it('combines search IDs and summaries, preserving accession versions and pagination', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(json({esearchresult:{count:'11',idlist:['123']}}))
            .mockResolvedValueOnce(json({result:{123:{accessionversion:'NM_000546.6',title:'p53',organism:'Homo sapiens',slen:6}}}));
        vi.stubGlobal('fetch',fetcher);
        const result = await searchDatabase('nucleotide','BRCA1[Gene] AND Homo sapiens[Organism]',1,signal());
        expect(result).toEqual({total:11,records:[record]});
        const url = new URL(fetcher.mock.calls[0][0]);
        expect(url.searchParams.get('retstart')).toBe('10');
        expect(url.searchParams.get('term')).toBe('BRCA1[Gene] AND Homo sapiens[Organism]');
    });
    it('does not request summaries for zero matches', async () => {
        const fetcher=vi.fn().mockResolvedValue(json({esearchresult:{count:'0',idlist:[]}}));vi.stubGlobal('fetch',fetcher);
        expect(await searchDatabase('protein','missing',0,signal())).toEqual({total:0,records:[]});expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it('maps UniProt protein records', async () => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({results:[{primaryAccession:'P04637',uniProtkbId:'P53_HUMAN',proteinDescription:{recommendedName:{fullName:{value:'Cellular tumor antigen p53'}}},organism:{scientificName:'Homo sapiens'},sequence:{length:393}}]})));
        expect((await searchDatabase('uniprot','P04637',0,signal())).records[0]).toMatchObject({accession:'P04637',length:393,source:'uniprot',title:'Cellular tumor antigen p53'});
    });
    it('reports rate limits', async () => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:429})));
        await expect(searchDatabase('protein','p53',0,signal())).rejects.toThrow('Rate limit');
    });
    it('rejects malformed responses rather than reporting no results', async () => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({})));
        await expect(searchDatabase('protein','p53',0,signal())).rejects.toThrow('Invalid search');
    });
    it('respects cancellation before requesting summaries', async () => {
        const controller = new AbortController();
        const fetcher=vi.fn().mockImplementation(async()=>{controller.abort();return json({esearchresult:{count:'1',idlist:['123']}});});
        vi.stubGlobal('fetch',fetcher);
        await expect(searchDatabase('protein','p53',0,controller.signal)).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
describe('database import validation', () => {
    it('imports a single CRLF FASTA record', async () => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('>NM_000546.6 p53\r\nATG\r\nTAA\r\n')));
        expect(await fetchDatabaseRecord(record,signal())).toContain('ATG\r\nTAA');
    });
    it.each(['>a\nATG\n>b\nTAA','<html>Error</html>','>a\n','>a\n12345'])('rejects invalid FASTA: %s',async fasta => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(fasta)));
        await expect(fetchDatabaseRecord(record,signal())).rejects.toThrow();
    });
    it('refuses known oversized records before downloading',async () => {
        const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
        await expect(fetchDatabaseRecord({...record,length:IMPORT_LIMIT+1},signal())).rejects.toThrow('limit');expect(fetcher).not.toHaveBeenCalled();
    });
    it('checks downloaded length even if the summary underestimates it',async () => {
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('>a\n'+'A'.repeat(IMPORT_LIMIT+1))));
        await expect(fetchDatabaseRecord(record,signal())).rejects.toThrow('limit');
    });
});
