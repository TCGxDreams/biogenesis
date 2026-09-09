import { describe, expect, it } from 'vitest';
import { parseSequenceImport } from './sequenceImport.js';
const genbank = name => `LOCUS       ${name} 6 bp DNA linear\nDEFINITION  Test sequence.\nFEATURES             Location/Qualifiers\n     CDS             1..6\n                     /gene="test"\nORIGIN\n        1 atgtaa\n//\n`;
describe('sequence file import boundary', () => {
    it('returns flat GenBank records usable by the application', () => {
        const rows=parseSequenceImport('export.gb',genbank('ONE')+genbank('TWO'));
        expect(rows).toHaveLength(2);expect(rows.map(r=>r.sequence)).toEqual(['ATGTAA','ATGTAA']);
        expect(rows[0].features[0]).toMatchObject({start:0,end:6,type:'CDS'});
    });
    it('preserves gaps and row order in aligned FASTA', () => {
        const rows=parseSequenceImport('alignment.fasta','>A\nAT-G\n>B\nATCG\n');
        expect(rows.map(r=>[r.name,r.sequence])).toEqual([['A','AT-G'],['B','ATCG']]);
    });
    it.each(['geneious','ab1','pdb','tree','nex','pdf','mol'])('rejects unsupported .%s files',extension=>{
        expect(()=>parseSequenceImport(`data.${extension}`,'ATGC')).toThrow('Unsupported');
    });
    it('accepts plain sequences and BOM FASTA',()=>{
        expect(parseSequenceImport('sequence.seq','ATG\nTAA')[0].sequence).toBe('ATGTAA');
        expect(parseSequenceImport('sequence.faa','\uFEFF>protein\nMKGFPE')[0].sequence).toBe('MKGFPE');
    });
    it.each(['#NEXUS\nBEGIN TREES;', '(A:0.1,B:0.2);', '>empty\n', '\u0000\u0001'])('rejects malformed content: %s',text=>{
        expect(()=>parseSequenceImport('document.txt',text)).toThrow();
    });
});
