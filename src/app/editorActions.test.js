import {expect,it} from 'vitest';
import {editedSequenceCopy} from './editorActions.js';
it('preserves original and drops stale mappings in an edited copy',()=>{
 const source={name:'gene',type:'dna',sequence:'ATGC',features:[{start:0,end:4}],pdbId:'1ABC',accession:'X'};
 const edited=editedSequenceCopy(source,' atg caa ');
 expect(edited.sequence).toBe('ATGCAA');
 expect(edited.features).toEqual([]);
 expect(edited.pdbId).toBeUndefined();
 expect(edited.accession).toBeUndefined();
 expect(source.sequence).toBe('ATGC');
 expect(source.features).toHaveLength(1);
});
it('rejects empty, invalid, unchanged and oversized edits',()=>{
 const source={name:'gene',type:'dna',sequence:'ATGC'};
 for(const text of ['','ATGU','atgc','A'.repeat(100001)]) expect(()=>editedSequenceCopy(source,text)).toThrow();
});
it('checks RNA and protein alphabets',()=>{
 expect(editedSequenceCopy({name:'rna',type:'rna',sequence:'AUG'},'AUU').sequence).toBe('AUU');
 expect(()=>editedSequenceCopy({name:'rna',type:'rna',sequence:'AUG'},'ATT')).toThrow();
 expect(editedSequenceCopy({name:'p',type:'protein',sequence:'MK'},'MKG*').sequence).toBe('MKG*');
});
