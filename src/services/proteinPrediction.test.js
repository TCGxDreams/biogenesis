import {expect,it} from 'vitest';
import {bindingSites,residueSelection} from './proteinPrediction.js';
it('sorts validated model scores without manufacturing probabilities',()=>{
 expect(bindingSites([{chain:'A',resi:2,resn:'ALA',probability:0.4},{chain:'B',resi:2,resn:'GLY',probability:0.9}]).map(s=>s.chain)).toEqual(['B','A']);
 expect(()=>bindingSites([{chain:'A',resi:2,resn:'ALA'}])).toThrow();
 expect(()=>bindingSites([{chain:'A',resi:2,resn:'ALA',probability:NaN}])).toThrow();
});
it('keeps blank chains specific instead of selecting every chain',()=>{
 expect(residueSelection({chain:' ',resi:12})).toEqual({chain:'',resi:12});
 expect(residueSelection({chain:'B',resi:12})).toEqual({chain:'B',resi:12});
});
