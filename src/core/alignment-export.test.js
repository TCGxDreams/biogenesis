import { describe, expect, it } from 'vitest';
import { alignmentToFasta, buildAlignmentReport } from './alignment-report.js';

describe('alignment FASTA export', () => {
    it.each(['nw', 'sw', 'msa'])('exports the displayed %s rows with real newlines', algorithm => {
        const report = buildAlignmentReport([
            { name: 'one', sequence: 'ATGCT' },
            { name: 'two', sequence: 'ATCT' },
        ], { algorithm, maxLength: 4 });
        const fasta = alignmentToFasta(report);
        expect(fasta.split('\n')).toEqual([
            '>one', report.rows[0].aligned, '>two', report.rows[1].aligned, '',
        ]);
        expect(fasta).not.toContain('\\n');
        expect(report.rows[0].aligned.replace(/-/g, '').length).toBeLessThanOrEqual(4);
    });
    it('keeps multiline names inside one FASTA header', () => {
        const report = buildAlignmentReport([
            { name: 'one\n>fake', sequence: 'ATG' }, { name: 'two', sequence: 'ATG' },
        ]);
        expect(alignmentToFasta(report)).toContain('>one >fake\nATG\n');
    });
});
