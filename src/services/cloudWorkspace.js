export const CLOUD_WORKSPACE_LIMIT = 4 * 1024 * 1024;
/** Omit navigation state: opening tabs must not cause network writes.
 * @param {{sequences:object[],analysisDocuments?:object[]}} state
 */
export function cloudPayload(state) {
    const payload = {schemaVersion:1,sequences:state.sequences,analysisDocuments:state.analysisDocuments || []};
    const json = JSON.stringify(payload);
    if (new TextEncoder().encode(json).length > CLOUD_WORKSPACE_LIMIT) throw new Error('Workspace vượt 4 MiB. Hãy xuất bớt dữ liệu trước khi đồng bộ. / Workspace exceeds 4 MiB.');
    return {payload,json};
}
/** @param {unknown} value */
export function validateCloudPayload(value) {
    const data = /** @type {any} */(value);
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.sequences) || !Array.isArray(data.analysisDocuments)) throw new Error('Unsupported cloud workspace.');
    if (data.sequences.some((/** @type {any} */ s) => typeof s.name !== 'string' || typeof s.sequence !== 'string' || !['dna','rna','protein'].includes(s.type))) throw new Error('Invalid cloud sequences.');
    if (data.analysisDocuments.some((/** @type {any} */ d) => typeof d.id !== 'string' || typeof d.name !== 'string' || !['alignment','tree'].includes(d.kind) || !d.source || typeof d.source.originalText !== 'string')) throw new Error('Invalid cloud documents.');
    return data;
}
