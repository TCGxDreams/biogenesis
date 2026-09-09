import { parseFasta, parseGenBank, detectSequenceType } from '../utils/bioUtils.js';

/** Parse supported sequence files without treating arbitrary documents as DNA.
 * @param {string} name
 * @param {string} text
 * @returns {import('../core/types.js').Sequence[]}
 */
export function parseSequenceImport(name, text) {
    const extension = name.split('.').at(-1)?.toLowerCase();
    if (!['fasta','fa','fna','faa','gb','gbk','genbank','txt','seq'].includes(extension || '')) {
        throw new Error('Unsupported import format. Export sequences from Geneious as FASTA or GenBank (flat file).');
    }
    const content = text.replace(/^\uFEFF/,'').trim();
    let records;
    if (['gb','gbk','genbank'].includes(extension || '') || /^LOCUS\s/m.test(content)) {
        records = parseGenBank(content);
    } else if (content.startsWith('>')) {
        records = parseFasta(content);
    } else if (['txt','seq'].includes(extension || '')) {
        const sequence = content.replace(/\s/g,'');
        records = [{name, sequence, description:'Imported plain sequence', type:detectSequenceType(sequence)}];
    } else {
        throw new Error('FASTA records must start with a > header.');
    }
    if (!records.length || records.some(record => !record.sequence || !/^[ACGTURYSWKMBDHVNEFILPQZOJX*.-]+$/i.test(record.sequence))) {
        throw new Error('No valid sequences found. Use FASTA or GenBank rather than a database, tree or binary file.');
    }
    return records.map(record => {
        if (record.type === 'unknown') throw new Error('Sequence type could not be determined.');
        return { ...record, type: record.type };
    });
}
