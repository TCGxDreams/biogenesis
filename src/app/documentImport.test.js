import { describe, expect, it } from 'vitest';
import { documentFromReport, exportAnalysisDocument, importDocuments, readTrees, writeTree } from './documentImport.js';
import { buildAlignmentReport } from '../core/alignment-report.js';
const fasta = '>A\nA--G?\n>B\nATCGN\n';
const nexus = `#NEXUS
begin taxa; dimensions ntax=2; taxlabels A B; end;
begin characters; dimensions nchar=5; format datatype=dna missing=? gap=-;
matrix
A A--G?
B ATCGN
; end;
begin trees; utree original=(A:0,B:0.123456789)95; end;`;
describe('typed document imports', () => {
    it('stores aligned rows together, preserving gaps and missing characters', () => {
        const {sequences,documents} = importDocuments('aligned.fasta',fasta);
        expect(sequences).toEqual([]);
        expect(documents).toHaveLength(1);
        expect(documents[0]).toMatchObject({kind:'alignment',schemaVersion:1,rows:[{name:'A',sequence:'A--G?',type:'dna'},{name:'B',sequence:'ATCGN',type:'dna'}]});
        expect(documents[0].source.originalText).toBe(fasta);
        const output = exportAnalysisDocument(documents[0]);
        expect(importDocuments(output.filename,output.text).documents[0].rows).toEqual(documents[0].rows);
    });
    it('requires a choice for a gapless alignment and allows molecule overrides', () => {
        const text='>A\nACGT\n>B\nACGA\n';
        expect(importDocuments('x.fa',text).sequences).toHaveLength(2);
        expect(importDocuments('x.fa',text,'alignment','protein').documents[0].rows[0].type).toBe('protein');
    });
    it('does not accept unequal lengths as an alignment', () => {
        expect(()=>importDocuments('x.fa','>A\nAT-G\n>B\nATG')).toThrow('equal lengths');
        expect(importDocuments('x.fa','>A\nAT-G\n>B\nATG','sequences').sequences).toHaveLength(2);
    });
    it('rejects invalid residues and oversized files', () => {
        expect(()=>importDocuments('x.fa','>A\nAT-!\n>B\nAT-G')).toThrow('invalid residues');
        expect(()=>importDocuments('x.fa','A'.repeat(10000001))).toThrow('10 MB');
    });
    it('imports both NEXUS matrix and tree, with the whole source retained', () => {
        const docs=importDocuments('sample.nex',nexus).documents;
        expect(docs.map(d=>d.kind)).toEqual(['alignment','tree']);
        expect(docs[0].rows[0].sequence).toBe('A--G?');
        expect(docs[1].tree).toEqual({name:'95',children:[{name:'A',length:0},{name:'B',length:0.123456789}]});
        expect(docs.every(d=>d.source.originalText===nexus)).toBe(true);
    });
    it.each([
        nexus.replace('nchar=5','nchar=6'),
        nexus.replace('ntax=2','ntax=3'),
        nexus.replace('datatype=dna','datatype=standard'),
        nexus.replace('gap=-','gap=- interleave'),
        nexus.replace('utree original=', 'translate 1 A, 2 B; tree original='),
        nexus.replace('begin taxa','begin assumptions'),
        nexus.slice(0,-4),
    ])('rejects unsupported or inconsistent NEXUS without partial import', text => {
        expect(()=>importDocuments('x.nex',text)).toThrow();
    });
    it('rejects native Geneious databases and unsupported binaries', () => {
        expect(()=>importDocuments('data.geneious','ATGC')).toThrow('Unsupported');
    });
});
describe('Newick preservation', () => {
    it('reads multiple trees, multiline whitespace, comments, quotes and scientific lengths', () => {
        const text="[&R] (('A,B':0,'O''Brien':1e-4)95:-0.2, C_D);\n(A:1,\nB:2);";
        const trees=readTrees(text);
        expect(trees).toHaveLength(2);
        expect(trees[0].tree.children[0]).toEqual({name:'95',length:-0.2,children:[{name:'A,B',length:0},{name:"O'Brien",length:0.0001}]});
        expect(trees[0].tree.children[1].name).toBe('C D');
        expect(readTrees(writeTree(trees[0].tree)+';')[0].tree).toEqual(trees[0].tree);
        expect(trees[0].newick).toContain('[&R]');
    });
    it.each(['(A,B)', '(A,,B);','(A:NaN,B);','(A:1e999,B);',"('A,B);",'(A,B);junk','[broken','((A,B);'])('rejects malformed trees: %s', text=>{
        expect(()=>readTrees(text)).toThrow();
    });
    it('bounds recursion',()=>expect(()=>readTrees('('.repeat(202)+'A'+')'.repeat(202)+';')).toThrow('200 levels'));
});
describe('saving computed results',()=>{
    it('captures exact alignment rows, inputs and parameters independently of later edits',()=>{
        const inputs=[{name:'one',sequence:'ATGC',type:'dna'},{name:'two',sequence:'ATC',type:'dna'}];
        const report=buildAlignmentReport(inputs,{algorithm:'nw'});
        const doc=documentFromReport(report,inputs);
        expect(doc.rows.map(r=>r.sequence)).toEqual(report.rows.map(r=>r.aligned));
        inputs[0].sequence='AAAA';
        report.rows[0].aligned='CHANGED';
        const snapshot=JSON.parse(doc.source.originalText);
        expect(snapshot.inputs[0].sequence).toBe('ATGC');
        expect(snapshot.report.algorithm).toBe('nw');
        expect(snapshot.maxInputLength).toBe(3000);
        expect(doc.rows[0].sequence).not.toBe('CHANGED');
    });
});
