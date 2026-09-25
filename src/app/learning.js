// @ts-nocheck -- UI controller, consistent with the existing app controllers.
import { startBeginnerGuide } from './beginnerGuide.js';
import { PRACTICE_PACKS, LESSONS } from '../data/practice.js';
import { escapeHtml as esc } from './ui.js';
const bi = (en, vi) => `<span data-en="${esc(en)}" data-vi="${esc(vi)}">${esc(en)}</span>`;

export function initLearning(app) {
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem('biogenesis-lessons') || '{}') || {}; } catch { /* optional */ }
    if (typeof progress !== 'object' || Array.isArray(progress)) progress = {};
    const save = () => { try { localStorage.setItem('biogenesis-lessons', JSON.stringify(progress)); } catch { /* optional */ } };
    function loadPack(pack) {
        const indices = pack.samples.map((sample, i) => {
            const id = `${pack.id}-${i}`;
            let index = app.state.sequences.findIndex(s => s.practiceId === id && s.sequence === sample.sequence);
            if (index < 0) {
                const record = { ...structuredClone(sample), practiceId: id };
                app.setState({ sequences: [...app.state.sequences, record] });
                index = app.state.sequences.length - 1;
            }
            return index;
        });
        app.renderFileTree();
        return indices;
    }
    function openHub() {
        app.showModal(`<div class="learning-hub"><div class="workspace-heading"><h2>${bi('Learning library','Thư viện thực hành')}</h2></div>
        <p>${bi('16 synthetic examples across 5 packs. These illustrate concepts; they are not reference genomes.','16 mẫu tổng hợp trong 5 bộ. Dùng để minh họa khái niệm, không phải hệ gen tham chiếu.')}</p>
        <h3>${bi('New here? Start with lesson 1. No prior knowledge needed.','Lần đầu sử dụng? Bắt đầu bài 1. Không cần biết trước thuật ngữ.')}</h3><div class="hub-grid">${LESSONS.map(lesson => {
            const done = lesson.steps.filter((_,i) => progress[`guided-v2-${lesson.id}-${i}`]).length;
            return `<article class="${lesson.id === 'first' ? 'recommended-lesson' : ''}">${lesson.id === 'first' ? `<small>${bi('START HERE · 3 SHORT STEPS','BẮT ĐẦU TẠI ĐÂY · 3 BƯỚC NGẮN')}</small>` : ''}<h3>${bi(lesson.title,lesson.vi)}</h3><progress value="${done}" max="${lesson.steps.length}"></progress><p>${done}/${lesson.steps.length}</p><button class="ws-primary" data-start-lesson="${lesson.id}">${bi('Start / resume','Bắt đầu / tiếp tục')}</button></article>`;
        }).join('')}</div>
        <h3>${bi('Sample packs','Các bộ mẫu')}</h3><div class="hub-grid">${PRACTICE_PACKS.map(pack => `<article><h3>${bi(pack.title,pack.vi)}</h3><p>${bi(pack.goal,pack.goalVi)}</p><small>${pack.samples.length} ${bi('samples · synthetic','mẫu · tổng hợp')}</small><button class="ws-secondary" data-load-pack="${pack.id}">${bi('Load samples','Nạp mẫu')}</button></article>`).join('')}</div>
        <h3>${bi('References & further learning','Tài liệu tham khảo & học thêm')}</h3><ul class="reference-list">
        <li><a href="https://www.ebi.ac.uk/training/online/courses/bioinformatics-terrified/" target="_blank" rel="noopener noreferrer">EMBL-EBI · Bioinformatics for the terrified ↗</a><p>${bi('Introductory course on bioinformatics resources.','Khóa nhập môn về các tài nguyên tin sinh học.')}</p></li>
        <li><a href="https://www.ncbi.nlm.nih.gov/books/NBK25499/" target="_blank" rel="noopener noreferrer">NCBI · E-utilities reference ↗</a></li>
        <li><a href="https://www.uniprot.org/help/api_queries" target="_blank" rel="noopener noreferrer">UniProt · Searching protein records ↗</a></li>
        <li><a href="https://manual.geneious.com/en/latest/Sequences.html" target="_blank" rel="noopener noreferrer">Geneious Prime · Sequences & viewing ↗</a></li></ul></div>`);
        document.querySelectorAll('[data-load-pack]').forEach(button => button.onclick = () => {
            const pack = PRACTICE_PACKS.find(p => p.id === button.dataset.loadPack);
            const ids = loadPack(pack);
            app.hideModal(); app.setState({activeTool:pack.tool}); app.openSequence(ids[0]);
        });
        document.querySelectorAll('[data-start-lesson]').forEach(button => button.onclick = () => {
            const lesson = LESSONS.find(l => l.id === button.dataset.startLesson);
            const pack = PRACTICE_PACKS.find(p => p.id === lesson.pack);
            const ids = loadPack(pack);
            app.hideModal();
            startBeginnerGuide(app, lesson, ids, progress, save, openHub);
        });
    }
    document.getElementById('learning-hub-btn')?.addEventListener('click', openHub);
    document.addEventListener('biogenesis:start-first-lesson', () => {
        const lesson = LESSONS[0];
        const pack = PRACTICE_PACKS.find(p => p.id === lesson.pack);
        startBeginnerGuide(app, lesson, loadPack(pack), progress, save, openHub);
    });
}
