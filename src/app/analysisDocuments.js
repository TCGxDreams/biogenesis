import { destroySequenceView } from './sequenceViewHost.js';
import { downloadFile } from '../utils/bioUtils.js';
import { exportAnalysisDocument } from './documentImport.js';

/** @param {import('./types.js').App} app */
export function createAnalysisDocuments(app) {
    /** @param {string} id */
    function openAnalysisDocument(id) {
        const doc = app.state.analysisDocuments.find(d => d.id === id);
        if (!doc) return;
        app.setState({activeAnalysisId:id, activeSequenceIdx:-1});
        let tab = app.state.tabs.find(t => t.documentId === id);
        if (!tab) {
            tab = {id:app.state.tabCounter + 1, seqIdx:-1, documentId:id, name:doc.name};
            app.setState({tabs:[...app.state.tabs, tab], tabCounter:tab.id});
        }
        app.setState({activeTabId:tab.id});
        app.renderTabs();
        app.renderFileTree();
        app.renderToolPanel();
    }
    function renderAnalysisDocument() {
        const doc = app.state.analysisDocuments.find(d => d.id === app.state.activeAnalysisId);
        const panel = document.getElementById('panel-container');
        if (!doc || !panel) return;
        destroySequenceView();
        document.getElementById('workspace-context')?.remove();
        const esc = app.escapeHtml;
        /** @param {string} vi @param {string} en */
        const bi = (vi, en) => `<span data-vi="${esc(vi)}" data-en="${esc(en)}">${esc(vi)}</span>`;
        const rows = doc.rows || [];
        const related = app.state.analysisDocuments.filter(other => other.id !== doc.id && doc.source.importId && other.source.importId === doc.source.importId);
        panel.innerHTML = `<section class="panel active analysis-document">
          <div class="panel-header"><h2>${esc(doc.name)}</h2><p>${doc.kind === 'alignment' ? bi('Tài liệu căn chỉnh', 'Alignment document') : bi('Cây phát sinh', 'Phylogenetic tree')} · ${esc(doc.source.filename)}</p></div>
          <div class="panel-body"><p>${bi('Dữ liệu nhập được giữ nguyên. Mở tài liệu không chạy lại phân tích.', 'Imported data is preserved. Opening this document does not rerun analysis.')}</p>
          <div class="analysis-actions"><button class="btn btn-primary" id="analysis-export">${bi('Xuất tài liệu', 'Export document')}</button><button class="btn btn-secondary" id="analysis-source">${bi('Tải tệp nguồn', 'Download source file')}</button>${doc.kind === 'alignment' ? `<button class="btn btn-secondary" id="analysis-extract">${bi('Tạo trình tự bỏ gap để phân tích', 'Create ungapped sequences for analysis')}</button>` : ''}</div>
          <details><summary>${bi('Thông tin dữ liệu', 'Data details')}</summary><dl><dt>${bi('Loại tài liệu', 'Document type')}</dt><dd>${doc.kind}</dd><dt>${bi('Ngày nhập', 'Imported at')}</dt><dd>${esc(doc.source.importedAt)}</dd><dt>${bi('Định dạng nguồn', 'Source format')}</dt><dd>${esc(doc.source.format)}</dd></dl></details>
          ${doc.kind === 'alignment' ? `<p>${bi('Bản sao phân tích bỏ dấu gap và đổi ký hiệu thiếu ? thành N (DNA/RNA) hoặc X (protein). Tài liệu gốc giữ nguyên.', 'Analysis copies remove gaps and replace missing ? with N (DNA/RNA) or X (protein). The source document is preserved.')}</p>` : ''}
          ${related.length ? `<div class="analysis-actions">${bi('Cùng tệp nguồn:', 'From the same source file:')} ${related.map(other => `<button class="btn btn-secondary" data-related-document="${esc(other.id)}">${esc(other.name)}</button>`).join('')}</div>` : ''}
          <div id="analysis-data"></div></div></section>`;
        panel.querySelectorAll('[data-related-document]').forEach(element => element.addEventListener('click', () => openAnalysisDocument(element.getAttribute('data-related-document') || '')));
        panel.querySelector('#analysis-export')?.addEventListener('click', () => {
            const output = exportAnalysisDocument(doc);
            downloadFile(output.text, output.filename);
        });
        panel.querySelector('#analysis-source')?.addEventListener('click', () => downloadFile(doc.source.originalText, doc.source.filename));
        panel.querySelector('#analysis-extract')?.addEventListener('click', () => {
            const extracted = rows.filter(row => row.sequence.replace(/[-.]/g,'').length > 0).map(row => ({...row, sequence:row.sequence.replace(/[-.]/g,'').replace(/\?/g, row.type === 'protein' ? 'X' : 'N'), features:[], annotations:[], description:`Ungapped copy from ${doc.name}; missing ? converted to N/X`, sourceDocumentId:doc.id}));
            if (!extracted.length) { app.setStatus('No residues to extract.'); return; }
            const start = app.state.sequences.length;
            app.setState({sequences:[...app.state.sequences,...extracted], activeTool:'viewer'});
            app.renderFileTree();
            app.openSequence(start);
        });
        const target = panel.querySelector('#analysis-data');
        if (!target) return;
        if (doc.kind === 'alignment') {
            const length = rows[0]?.sequence.length || 0;
            const pageSize = 100;
            let offset = 0;
            const draw = () => {
                const end = Math.min(length, offset + pageSize);
                target.innerHTML = `<p>${rows.length} ${bi('hàng', 'rows')} · ${length} ${bi('cột', 'columns')} · ${rows[0]?.type.toUpperCase()}</p><div class="analysis-actions"><button id="alignment-prev" class="btn btn-secondary" ${offset === 0 ? 'disabled' : ''}>← ${bi('Trước', 'Previous')}</button><span>${offset + 1}–${end} / ${length}</span><button id="alignment-next" class="btn btn-secondary" ${end === length ? 'disabled' : ''}>${bi('Tiếp', 'Next')} →</button></div><div class="analysis-scroll"><table class="imported-alignment"><thead><tr><th>${bi('Trình tự', 'Sequence')}</th><th>${bi('Cột căn chỉnh (bao gồm gap)', 'Aligned columns (including gaps)')}</th></tr></thead><tbody>${rows.map(r => `<tr><th title="${esc(r.name)}">${esc(r.name)}</th><td><pre>${esc(r.sequence.slice(offset,end))}</pre></td></tr>`).join('')}</tbody></table></div>`;
                target.querySelector('#alignment-prev')?.addEventListener('click', () => { offset -= pageSize; draw(); });
                target.querySelector('#alignment-next')?.addEventListener('click', () => { offset += pageSize; draw(); });
            };
            draw();
        } else if (doc.tree) {
            // Topology view deliberately does not imply a distance scale for missing lengths.
            /** @param {import('../core/types.js').TreeNode} node @returns {string} */
            const branch = node => `<li><span>${esc(node.name || '●')}${node.length === undefined ? '' : ` <small>(${node.length})</small>`}</span>${node.children?.length ? `<ul>${node.children.map(branch).join('')}</ul>` : ''}</li>`;
            target.innerHTML = `<p>${bi('Sơ đồ quan hệ; số trong ngoặc là độ dài nhánh từ tệp. Khoảng cách trên màn hình không biểu diễn độ dài nhánh.', 'Topology view; numbers in parentheses are source branch lengths. Screen spacing does not represent branch length.')}</p><div class="analysis-scroll"><ul class="imported-tree">${branch(doc.tree)}</ul></div><details><summary>Newick</summary><pre class="analysis-scroll">${esc(doc.newick || '')}</pre></details>`;
        }
    }
    return {openAnalysisDocument, renderAnalysisDocument};
}
