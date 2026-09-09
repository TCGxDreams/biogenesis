const MOBILE_QUERY = '(max-width: 760px)';
/** @type {(() => void)|null} */
let revealSidebar = null;
export function openResponsiveSidebar() { revealSidebar?.(); }

/** Keep drawer state, keyboard focus and accessibility in sync across resizing. */
export function initResponsiveLayout() {
    const layout = document.getElementById('main-layout');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content-area');
    const toggle = document.getElementById('sidebar-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const close = document.getElementById('sidebar-close');
    if (!layout || !sidebar || !content || !toggle || !backdrop || !close) return;
    const mobile = window.matchMedia(MOBILE_QUERY);
    let desktopHidden = layout.classList.contains('sidebar-hidden');
    let drawerOpen = false;
    function update() {
        const visible = mobile.matches ? drawerOpen : !desktopHidden;
        layout?.classList.toggle('drawer-open', mobile.matches && drawerOpen);
        layout?.classList.toggle('sidebar-hidden', !mobile.matches && desktopHidden);
        if (sidebar) sidebar.inert = !visible;
        if (content) content.inert = mobile.matches && drawerOpen;
        toggle?.setAttribute('aria-expanded', String(visible));
        if (backdrop) backdrop.hidden = !(mobile.matches && drawerOpen);
    }
    function hide(returnFocus = true) {
        drawerOpen = false; update();
        if (returnFocus) toggle?.focus();
    }
    revealSidebar = () => {
        if (mobile.matches) drawerOpen = true; else desktopHidden = false;
        update();
    };
    toggle.setAttribute('aria-controls','sidebar');
    toggle.addEventListener('click', () => {
        if (mobile.matches) drawerOpen = !drawerOpen; else desktopHidden = !desktopHidden;
        update();
        if (mobile.matches && drawerOpen) close.focus();
    });
    close.addEventListener('click', () => hide());
    backdrop.addEventListener('click', () => hide());
    sidebar.addEventListener('click', event => {
        const target = /** @type {Element} */ (event.target);
        if (mobile.matches && target.closest('.file-item,.tool-btn:not(:disabled),#workspace-home-btn,#learning-hub-btn,#database-search-btn,#ncbi-fetch-btn')) {
            hide(false);
            // A newly opened dialog owns its focus; otherwise return to the menu toggle.
            if (document.getElementById('modal-overlay')?.classList.contains('hidden')) toggle.focus();
        }
    });
    document.addEventListener('keydown', event => {
        if (!mobile.matches || !drawerOpen) return;
        if (event.key === 'Escape') { event.preventDefault(); hide(); }
        if (event.key !== 'Tab') return;
        const items = Array.from(sidebar.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]'))
            .filter(element => /** @type {HTMLElement} */ (element).getClientRects().length > 0);
        const first = /** @type {HTMLElement|undefined} */ (items[0]);
        const last = /** @type {HTMLElement|undefined} */ (items.at(-1));
        if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
            event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
            event.preventDefault(); first?.focus();
        }
    });
    mobile.addEventListener('change', () => {
        const focusWasInSidebar = sidebar.contains(document.activeElement);
        drawerOpen = false; update();
        if (mobile.matches && focusWasInSidebar) toggle.focus();
    });
    const commands = /** @type {HTMLDetailsElement|null} */ (document.getElementById('mobile-command-menu'));
    commands?.addEventListener('toggle', () => {
        if (!commands.open) return;
        commands.querySelectorAll('[data-command]').forEach(element => {
            const button = /** @type {HTMLButtonElement} */ (element);
            const original = /** @type {HTMLButtonElement|null} */ (document.getElementById(button.dataset.command || ''));
            button.disabled = !original || original.disabled;
        });
    });
    commands?.querySelectorAll('[data-command]').forEach(element => {
        const button = /** @type {HTMLButtonElement} */ (element);
        button.addEventListener('click', () => {
            if (commands) commands.open = false;
            document.getElementById(button.dataset.command || '')?.click();
        });
    });
    document.addEventListener('pointerdown', event => {
        if (commands?.open && !commands.contains(/** @type {Node} */ (event.target))) commands.open = false;
    });
    commands?.addEventListener('keydown', event => {
        if (event.key === 'Escape') { commands.open = false; commands.querySelector('summary')?.focus(); }
    });
    update();
}
