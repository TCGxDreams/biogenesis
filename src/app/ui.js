// ============================================
// BioGenesis — Shared UI helpers
// ============================================
//
// Status bar, HTML escaping and the theme switch. No application state, so
// these are plain exports rather than a factory.

/**
 * Build the status bar writer. It also refreshes the sequence summary on the
 * right of the bar, so it needs the application context.
 *
 * @param {import('./types.js').App} app
 * @returns {{setStatus: (msg: string) => void}}
 */
export function createStatusBar(app) {
    /** @param {string} msg */
    function setStatus(msg) {
        const el = document.getElementById('status-msg');
        if (el) el.textContent = msg;
        const info = document.getElementById('status-seq-info');
        if (info && app.state.activeSequenceIdx >= 0) {
            const seq = app.state.sequences[app.state.activeSequenceIdx];
            info.textContent = `${seq.name} | ${seq.sequence.length} ${seq.type === 'protein' ? 'aa' : 'bp'} | ${seq.type.toUpperCase()}`;
        }
    }
    return { setStatus };
}

/**
 * Escape the characters that would otherwise open a tag or an entity.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Wire the light/dark toggle and apply the stored preference.
 *
 * @returns {void}
 */
export function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    // Resolve theme: localStorage -> URL query -> system preference -> default 'dark'
    let theme = localStorage.getItem('theme');
    if (!theme) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTheme = urlParams.get('theme');
        if (urlTheme === 'light' || urlTheme === 'dark') {
            theme = urlTheme;
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            theme = prefersDark ? 'dark' : 'light';
        }
    }

    // Set initial theme
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);

    // Toggle on click
    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.dataset.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    });
}
