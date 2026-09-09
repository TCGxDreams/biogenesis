/** Make an edited copy without carrying stale feature coordinates.
 * @param {import('../core/types.js').Sequence} source @param {string} text
 */
export function editedSequenceCopy(source, text) {
    const sequence = text.replace(/\s/g,'').toUpperCase();
    const alphabet = source.type === 'dna' ? /^[ACGTRYSWKMBDHVN]+$/ : source.type === 'rna' ? /^[ACGURYSWKMBDHVN]+$/ : /^[A-Z*]+$/;
    if (!sequence || sequence.length > 100000 || !alphabet.test(sequence)) throw new Error('Trình tự không hợp lệ hoặc dài hơn 100.000 ký tự. / Invalid sequence or more than 100,000 residues.');
    if (sequence === source.sequence.toUpperCase()) throw new Error('Chưa có thay đổi. / No sequence changes.');
    return {name:`${source.name} (edited)`,sequence,type:source.type,topology:source.topology,description:`Edited copy of ${source.name}; original annotations and structure IDs are not transferred.`,features:[],annotations:[]};
}
