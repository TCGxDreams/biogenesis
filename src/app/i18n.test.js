import { describe, expect, it } from 'vitest';
import { translateLabel } from './i18n.js';
import { translations } from './translations.js';

describe('interface languages', () => {
    it('provides both languages for every label', () => {
        for (const [key, entry] of Object.entries(translations)) {
            expect(entry.en).toBe(key);
            expect(entry.vi.trim().length).toBeGreaterThan(0);
        }
    });
    it('switches interface labels while preserving unknown scientific identifiers', () => {
        expect(translateLabel('Sequence View', 'vi')).toBe('Xem trình tự');
        expect(translateLabel('Sequence View', 'en')).toBe('Sequence View');
        expect(translateLabel('EGFP_CDS', 'vi')).toBe('EGFP_CDS');
        expect(translateLabel('ATGCGT', 'vi')).toBe('ATGCGT');
    });
});
