import {expect,it} from 'vitest';
import {resolveStructureInput,PROTEIN_PRESETS,proteinNameQuery} from './proteinWorkflow.js';
it('routes PDB and both UniProt accession lengths automatically',()=>{
 expect(resolveStructureInput(' 1ema ')).toEqual({id:'1EMA',source:'pdb'});
 for (const id of ['P04637','Q9Y261','A0A024RBG1']) expect(resolveStructureInput(id).source).toBe('alphafold');
});
it('rejects sequence text, RefSeq accessions and partial ID matches',()=>{
 for(const value of ['','P04637bad','NP_000537.3','ATGCGCGCGC','https://example.org/1EMA']) expect(()=>resolveStructureInput(value)).toThrow();
});
it('keeps presets within the exposed threshold and top-N settings',()=>{
 for(const preset of Object.values(PROTEIN_PRESETS)) {
 expect(preset.threshold).toBeGreaterThanOrEqual(0.2);
 expect(preset.threshold).toBeLessThanOrEqual(0.95);
 expect([10,25,50,100,0]).toContain(preset.topN);
 }
});

it('normalises a document title and the isulin typo without selecting a species',()=>{
 expect(proteinNameQuery(' Insulin_Human ')).toBe('Insulin Human');
 expect(proteinNameQuery('isulin')).toBe('insulin');
 expect(proteinNameQuery('lysozyme')).toBe('lysozyme');
});
