// ============================================
// BioGenesis — Sequence view context menu
// ============================================
//
// A single floating menu shared by every view. Only one can be open at a time,
// so opening a new one closes the old, and the menu closes on any outside
// pointer press, on Escape and on scroll.

/** @type {HTMLElement|null} */
let openMenu = null;

/** @type {(() => void)|null} */
let teardown = null;

/**
 * One row of the menu.
 *
 * @typedef {Object} MenuItem
 * @property {string} [label] Omit for a separator.
 * @property {string} [accelerator] Shortcut hint shown right-aligned.
 * @property {boolean} [disabled]
 * @property {boolean} [separator]
 * @property {() => void} [onSelect]
 */

/**
 * Open a context menu at a viewport position.
 *
 * The menu is flipped back inside the window when it would overflow, so a
 * right-click near the bottom or right edge still shows every item.
 *
 * @param {Object} options
 * @param {number} options.x Client x.
 * @param {number} options.y Client y.
 * @param {MenuItem[]} options.items
 * @returns {void}
 */
export function openContextMenu({ x, y, items }) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'sv-menu';
    menu.setAttribute('role', 'menu');

    for (const item of items) {
        if (item.separator || !item.label) {
            const hr = document.createElement('div');
            hr.className = 'sv-menu-sep';
            menu.appendChild(hr);
            continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sv-menu-item';
        button.setAttribute('role', 'menuitem');
        button.disabled = !!item.disabled;

        const label = document.createElement('span');
        label.textContent = item.label;
        button.appendChild(label);

        if (item.accelerator) {
            const key = document.createElement('kbd');
            key.textContent = item.accelerator;
            button.appendChild(key);
        }

        button.addEventListener('click', () => {
            closeContextMenu();
            item.onSelect?.();
        });
        menu.appendChild(button);
    }

    // Measured off-screen first: the flip needs the real size, and reading it
    // while the menu is hidden avoids a visible jump.
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4));
    const top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = '';

    openMenu = menu;
    const previousFocus = document.activeElement;
    const enabledItems = Array.from(menu.querySelectorAll('button:not(:disabled)'));
    /** @type {HTMLButtonElement|undefined} */ (enabledItems[0])?.focus();

    /** @param {Event} e */
    const onOutside = e => {
        if (!menu.contains(/** @type {Node} */ (e.target))) closeContextMenu();
    };
    /** @param {KeyboardEvent} e */
    const onKey = e => {
        if (e.key === 'Escape') {
            e.preventDefault(); closeContextMenu();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && enabledItems.length) {
            e.preventDefault();
            const current = enabledItems.indexOf(/** @type {Element} */ (document.activeElement));
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? enabledItems.length - 1 : (current + (e.key === 'ArrowDown' ? 1 : -1) + enabledItems.length) % enabledItems.length;
            /** @type {HTMLButtonElement} */ (enabledItems[next]).focus();
        }
        if (e.key === 'Tab') closeContextMenu();
    };

    // Capture phase, so a handler that stops propagation cannot strand the menu.
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);

    teardown = () => {
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('blur', closeContextMenu);
        window.removeEventListener('resize', closeContextMenu);
    };
}

/**
 * Close the open menu, if any.
 *
 * @returns {void}
 */
export function closeContextMenu() {
    teardown?.();
    teardown = null;
    openMenu?.remove();
    openMenu = null;
}
