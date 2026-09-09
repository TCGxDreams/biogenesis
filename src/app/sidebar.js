/** Switch sidebar panes without changing the active document or analysis.
 * @param {string} name
 */
export function showSidebarTab(name) {
    document.querySelectorAll('[data-sidebar-tab]').forEach(element => {
        const button = /** @type {HTMLButtonElement} */ (element);
        const active = button.dataset.sidebarTab === name;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(button.getAttribute('aria-controls') || '');
        if (panel) panel.hidden = !active;
    });
}

/** Wire compact navigation and search once when the app boots. */
export function initSidebar() {
    const tabs = Array.from(document.querySelectorAll('[data-sidebar-tab]'));
    tabs.forEach((element, index) => {
        const button = /** @type {HTMLButtonElement} */ (element);
        button.addEventListener('click', () => showSidebarTab(button.dataset.sidebarTab || 'documents'));
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            const next = /** @type {HTMLButtonElement} */ (tabs[nextIndex]);
            next.click();
            next.focus();
        });
    });
    const search = /** @type {HTMLInputElement|null} */ (document.getElementById('tool-search'));
    const groups = Array.from(document.querySelectorAll('.tool-group')).map(el => /** @type {HTMLDetailsElement} */ (el));
    let previousOpen = groups.map(group => group.open);
    let searching = false;
    search?.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        if (query && !searching) previousOpen = groups.map(group => group.open);
        let total = 0;
        groups.forEach((group, index) => {
            let matches = 0;
            const groupMatches = (group.querySelector('summary')?.textContent || '').toLowerCase().includes(query);
            group.querySelectorAll('.tool-btn').forEach(element => {
                const button = /** @type {HTMLButtonElement} */ (element);
                button.hidden = !!query && !groupMatches && !`${button.textContent} ${button.querySelector('[data-i18n]')?.getAttribute('data-i18n') || ''}`.toLowerCase().includes(query);
                if (!button.hidden) matches++;
            });
            group.hidden = matches === 0;
            group.open = query ? matches > 0 : previousOpen[index];
            total += matches;
        });
        searching = !!query;
        const empty = document.getElementById('tool-search-empty');
        if (empty) empty.hidden = total > 0;
    });
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('document-search'));
    const filterDocuments = () => {
        let count = 0;
        const query = input?.value.trim().toLowerCase() || '';
        document.querySelectorAll('.file-item').forEach(element => {
            const row = /** @type {HTMLElement} */ (element);
            row.hidden = !(row.querySelector('.file-name')?.textContent || '').toLowerCase().includes(query);
            if (!row.hidden) count++;
        });
        const empty = document.getElementById('document-search-empty');
        if (empty) empty.hidden = count > 0;
    };
    input?.addEventListener('input', filterDocuments);
    const tree = document.getElementById('file-tree');
    if (tree) new MutationObserver(filterDocuments).observe(tree, { childList: true });
}
