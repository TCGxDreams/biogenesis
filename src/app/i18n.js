import { translations } from './translations.js';

let language = 'vi';
/** @param {string} key @param {string} [locale] */
export function translateLabel(key, locale = language) {
    const entry = /** @type {Record<string, Record<string, string>>} */ (translations)[key];
    return entry?.[locale] || key;
}

/** Translate only explicitly marked interface labels, never user documents. */
export function initLanguage() {
    try {
        const saved = localStorage.getItem('biogenesis-language');
        if (saved === 'en' || saved === 'vi') language = saved;
    } catch { /* Keep Vietnamese when browser storage is unavailable. */ }
    // Dialogs are siblings of #app, so include their marked labels too.
    const root = document.body;
    if (!root) return;
    const apply = () => {
        document.documentElement.lang = language;
        root.querySelectorAll('[data-en][data-vi]').forEach(element => {
            const value = element.getAttribute(`data-${language}`) || '';
            if (element.textContent !== value) element.textContent = value;
        });
        root.querySelectorAll('[data-i18n]').forEach(element => {
            const value = translateLabel(element.getAttribute('data-i18n') || '');
            if (element.textContent !== value) element.textContent = value;
        });
        for (const attribute of ['placeholder', 'aria-label', 'title']) {
            root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
                const value = translateLabel(element.getAttribute(`data-i18n-${attribute}`) || '');
                if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
            });
        }
        root.querySelectorAll('[data-language]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.getAttribute('data-language') === language));
        });
    };
    // Labels in dynamically rendered tools update without remounting canvases,
    // clearing input fields, losing selections, or recomputing analyses.
    const observer = new MutationObserver(() => {
        observer.disconnect();
        apply();
        observer.observe(root, { childList: true, subtree: true });
    });
    root.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => {
            language = button.getAttribute('data-language') === 'en' ? 'en' : 'vi';
            try { localStorage.setItem('biogenesis-language', language); } catch { /* Optional persistence. */ }
            observer.disconnect();
            apply();
            observer.observe(root, { childList: true, subtree: true });
        });
    });
    apply();
    observer.observe(root, { childList: true, subtree: true });
}
