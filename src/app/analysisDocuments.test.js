import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./sequenceViewHost.js',()=>({destroySequenceView:vi.fn()}));
import {createAnalysisDocuments} from './analysisDocuments.js';
import {importDocuments} from './documentImport.js';
import {escapeHtml} from './ui.js';
afterEach(()=>vi.unstubAllGlobals());
function setup(doc) {
    const data={innerHTML:'',querySelector:()=>null};
    const panel={innerHTML:'',querySelectorAll:()=>[],querySelector:id=>id==='#analysis-data'?data:null};
    vi.stubGlobal('document',{getElementById:id=>id==='panel-container'?panel:null});
    const state={sequences:[],analysisDocuments:[doc],activeAnalysisId:null,activeSequenceIdx:0,tabs:[],tabCounter:0};
    const app={state,setState:patch=>Object.assign(state,patch),escapeHtml,renderTabs:vi.fn(),renderFileTree:vi.fn(),renderToolPanel:vi.fn()};
    return {app,panel,data,...createAnalysisDocuments(app)};
}
it('opens a typed document in a reusable tab without selecting a sequence',()=>{
    const doc=importDocuments('x.fa','>A\nAT-G\n>B\nATCG').documents[0];
    const ui=setup(doc);
    ui.openAnalysisDocument(doc.id); ui.openAnalysisDocument(doc.id);
    expect(ui.app.state.tabs).toHaveLength(1);
    expect(ui.app.state.tabs[0].documentId).toBe(doc.id);
    expect(ui.app.state.activeSequenceIdx).toBe(-1);
    expect(ui.app.state.activeAnalysisId).toBe(doc.id);
});
it('renders aligned columns without recomputation and escapes imported labels',()=>{
    const doc=importDocuments('x.fa','><img>\nAT-G\n>B\nATCG').documents[0];
    const ui=setup(doc);ui.openAnalysisDocument(doc.id);ui.renderAnalysisDocument();
    expect(ui.data.innerHTML).toContain('AT-G');
    expect(ui.data.innerHTML).toContain('&lt;img&gt;');
    expect(ui.data.innerHTML).not.toContain('<img>');
    expect(ui.panel.innerHTML).toContain('analysis-source');
});
it('shows source branch values including zero without interpreting them as screen distances',()=>{
    const doc=importDocuments('x.tree',"('<script>':0,B:0.123456789)95;").documents[0];
    const ui=setup(doc);ui.openAnalysisDocument(doc.id);ui.renderAnalysisDocument();
    expect(ui.data.innerHTML).toContain('(0)');
    expect(ui.data.innerHTML).toContain('0.123456789');
    expect(ui.data.innerHTML).not.toContain('<script>');
    expect(ui.data.innerHTML).toContain('95');
});
