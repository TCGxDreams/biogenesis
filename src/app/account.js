import { showPasswordLogin, mountProfileForm } from './accountForms.js';
import { supabase } from '../services/supabase.js';
import { cloudPayload, validateCloudPayload } from '../services/cloudWorkspace.js';
import { loadWorkspace, saveWorkspace } from '../utils/storage.js';

/** @param {import('./types.js').App} app
 * @param {import('./store.js').Store} store
 * @param {import('@supabase/supabase-js').User|null} user
 */
export function initAccount(app, store, user) {
    const client = supabase;
    let revision = 0;
    let ready = false;
    let automatic = false;
    let syncing = false;
    let stopped = false;
    let lastJSON = '';
    let status = '';
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    /** @param {string} vi @param {string} en */
    const bi = (vi,en) => `<span data-vi="${app.escapeHtml(vi)}" data-en="${app.escapeHtml(en)}">${app.escapeHtml(vi)}</span>`;
    const renderStatus = () => {
        const node = document.getElementById('account-status');
        if (node) node.textContent = status;
        const button = document.getElementById('account-button');
        if (button) button.title = status;
        const indicator = document.getElementById('cloud-sync-state');
        if (indicator) { indicator.textContent = status; indicator.title = status; }
    };
    /** @param {unknown} error */
    const failure = error => {
        const message = error instanceof Error ? error.message : String(/** @type {any} */(error)?.message || error);
        if (message.includes('WORKSPACE_CONFLICT')) { ready = false; automatic = false; const checkbox = /** @type {HTMLInputElement|null} */(document.getElementById('cloud-auto')); if (checkbox) checkbox.checked = false; }
        status = message.includes('WORKSPACE_CONFLICT') ? 'Có bản mới trên cloud. Mở lại Tài khoản để kiểm tra trước khi lưu. / Cloud conflict: reopen Account to review.' : message;
        renderStatus();
    };
    async function upload() {
        if (!client || !user || !ready || syncing || stopped) return;
        const snapshot = cloudPayload(app.state);
        if (snapshot.json === lastJSON) { status = 'Đã đồng bộ / Up to date'; renderStatus(); return; }
        syncing = true;
        try {
            status = 'Đang lưu cloud… / Saving…'; renderStatus();
            const {data,error} = await client.rpc('save_biogenesis_workspace',{expected_revision:revision,new_payload:snapshot.payload});
            if (error) throw error;
            if (stopped) return;
            revision = Number(data); lastJSON = snapshot.json;
            status = 'Đã lưu cloud / Saved to cloud'; renderStatus();
            if (automatic && cloudPayload(app.state).json !== lastJSON) timer = setTimeout(() => { upload().catch(failure); },10000);
        } finally { syncing = false; }
    }
    store.subscribe(() => {
        clearTimeout(timer);
        if (automatic && ready && !stopped) timer = setTimeout(() => { upload().catch(failure); },10000);
    });
    /** @param {any} payload */
    async function apply(payload) {
        await saveWorkspace(app.state, true);
        app.setState({sequences:payload.sequences,analysisDocuments:payload.analysisDocuments || [],tabs:[],activeTabId:null,activeSequenceIdx:-1,activeAnalysisId:null,activeTool:'viewer',tabCounter:0});
        app.renderFileTree(); app.renderTabs(); app.renderWelcomeScreen();
        await store.flush();
    }
    async function show(useCode = false) {
        if (!client) {
            app.showModal(`<h2>${bi('Lưu và đăng nhập','Save and sign in')}</h2><p>${bi('Cloud chưa được cấu hình. Workspace vẫn được lưu trên trình duyệt này.','Cloud is not configured. Your workspace is still saved in this browser.')}</p>`);
            return;
        }
        if (!user && !useCode) { showPasswordLogin(app, client, () => { show(true).catch(failure); }); return; }
        if (!user) {
            app.showModal(`<h2>${bi('Đăng nhập bằng email','Sign in with email')}</h2><p>${bi('Nhận mã qua email. Dữ liệu khách và tài khoản được lưu riêng.','Receive an email code. Guest and account workspaces are separate.')}</p><form id="account-login" class="account-form"><label>Email<input class="form-input" id="account-email" type="email" autocomplete="email" required></label><button class="btn btn-primary">${bi('Gửi mã đăng nhập','Send sign-in code')}</button></form><form id="account-verify" class="account-form" hidden><label>${bi('Mã trong email','Email code')}<input id="account-code" class="form-input" inputmode="numeric" autocomplete="one-time-code" required></label><button class="btn btn-primary">${bi('Xác nhận','Verify')}</button></form><p id="account-status" role="status"></p>`);
            let email = '';
            document.getElementById('account-login')?.addEventListener('submit', async event => {
                event.preventDefault();
                const form = /** @type {HTMLFormElement} */(event.currentTarget);
                const button = /** @type {HTMLButtonElement} */(form.querySelector('button'));
                button.disabled = true;
                try {
                    email = /** @type {HTMLInputElement} */(document.getElementById('account-email')).value.trim();
                    const {error} = await client.auth.signInWithOtp({email});
                    if (error) throw error;
                    document.getElementById('account-verify')?.removeAttribute('hidden');
                    status = 'Kiểm tra email để lấy mã. / Check your email for the code.'; renderStatus();
                } catch (error) { failure(error); } finally { button.disabled = false; }
            });
            document.getElementById('account-verify')?.addEventListener('submit', async event => {
                event.preventDefault();
                const token = /** @type {HTMLInputElement} */(document.getElementById('account-code')).value.trim();
                const button = /** @type {HTMLButtonElement} */(/** @type {HTMLFormElement} */(event.currentTarget).querySelector('button'));
                if (button.disabled) return;
                button.disabled = true;
                try {
                    const {error} = await client.auth.verifyOtp({email,token,type:'email'});
                    if (error) throw error;
                } catch(error) { failure(error); }
                finally { button.disabled = false; }
            });
            return;
        }
        app.showModal(`<h2>${bi('Workspace trên cloud','Cloud workspace')}</h2><p>${app.escapeHtml(user.email || '')}</p><p>${bi('Cloud lưu trình tự và tài liệu phân tích, tối đa 4 MiB mỗi workspace. Chọn Lưu để dùng bản trên máy, hoặc Mở để dùng bản cloud.','Cloud saves sequences and analysis documents, up to 4 MiB per workspace. Save uses this device; Open uses the cloud copy.')}</p><div class="analysis-actions"><button class="btn btn-primary" id="cloud-save" disabled>${bi('Lưu bản trên máy lên cloud','Save this device to cloud')}</button><button class="btn btn-secondary" id="cloud-open" disabled>${bi('Mở bản cloud','Open cloud copy')}</button><button class="btn btn-secondary" id="cloud-undo">${bi('Khôi phục trước lần mở cloud','Restore before last cloud load')}</button></div><label><input type="checkbox" id="cloud-auto" ${automatic ? 'checked' : ''}> ${bi('Tự lưu sau 10 giây ngừng chỉnh sửa (bật sau khi chọn Lưu/Mở)','Autosave after 10 seconds idle (enable after Save/Open)')}</label><p id="account-status" role="status">Đang kiểm tra cloud… / Checking cloud…</p><button class="btn btn-secondary" id="account-signout">${bi('Đăng xuất','Sign out')}</button>`);
        mountProfileForm(app, client, user);
        const modal = document.getElementById('account-status');
        document.getElementById('account-signout')?.addEventListener('click', async () => {
            const button = /** @type {HTMLButtonElement} */(document.getElementById('account-signout'));
            button.disabled = true;
            const wasAutomatic = automatic;
            automatic = false; clearTimeout(timer);
            try {
                await store.flush();
                const {error} = await client.auth.signOut({scope:'local'});
                if (error) throw error;
            } catch(error) { automatic = wasAutomatic; failure(error); }
            finally { button.disabled = false; }
        });
        document.getElementById('cloud-auto')?.addEventListener('change', event => {
            const checkbox = /** @type {HTMLInputElement} */(event.target);
            if (checkbox.checked && !ready) { checkbox.checked = false; status = 'Chọn Lưu hoặc Mở trước. / Choose Save or Open first.'; renderStatus(); return; }
            automatic = checkbox.checked; clearTimeout(timer);
            if (automatic) upload().catch(failure);
        });
        document.getElementById('cloud-undo')?.addEventListener('click', async () => {
            if (syncing || stopped) return;
            try { const backup = await loadWorkspace(true); if (!backup) throw new Error('Chưa có bản khôi phục. / No backup yet.'); automatic = false; clearTimeout(timer); await apply(backup); app.hideModal(); } catch(error) { failure(error); }
        });
        try {
            const {data,error} = await client.from('biogenesis_workspaces').select('payload,revision,updated_at').eq('owner_id',user.id).maybeSingle();
            if (error) throw error;
            if (stopped || !modal?.isConnected) return;
            // Only update baseline after explicit user choice; autosave keeps its own revision.
            status = data ? `Cloud: ${data.updated_at} · revision ${data.revision}` : 'Chưa có bản cloud. / No cloud copy yet.'; renderStatus();
            const saveButton = /** @type {HTMLButtonElement} */(document.getElementById('cloud-save'));
            const openButton = /** @type {HTMLButtonElement} */(document.getElementById('cloud-open'));
            saveButton.disabled = false; openButton.disabled = !data;
            saveButton.addEventListener('click', async () => {
                if (syncing || stopped) return;
                saveButton.disabled = true;
                try { if (!ready) revision = data?.revision || 0; ready = true; await upload(); } catch(error) { failure(error); } finally { saveButton.disabled = false; }
            });
            openButton.addEventListener('click', async () => {
                if (!data || syncing || stopped) return;
                openButton.disabled = true;
                try { const payload = validateCloudPayload(data.payload); automatic = false; clearTimeout(timer); await apply(payload); revision = data.revision; lastJSON = cloudPayload(app.state).json; ready = true; app.hideModal(); } catch(error) { failure(error); openButton.disabled = false; }
            });
        } catch(error) { failure(error); }
    }
    if (user) { const button = document.getElementById('account-button'); button?.setAttribute('data-vi','Đã đăng nhập'); button?.setAttribute('data-en','Signed in'); if (button) button.title = user.email || ''; }
    document.getElementById('account-button')?.addEventListener('click', () => { show().catch(failure); });
    if (client) client.auth.onAuthStateChange((_event,session) => {
        if (session?.user.id === user?.id && session?.user) user = session.user;
        if ((session?.user.id || null) !== (user?.id || null)) {
            stopped = true; automatic = false; clearTimeout(timer);
            // Flush into the OLD account namespace before reloading into the new session.
            setTimeout(() => { store.flush().finally(() => window.location.reload()); },0);
        }
    });
}
