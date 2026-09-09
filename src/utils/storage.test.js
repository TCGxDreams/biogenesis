import { afterEach, expect, it, vi } from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('persists analysis payload and selected document, and only resolves after commit', async()=>{
    let stored, transaction;
    vi.stubGlobal('indexedDB',{open:()=>{
        const request={};
        queueMicrotask(()=>{request.result={transaction:()=>{
            transaction={objectStore:()=>({put:value=>{stored=structuredClone(value);}})};
            return transaction;
        }};request.onsuccess();});
        return request;
    }});
    const {saveWorkspace}=await import('./storage.js');
    const state={sequences:[],analysisDocuments:[{id:'aln',kind:'alignment',rows:[{name:'A',sequence:'A-G'}]}],activeAnalysisId:'aln',tabs:[{id:1,seqIdx:-1,documentId:'aln'}],activeTabId:1,activeSequenceIdx:-1,tabCounter:1};
    let done=false;
    const saving=saveWorkspace(state).then(()=>{done=true;});
    await vi.waitFor(()=>expect(stored).toBeDefined());
    expect(done).toBe(false);
    expect(stored).toMatchObject(state);
    transaction.oncomplete();
    await saving;
    expect(done).toBe(true);
});
it('reports a failed save transaction', async()=>{
    let transaction;
    vi.stubGlobal('indexedDB',{open:()=>{
        const request={};
        queueMicrotask(()=>{request.result={transaction:()=>{
            transaction={objectStore:()=>({put:()=>{}})}; return transaction;
        }};request.onsuccess();});return request;
    }});
    const {saveWorkspace}=await import('./storage.js');
    const saving=saveWorkspace({sequences:[],tabs:[],activeTabId:null,activeSequenceIdx:-1,tabCounter:0});
    const assertion=expect(saving).rejects.toThrow('aborted');
    await vi.waitFor(()=>expect(transaction?.onabort).toBeDefined());
    transaction.onabort(); await assertion;
});
it('keeps guest, users and recovery backups in separate local keys',async()=>{
    const keys=[];
    vi.stubGlobal('indexedDB',{open:()=>{
        const request={};
        queueMicrotask(()=>{request.result={transaction:()=>{
            const tx={objectStore:()=>({put:(_value,key)=>{keys.push(key);queueMicrotask(()=>tx.oncomplete());}})};
            return tx;
        }};request.onsuccess();});return request;
    }});
    const {saveWorkspace,setWorkspaceOwner}=await import('./storage.js');
    const state={sequences:[],tabs:[],activeTabId:null,activeSequenceIdx:-1,tabCounter:0};
    await saveWorkspace(state);
    setWorkspaceOwner('A');await saveWorkspace(state);await saveWorkspace(state,true);
    setWorkspaceOwner('B');await saveWorkspace(state);
    expect(keys).toEqual(['currentState','user:A','user:A:backup','user:B']);
});
