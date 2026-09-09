import { expect, it } from 'vitest';
import { escapeHtml } from './ui.js';

it('escapes sequence names used in both text and quoted attributes', () => {
    expect(escapeHtml('a" onmouseover="x<>&\'')).toBe(
        'a&quot; onmouseover=&quot;x&lt;&gt;&amp;&#39;'
    );
});
