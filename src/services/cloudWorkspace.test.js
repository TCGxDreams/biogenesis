import {expect,it} from 'vitest';
import {cloudPayload,validateCloudPayload,CLOUD_WORKSPACE_LIMIT} from './cloudWorkspace.js';
it('does not upload navigation state or auth data',()=>{
 const state={sequences:[{name:'a',type:'dna',sequence:'ATGC'}],analysisDocuments:[],tabs:[{}],activeTool:'viewer',token:'secret'};
 const first=cloudPayload(state);
 expect(first.payload).toEqual({schemaVersion:1,sequences:state.sequences,analysisDocuments:[]});
 expect(cloudPayload({...state,activeTool:'stats'}).json).toBe(first.json);
 expect(first.json).not.toContain('secret');
});
it('validates cloud version and document structure',()=>{
 expect(validateCloudPayload(cloudPayload({sequences:[]}).payload).sequences).toEqual([]);
 for(const value of [null,{}, {schemaVersion:5,sequences:[],analysisDocuments:[]},{schemaVersion:1,sequences:[{name:'x',type:'dna'}],analysisDocuments:[]}]) expect(()=>validateCloudPayload(value)).toThrow();
});
it('limits byte payload before upload',()=>{
 expect(()=>cloudPayload({sequences:[{sequence:'A'.repeat(CLOUD_WORKSPACE_LIMIT)}]})).toThrow('4 MiB');
});
