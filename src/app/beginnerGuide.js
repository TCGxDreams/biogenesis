// @ts-nocheck -- DOM controller, matching the existing UI layer.
import { BEGINNER_STEPS } from '../data/beginnerSteps.js';
import { activeSequenceView } from './sequenceViewHost.js';
import { computeAndRenderAlignment } from '../components/SequenceAlignment.js';
import { computeMotifSearch } from '../components/MotifFinder.js';
import { escapeHtml as esc } from './ui.js';
const bi = ([en,vi]) => `<span data-en="${esc(en)}" data-vi="${esc(vi)}">${esc(en)}</span>`;

export function startBeginnerGuide(app, lesson, ids, progress, save, openHub) {
    const steps = BEGINNER_STEPS[lesson.id];
    let step = steps.findIndex((_, i) => !progress[`guided-v2-${lesson.id}-${i}`]);
    if (step < 0) step = 0;
    const dock = document.getElementById('lesson-dock') || document.createElement('aside');
    dock.id = 'lesson-dock'; dock.className = 'beginner-guide';
    if (!dock.isConnected) document.getElementById('content-area').prepend(dock);
    function clearHighlight() { document.querySelectorAll('.guide-target').forEach(el => el.classList.remove('guide-target')); }
    function highlight(selector) {
        const target = document.querySelector(selector);
        target?.classList.add('guide-target');
        target?.scrollIntoView({block:'nearest',behavior:'instant'});
    }
    function openStep() {
        const config = lesson.steps[step];
        app.setState({activeTool: config.tool}); app.openSequence(ids[config.sample || 0]);
    }
    function runTask() {
        clearHighlight(); openStep();
        const item = steps[step];
        if (item.task === 'select' || item.task === 'select-all') {
            const length = app.state.sequences[ids[lesson.steps[step].sample || 0]].sequence.length;
            activeSequenceView()?.select(0,item.task === 'select' ? 3 : length);
            highlight('.sv-canvas');
        } else if (item.task === 'translate') highlight('.frame-row');
        else if (item.task === 'statistics') highlight('#panel-container .stats-grid');
        else if (item.task === 'motif') {
            document.getElementById('motif-pattern').value = 'ATG';
            document.getElementById('motif-mode').value = 'exact';
            document.getElementById('motif-strand').value = 'forward';
            document.getElementById('motif-result').innerHTML = computeMotifSearch(app.state.sequences[ids[3]],'ATG','exact','forward');
            highlight('#motif-result');
        } else {
            const selectedIds = ids.slice(0,item.task === 'pair' ? 2 : 3);
            document.querySelectorAll('.align-seq-check').forEach(input => {input.checked = selectedIds.includes(Number(input.value));});
            const algorithm = item.task === 'pair' ? 'nw' : 'msa';
            document.getElementById('align-algo').value = algorithm;
            document.getElementById('align-sel-count').textContent = `${selectedIds.length} selected`;
            document.getElementById('alignment-result').innerHTML = computeAndRenderAlignment(selectedIds.map(id=>app.state.sequences[id]),algorithm);
            highlight('.alignment-container');
        }
        document.getElementById('guide-question').hidden = false;
        document.getElementById('guide-run').setAttribute('aria-expanded','true');
        document.getElementById('guide-question').scrollIntoView({block:'nearest'});
    }
    function draw() {
        clearHighlight(); openStep();
        const item = steps[step];
        const done = steps.filter((_,i)=>progress[`guided-v2-${lesson.id}-${i}`]).length;
        dock.innerHTML = `<div class="lesson-top"><span class="guide-kicker">${bi(['GUIDED PRACTICE','THỰC HÀNH CÓ HƯỚNG DẪN'])} · ${step+1}/${steps.length}</span><button id="guide-collapse" class="ws-secondary" aria-expanded="true"><span data-en="Collapse / expand" data-vi="Thu gọn / mở rộng">Thu gọn / mở rộng</span></button><button id="guide-close" class="ws-secondary">${bi(['Pause','Tạm dừng'])}</button></div>
        <progress value="${done}" max="${steps.length}" aria-label="Lesson progress"></progress>
        <h2>${bi(item.title)}</h2><p>${bi(item.concept)}</p>
        <div class="guide-task-row"><button id="guide-run" class="ws-primary" aria-controls="guide-question" aria-expanded="false">① ${bi(item.action)}</button><small>${bi(['The correct sample and settings are prepared for you.','Mẫu và thông số phù hợp đã được chọn sẵn.'])}</small></div>
        <fieldset id="guide-question" hidden><legend>② ${bi(item.question)}</legend><div class="guide-choices">${item.choices.map((choice,i)=>`<button class="ws-secondary" data-guide-answer="${i}">${bi(choice)}</button>`).join('')}</div><div id="guide-feedback" role="status" aria-live="polite"></div></fieldset>
        <div class="lesson-actions"><button id="guide-back" class="ws-secondary" ${step===0?'disabled':''}>${bi(['← Previous','← Bước trước'])}</button><span>${bi(['You can retry as often as you like.','Bạn có thể thử lại, không giới hạn số lần.'])}</span><button id="guide-next" class="ws-primary" disabled>${bi(step===steps.length-1 ? ['Finish lesson ✓','Hoàn thành bài ✓']:['Next step →','Bước tiếp theo →'])}</button></div>`;
        dock.classList.remove('guide-collapsed');
        document.getElementById('guide-collapse').onclick = event => {
            const collapsed = dock.classList.toggle('guide-collapsed');
            event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
        };
        document.getElementById('guide-close').onclick = () => {clearHighlight();dock.remove();};
        document.getElementById('guide-run').onclick = runTask;
        dock.querySelectorAll('[data-guide-answer]').forEach(button => button.onclick = () => {
            const correct = Number(button.dataset.guideAnswer) === item.correct;
            document.getElementById('guide-feedback').innerHTML = `<p class="${correct?'guide-correct':''}">${bi(correct ? ['Correct!','Đúng rồi!']:['Not quite. Try the other answer.','Chưa đúng. Hãy thử phương án còn lại.'])} ${bi(item.explanation)}</p>`;
            if (correct) {
                progress[`guided-v2-${lesson.id}-${step}`] = true;save();
                document.getElementById('guide-next').disabled = false;
                dock.querySelector('progress').value = steps.filter((_,i)=>progress[`guided-v2-${lesson.id}-${i}`]).length;
            }
        });
        document.getElementById('guide-back').onclick = () => {step--;draw();};
        document.getElementById('guide-next').onclick = () => {
            if (step < steps.length-1) {step++;draw();return;}
            clearHighlight();
            dock.innerHTML = `<div class="guide-complete"><h2>${bi(['Lesson complete!','Bạn đã hoàn thành bài!'])}</h2><p>${bi(['You practiced three ideas. Keep exploring the results below, or choose another lesson.','Bạn đã thực hành 3 kiến thức. Có thể tiếp tục khám phá kết quả bên dưới hoặc chọn bài khác.'])}</p><button id="guide-library" class="ws-primary">${bi(['Choose another lesson','Chọn bài tiếp theo'])}</button><button id="guide-exit" class="ws-secondary">${bi(['Explore on my own','Tự khám phá tiếp'])}</button></div>`;
            document.getElementById('guide-library').onclick = () => {dock.remove();openHub();};
            document.getElementById('guide-exit').onclick = () => dock.remove();
        };
        dock.scrollTop=0;
    }
    draw();
}
