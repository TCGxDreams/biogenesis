const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
export const IMPORT_LIMIT = 100000;
/** @typedef {{id:string, accession:string, title:string, organism:string, length:number, source:string, url:string}} DatabaseRecord */
/** @param {string} url @param {AbortSignal} signal */
async function request(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'Rate limit reached. Wait a moment and retry.' : `Database returned HTTP ${response.status}. Please retry.`);
    return response;
}
/** @param {string} source @param {string} query @param {number} page @param {AbortSignal} signal
 * @returns {Promise<{records:DatabaseRecord[],total:number}>} */
export async function searchDatabase(source, query, page, signal) {
    if (!['nucleotide','protein','uniprot'].includes(source)) throw new Error('Unsupported database');
    if (!Number.isInteger(page) || page < 0) throw new Error('Invalid page');
    if (!query.trim()) throw new Error('Enter a keyword or accession');
    if (source === 'uniprot') {
        const params = new URLSearchParams({query,format:'json',size:'10'});
        const response = await request(`https://rest.uniprot.org/uniprotkb/search?${params}`,signal);
        const data = await response.json();
        if (!Array.isArray(data.results)) throw new Error('Invalid UniProt response. Please retry.');
        return {total:Number(response.headers.get('x-total-results') || data.results?.length || 0),records:(data.results || []).map((/** @type {any} */ r) => ({
            id:r.primaryAccession,accession:r.primaryAccession,title:r.proteinDescription?.recommendedName?.fullName?.value || r.uniProtkbId,
            organism:r.organism?.scientificName || '',length:r.sequence?.length || 0,source,
            url:`https://www.uniprot.org/uniprotkb/${encodeURIComponent(r.primaryAccession)}/entry`,
        }))};
    }
    const params = new URLSearchParams({db:source,term:query,retmode:'json',retmax:'10',retstart:String(page*10)});
    const search = await (await request(`${BASE}esearch.fcgi?${params}`,signal)).json();
    if (search.error || search.esearchresult?.ERROR) throw new Error('Database could not interpret this query.');
    if (!search.esearchresult || !Array.isArray(search.esearchresult.idlist)) throw new Error('Invalid search response. Please retry.');
    const ids = search.esearchresult.idlist;
    if (!ids.length) return {total:Number(search.esearchresult?.count || 0),records:[]};
    // Pace E-utilities requests to stay below its unauthenticated request rate.
    await new Promise(resolve => setTimeout(resolve, 400));
    signal.throwIfAborted();
    const summaries = await (await request(`${BASE}esummary.fcgi?${new URLSearchParams({db:source,id:ids.join(','),retmode:'json'})}`,signal)).json();
    if (!summaries.result) throw new Error('Could not read record summaries. Please retry.');
    return {total:Number(search.esearchresult.count),records:ids.map((/** @type {string} */ id) => {
        const r = summaries.result[id];
        if (!r || r.error) throw new Error('A record summary is unavailable. Please retry.');
        return {id,accession:r.accessionversion || r.caption || id,title:r.title || '',organism:r.organism || '',length:Number(r.slen || 0),source,url:`https://www.ncbi.nlm.nih.gov/${source === 'nucleotide' ? 'nuccore':'protein'}/${encodeURIComponent(id)}`};
    })};
}
/** @param {DatabaseRecord} record @param {AbortSignal} signal */
export async function fetchDatabaseRecord(record, signal) {
    if (!['nucleotide', 'protein', 'uniprot'].includes(record.source)) throw new Error('Unsupported database');
    if (record.length > IMPORT_LIMIT) throw new Error('This record exceeds the 100,000-residue classroom import limit. Choose a gene or protein record.');
    const url = record.source === 'uniprot' ? `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(record.id)}.fasta`
        : `${BASE}efetch.fcgi?${new URLSearchParams({db:record.source,id:record.id,rettype:'fasta',retmode:'text'})}`;
    const text = await (await request(url,signal)).text();
    if (!text.trimStart().startsWith('>') || text.trim().split(/^>/m).length !== 2) throw new Error('Expected a single FASTA record.');
    const sequence = text.trim().split(/\r?\n/).slice(1).join('').replace(/\s/g,'');
    if (!sequence || sequence.length > IMPORT_LIMIT || !/^[A-Za-z*]+$/.test(sequence)) throw new Error('Invalid sequence or record exceeds the classroom import limit.');
    return text.trim();
}
