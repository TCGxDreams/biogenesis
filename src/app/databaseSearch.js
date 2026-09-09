// @ts-nocheck -- DOM controller, following the existing application layer.
import { searchDatabase, fetchDatabaseRecord, IMPORT_LIMIT } from '../services/database.js';
import { escapeHtml as esc } from './ui.js';
const bi = (en,vi) => `<span data-en="${esc(en)}" data-vi="${esc(vi)}">${esc(en)}</span>`;

export function openDatabaseSearch(app, initialQuery = '', initialSource = 'nucleotide') {
    let controller = null;
    let page = 0;
    let total = 0;
    let records = [];
    let query = '';
    let source = initialSource;
    app.showModal(`<section class="database-dialog"><div class="workspace-heading"><h2>${bi('Database search','Tìm cơ sở dữ liệu')}</h2><button id="db-close" class="ws-secondary">${bi('Close','Đóng')}</button></div>
    <p>${bi('Search first, review a record, then import. A network connection is required.','Tìm kiếm, xem bản ghi rồi nhập vào dự án. Cần kết nối mạng.')}</p>
    <form id="db-form" class="database-form"><label>${bi('Database','Cơ sở dữ liệu')}<select id="db-source"><option value="nucleotide">NCBI Nucleotide</option><option value="protein">NCBI Protein</option><option value="uniprot">UniProtKB</option></select></label><label>${bi('Keyword or accession','Từ khóa hoặc mã truy cập')}<input id="db-query" required maxlength="300" value="${esc(initialQuery)}" placeholder="BRCA1 / NM_000546.6 / P04637"></label><button id="db-search" class="ws-primary">${bi('Search','Tìm kiếm')}</button><button type="button" id="db-cancel" class="ws-secondary" disabled>${bi('Cancel','Hủy')}</button></form>
    <div class="database-examples">${bi('Try','Thử')}: <button data-db-example="BRCA1[Gene] AND Homo sapiens[Organism]" data-source="nucleotide">BRCA1 · human</button><button data-db-example="NP_000537.3" data-source="protein">p53 · NCBI</button><button data-db-example="P04637" data-source="uniprot">p53 · UniProt</button></div>
    <p id="db-status" role="status" aria-live="polite"></p><div id="db-results"></div><div class="database-pager"><button id="db-prev" class="ws-secondary" disabled>←</button><span id="db-page"></span><button id="db-next" class="ws-secondary" disabled>→</button></div>
    <p class="workspace-footnote">${bi('Showing up to 10 records per page. UniProt preview shows the first 10 matches. Import limit: 100,000 residues.','Tối đa 10 bản ghi/trang. UniProt xem trước 10 kết quả đầu. Giới hạn nhập: 100.000 ký tự trình tự.')}</p></section>`);
    const dialog = document.querySelector('.database-dialog');
    let closed = false;
    const alive = () => !closed && dialog.isConnected;
    const el = id => dialog.querySelector(`#${id}`);
    el('db-source').value = source;
    const status = (en,vi) => { el('db-status').innerHTML = bi(en,vi); };
    function busy(value) {
        for (const id of ['db-search','db-source','db-query']) el(id).disabled = value;
        el('db-cancel').disabled = !value;
        el('db-prev').disabled = value || page === 0 || source === 'uniprot';
        el('db-next').disabled = value || (page+1)*10 >= total || source === 'uniprot';
        document.querySelectorAll('[data-import-record], [data-db-example]').forEach(b => { b.disabled = value || b.dataset.tooLarge === 'true'; });
    }
    async function run() {
        controller?.abort();
        const current = new AbortController(); controller = current;
        const timer = setTimeout(() => current.abort(new Error('Request timed out. Please retry.')), 20000);
        records=[]; total=0; el('db-results').innerHTML=''; el('db-page').textContent='';
        busy(true); status('Searching…','Đang tìm…');
        try {
            const result = await searchDatabase(source,query,page,current.signal);
            if (current.signal.aborted || !alive()) return;
            records=result.records; total=result.total;
            status(`${total.toLocaleString()} results found. Review the accession and description before importing.`, `Tìm thấy ${total.toLocaleString()} kết quả. Kiểm tra mã và mô tả trước khi nhập.`);
            el('db-page').textContent = records.length ? `${page*10+1}–${page*10+records.length} / ${total.toLocaleString()}` : '0';
            el('db-results').innerHTML = records.length ? records.map((r,i) => `<article class="database-record"><div><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.accession)} ↗</a><h3>${esc(r.title)}</h3><p>${esc(r.organism)} · ${r.length.toLocaleString()} ${source === 'nucleotide'?'bp':'aa'} · ${source === 'uniprot'?'UniProtKB':'NCBI'}</p></div><button class="ws-secondary" data-import-record="${i}" data-too-large="${r.length>IMPORT_LIMIT}" ${r.length>IMPORT_LIMIT?'disabled':''}>${r.length>IMPORT_LIMIT ? bi('Too large','Quá dài') : bi('Import','Nhập')}</button></article>`).join('') : bi('No matches. Try a gene name, organism or accession.','Không có kết quả. Thử tên gene, sinh vật hoặc mã truy cập.');
            document.querySelectorAll('[data-import-record]').forEach(button => button.onclick = () => importRecord(records[Number(button.dataset.importRecord)]));
        } catch(error) { if (controller === current && alive()) status(current.signal.aborted ? 'Search cancelled or timed out. Retry when ready.' : error.message, current.signal.aborted ? 'Đã hủy hoặc hết thời gian. Bạn có thể thử lại.' : `Tìm kiếm thất bại: ${error.message}`); }
        finally { clearTimeout(timer); if (controller === current && alive()) busy(false); }
    }
    async function importRecord(record) {
        const existing = app.state.sequences.findIndex(s => s.accession === record.accession && s.sourceDatabase === record.source);
        if (existing >= 0) { app.hideModal(); app.setState({activeTool:'viewer'}); app.openSequence(existing); return; }
        controller = new AbortController(); const current = controller;
        const timer = setTimeout(() => current.abort(),20000);
        busy(true); status('Importing…','Đang nhập…');
        try {
            const fasta = await fetchDatabaseRecord(record,current.signal);
            if (current.signal.aborted || !alive()) return;
            app.setState({activeTool:'viewer'});
            app.addFastaToProject(fasta,record.source === 'nucleotide'?'nucleotide':'protein');
            const sequence = app.state.sequences[app.state.activeSequenceIdx];
            sequence.accession = record.accession; sequence.sourceUrl = record.url; sequence.sourceDatabase = record.source;
            if (record.source === 'uniprot') sequence.uniprotId = record.accession;
            app.setState({sequences:[...app.state.sequences],activeTool:'viewer'});
            app.renderToolPanel(); app.hideModal();
        } catch(error) { if (alive()) status(current.signal.aborted ? 'Import cancelled or timed out.' : error.message, current.signal.aborted ? 'Đã hủy hoặc hết thời gian nhập.' : `Nhập thất bại: ${error.message}`); }
        finally { clearTimeout(timer); if(alive()) busy(false); }
    }
    el('db-close').onclick = () => {closed=true; controller?.abort(); app.hideModal();};
    el('db-cancel').onclick = () => controller?.abort();
    el('db-form').onsubmit = e => { e.preventDefault(); query=el('db-query').value.trim(); if(!query)return; source=el('db-source').value; page=0; run(); };
    el('db-prev').onclick = () => {page--;run();}; el('db-next').onclick = () => {page++;run();};
    document.querySelectorAll('[data-db-example]').forEach(button => button.onclick = () => {el('db-query').value=button.dataset.dbExample;el('db-source').value=button.dataset.source;});
    el('db-query').focus();
}
