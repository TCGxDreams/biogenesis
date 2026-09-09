import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDialogs } from './dialogs.js';

afterEach(() => vi.unstubAllGlobals());

describe('annotation dialog', () => {
    function setup(start, end) {
        const elements = {};
        for (const id of ['modal-overlay', 'modal-content', 'modal-cancel', 'modal-confirm',
            'ann-name', 'ann-type', 'ann-strand', 'ann-start', 'ann-end']) {
            elements[id] = { classList: { add: vi.fn(), remove: vi.fn() },
                addEventListener: vi.fn((event, fn) => { elements[id][event] = fn; }) };
        }
        vi.stubGlobal('document', { getElementById: id => elements[id] });
        const seq = { sequence: 'ATGCGT', features: [] };
        const app = { state: { sequences: [seq] }, setState: vi.fn(),
            setStatus: vi.fn(), renderToolPanel: vi.fn() };
        createDialogs(app).showAnnotationDialog(seq);
        elements['ann-start'].value = start;
        elements['ann-end'].value = end;
        elements['modal-confirm'].click();
        return { seq, app, elements };
    }

    it('stores zero-based coordinates and schedules persistence', () => {
        const { seq, app } = setup('1', '6');
        expect(seq.features[0]).toMatchObject({ start: 0, end: 6 });
        expect(app.setState).toHaveBeenCalledWith({ sequences: [seq] });
    });

    it.each([['0', '3'], ['4', '2'], ['1', '7'], ['1.5', '3'], ['', '3'], ['1', '']])(
        'rejects invalid coordinates %s..%s without closing the dialog', (start, end) => {
            const { seq, app, elements } = setup(start, end);
            expect(seq.features).toEqual([]);
            expect(app.setState).not.toHaveBeenCalled();
            expect(elements['modal-overlay'].classList.add).not.toHaveBeenCalled();
            expect(app.setStatus).toHaveBeenCalled();
        }
    );
});
