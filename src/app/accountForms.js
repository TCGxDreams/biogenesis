// @ts-nocheck -- DOM form controller.

/** Account forms use Supabase Auth metadata; no extra profile table is needed. */
/** @param {any} app @param {any} client @param {() => void} emailCode */
export function showPasswordLogin(app, client, emailCode) {
    const en = document.documentElement.lang === 'en';
    const t = (vi, english) => en ? english : vi;
    let signup = false;
    app.showModal(`<section class="account-card"><span class="eyebrow">BIOGENESIS</span><h2>${t('Chào mừng trở lại','Welcome back')}</h2><p>${t('Đăng nhập để sử dụng không gian làm việc riêng.','Sign in to your personal workspace.')}</p><div class="account-tabs"><button id="auth-login-tab" class="btn btn-secondary" aria-pressed="true">${t('Đăng nhập','Sign in')}</button><button id="auth-signup-tab" class="btn btn-secondary" aria-pressed="false">${t('Tạo tài khoản','Create account')}</button></div><form id="password-login" class="account-form"><label id="signup-name-label" hidden>${t('Tên hiển thị','Display name')}<input name="name" class="form-input" maxlength="80" autocomplete="name"></label><label>Email<input name="email" class="form-input" type="email" required autocomplete="email"></label><label>${t('Mật khẩu','Password')}<input name="password" class="form-input" type="password" required autocomplete="current-password"></label><label class="account-check"><input id="show-auth-password" type="checkbox">${t('Hiện mật khẩu','Show password')}</label><button id="password-submit" class="btn btn-primary">${t('Đăng nhập','Sign in')}</button></form><button id="auth-use-code" class="btn btn-secondary">${t('Dùng mã email / Quên mật khẩu','Use email code / Forgot password')}</button><p id="password-feedback" role="status" aria-live="polite"></p><small>${t('Workspace khách và tài khoản được lưu riêng.','Guest and account workspaces are separate.')}</small></section>`);
    const form = /** @type {HTMLFormElement} */ (document.getElementById('password-login'));
    const password = /** @type {HTMLInputElement} */ (form.elements.namedItem('password'));
    const submit = /** @type {HTMLButtonElement} */ (document.getElementById('password-submit'));
    const feedback = document.getElementById('password-feedback');
    const setMode = mode => {
        signup = mode;
        document.getElementById('signup-name-label').hidden = !mode;
        document.getElementById('auth-login-tab').setAttribute('aria-pressed', String(!mode));
        document.getElementById('auth-signup-tab').setAttribute('aria-pressed', String(mode));
        password.autocomplete = mode ? 'new-password' : 'current-password';
        password.minLength = mode ? 8 : 1;
        submit.textContent = mode ? t('Tạo tài khoản','Create account') : t('Đăng nhập','Sign in');
        feedback.textContent = '';
    };
    document.getElementById('auth-login-tab').onclick = () => setMode(false);
    document.getElementById('auth-signup-tab').onclick = () => setMode(true);
    document.getElementById('auth-use-code').onclick = emailCode;
    document.getElementById('show-auth-password').onchange = event => { password.type = event.target.checked ? 'text' : 'password'; };
    form.onsubmit = async event => {
        event.preventDefault();
        if (submit.disabled) return;
        submit.disabled = true;
        const controls = Array.from(document.querySelectorAll('.account-tabs button, #auth-use-code'));
        controls.forEach(button => { button.disabled = true; });
        feedback.textContent = t('Đang xử lý…','Working…');
        try {
            const values = new FormData(form);
            const email = String(values.get('email')).trim();
            const credentials = {email, password: String(values.get('password'))};
            const result = signup ? await client.auth.signUp({...credentials, options: {data: {display_name: String(values.get('name') || '').trim()}}}) : await client.auth.signInWithPassword(credentials);
            if (result.error) throw result.error;
            password.value = '';
            feedback.textContent = signup && !result.data.session ? t('Kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.','Check your email to confirm your account, then sign in.') : t('Đăng nhập thành công…','Signed in…');
        } catch (error) {
            feedback.textContent = error?.code === 'invalid_credentials' ? t('Email hoặc mật khẩu chưa đúng.','Incorrect email or password.') : error.message || t('Không thể kết nối. Vui lòng thử lại.','Unable to connect. Please try again.');
        } finally { submit.disabled = false; controls.forEach(button => { button.disabled = false; }); }
    };
}

/** @param {any} app @param {any} client @param {any} user */
export function mountProfileForm(app, client, user) {
    const en = document.documentElement.lang === 'en';
    const t = (vi, english) => en ? english : vi;
    const section = document.createElement('section');
    section.className = 'account-profile';
    section.innerHTML = `<h3>${t('Thông tin tài khoản','Account details')}</h3><form id="account-profile-form" class="account-form"><label>${t('Tên hiển thị','Display name')}<input name="display_name" class="form-input" maxlength="80" value="${app.escapeHtml(String(user.user_metadata?.display_name || user.user_metadata?.full_name || ''))}" autocomplete="name"></label><button class="btn btn-secondary">${t('Lưu tên','Save name')}</button></form><details><summary>${t('Đổi mật khẩu','Change password')}</summary><form id="account-password-form" class="account-form"><label>${t('Mật khẩu mới (ít nhất 8 ký tự)','New password (at least 8 characters)')}<input name="password" class="form-input" type="password" minlength="8" required autocomplete="new-password"></label><label>${t('Nhập lại mật khẩu','Confirm password')}<input name="confirm" class="form-input" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn btn-secondary">${t('Lưu mật khẩu','Save password')}</button></form></details><p id="profile-feedback" role="status"></p>`;
    document.getElementById('account-signout')?.before(section);
    for (const id of ['account-profile-form','account-password-form']) {
        const form = section.querySelector(`#${id}`);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const button = form.querySelector('button');
            if (button.disabled) return;
            const feedback = section.querySelector('#profile-feedback');
            const values = new FormData(form);
            const isPassword = id === 'account-password-form';
            if (isPassword && values.get('password') !== values.get('confirm')) { feedback.textContent = t('Hai mật khẩu chưa khớp.','Passwords do not match.'); return; }
            button.disabled = true;
            try {
                const {error} = await client.auth.updateUser(isPassword ? {password: String(values.get('password'))} : {data: {display_name: String(values.get('display_name')).trim()}});
                if (error) throw error;
                if (isPassword) form.reset();
                feedback.textContent = t('Đã lưu thay đổi.','Changes saved.');
            } catch (error) { feedback.textContent = error.message; }
            finally { button.disabled = false; }
        });
    }
}
