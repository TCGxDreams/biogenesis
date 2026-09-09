import {afterEach,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({rpc:vi.fn(),maybeSingle:vi.fn(),onAuthStateChange:vi.fn()}));
vi.mock('../services/supabase.js',()=>({supabase:{rpc:fake.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:fake.maybeSingle})})}),auth:{onAuthStateChange:fake.onAuthStateChange}}}));
import {initAccount} from './account.js';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
function setup(){
 const elements={};
 const element=id=>elements[id] ||= {listeners:{},isConnected:true,disabled:false,textContent:'',setAttribute:vi.fn(),addEventListener(event,fn){this.listeners[event]=fn;}};
 vi.stubGlobal('document',{getElementById:element});
 const app={state:{sequences:[{name:'a',type:'dna',sequence:'ATG'}],analysisDocuments:[]},escapeHtml:s=>s,showModal:vi.fn()};
 const store={subscribe:fn=>{store.changed=fn;},flush:vi.fn()};
 initAccount(app,store,{id:'user-A',email:'a@example.com'});
 return {elements,app,store};
}
it('uses cloud revision and omits navigation when saving',async()=>{
 fake.maybeSingle.mockResolvedValue({data:{revision:4,updated_at:'now'},error:null});
 fake.rpc.mockResolvedValue({data:5,error:null});
 const {elements,app}=setup();
 elements['account-button'].listeners.click();
 await vi.waitFor(()=>expect(elements['cloud-save']?.disabled).toBe(false));
 await elements['cloud-save'].listeners.click();
 expect(fake.rpc).toHaveBeenCalledWith('save_biogenesis_workspace',{expected_revision:4,new_payload:{schemaVersion:1,sequences:app.state.sequences,analysisDocuments:[]}});
 await elements['cloud-save'].listeners.click();
 expect(fake.rpc).toHaveBeenCalledTimes(1);
});
it('pauses autosync on conflict instead of silently replacing the remote',async()=>{
 fake.maybeSingle.mockResolvedValue({data:{revision:2,updated_at:'now'},error:null});
 fake.rpc.mockResolvedValue({data:null,error:{message:'WORKSPACE_CONFLICT'}});
 const {elements}=setup();elements['account-button'].listeners.click();
 await vi.waitFor(()=>expect(elements['cloud-save']?.disabled).toBe(false));
 await elements['cloud-save'].listeners.click();
 const checkbox={checked:true};
 elements['cloud-auto'].listeners.change({target:checkbox});
 expect(checkbox.checked).toBe(false);
 expect(fake.rpc).toHaveBeenCalledTimes(1);
});
