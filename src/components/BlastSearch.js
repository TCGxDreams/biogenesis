// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — BLAST Search Component
// ============================================

import { getNucleotideClass, getAminoAcidClass } from '../utils/bioUtils.js';

export function renderBlastSearch(seq) {
  const queryDefault = seq ? seq.sequence.substring(0, 1000) : '';
  const isProtein = seq?.type === 'protein';

  return `
    <div class="panel active">
      <div class="panel-header" style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2>BLAST Search</h2>
          <p>Search sequences against the NCBI database using Basic Local Alignment Search Tool</p>
        </div>
      </div>
      
      <div class="panel-controls" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1;min-width:180px;margin:0;">
            <label class="form-label">Program</label>
            <select class="form-select" id="blast-program">
              <option value="blastn" ${!isProtein ? 'selected' : ''}>blastn (Nucleotide → Nucleotide)</option>
              <option value="blastp" ${isProtein ? 'selected' : ''}>blastp (Protein → Protein)</option>
              <option value="blastx" ${!isProtein ? '' : ''}>blastx (Translated Nucleotide → Protein)</option>
              <option value="tblastn" ${isProtein ? '' : ''}>tblastn (Protein → Translated Nucleotide)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;min-width:180px;margin:0;">
            <label class="form-label">Database</label>
            <select class="form-select" id="blast-db">
              <optgroup label="Nucleotide">
                <option value="nt" ${!isProtein ? 'selected' : ''}>nt (Nucleotide collection)</option>
                <option value="refseq_rna">RefSeq RNA</option>
              </optgroup>
              <optgroup label="Protein">
                <option value="nr" ${isProtein ? 'selected' : ''}>nr (Non-redundant protein sequences)</option>
                <option value="swissprot">SwissProt</option>
                <option value="pdb">PDB (Protein Data Bank)</option>
              </optgroup>
            </select>
          </div>
        </div>
        
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="display:flex;justify-content:space-between;">
            Query Sequence (FASTA format not required)
            <span style="font-size:10px;color:var(--text-muted);font-weight:normal;">Max 2000 chars</span>
          </label>
          <textarea class="form-textarea" id="blast-query" rows="5" placeholder="Paste DNA, RNA, or Protein sequence here...&#10;>Sequence_Name&#10;ATGCGT..." style="font-family:var(--font-mono); font-size:12px;">${queryDefault}</textarea>
        </div>
        
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="btn btn-primary" id="run-blast-btn" style="padding:8px 24px;">▶ Run NCBI BLAST</button>
          <div style="font-size:11px;color:var(--text-muted);display:flex;flex-direction:column;gap:2px;">
            <span><strong style="color:var(--text-primary);">Warning:</strong> Uses public NCBI API.</span>
            <span>Queries may take 15–90 seconds depending on server load.</span>
          </div>
        </div>
      </div>
      
      <div class="panel-body" id="blast-result" style="padding-top:16px;">
        <div class="empty-state">
          <p class="empty-state-text">Enter a query sequence and click "Run NCBI BLAST" to search</p>
        </div>
      </div>
    </div>
  `;
}

// Execute a BLAST search via NCBI API
export async function runBlast(query, program = 'blastn', database = 'nt', onProgress = null) {
  const putUrl = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';

  const params = new URLSearchParams({
    CMD: 'Put',
    PROGRAM: program,
    DATABASE: database,
    QUERY: query.substring(0, 2000), // restrict length to prevent NCBI blocks
    FORMAT_TYPE: 'JSON2',
  });

  try {
    if (onProgress) onProgress('Submitting query to NCBI...', 0);

    const putResponse = await fetch(putUrl, {
      method: 'POST',
      body: params,
    });

    const putText = await putResponse.text();

    const ridMatch = putText.match(/RID = (\S+)/);
    if (!ridMatch) {
      throw new Error('Failed to submit BLAST query. Could not get Request ID (RID).');
    }

    const rid = ridMatch[1];

    // Polling loop
    let attempts = 0;
    const maxAttempts = 60; // 5 mins max

    if (onProgress) onProgress(`Search submitted successfully (RID: ${rid}). Waiting for NCBI...`, attempts / maxAttempts);

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      const checkUrl = `${putUrl}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`;
      const checkResponse = await fetch(checkUrl);
      const checkText = await checkResponse.text();

      if (checkText.includes('Status=READY')) {
        if (checkText.includes('ThereAreHits=yes')) {
          if (onProgress) onProgress('Search complete! Downloading hits...', 1.0);

          const resultUrl = `${putUrl}?CMD=Get&FORMAT_TYPE=JSON2_S&RID=${rid}`;
          const resultResponse = await fetch(resultUrl);
          const resultText = await resultResponse.text();

          try {
            const resultJson = JSON.parse(resultText);
            return formatBlastResults(resultJson, program);
          } catch {
            return formatBlastTextResults(resultText);
          }
        } else {
          return `<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-orange);">No significant matches found by NCBI</p></div>`;
        }
      } else if (checkText.includes('Status=FAILED')) {
        throw new Error('BLAST search failed on NCBI server');
      } else if (checkText.includes('Status=UNKNOWN')) {
        throw new Error('Request ID expired or parameters invalid');
      }

      const timeElapsed = attempts * 5;
      if (onProgress) onProgress(`NCBI servers are analyzing your query... (${timeElapsed}s elapsed)`, attempts / maxAttempts);
    }

    throw new Error('BLAST search timed out after 5 minutes.');

  } catch (error) {
    throw new Error(`Connection to NCBI failed: ${error.message}`);
  }
}

function formatBlastResults(json, program) {
  try {
    const results = json?.BlastOutput2?.[0]?.report?.results;
    if (!results?.search?.hits?.length) {
      return '<div class="empty-state"><p class="empty-state-text" style="color:var(--accent-orange);">No significant matches found</p></div>';
    }

    const hits = results.search.hits.slice(0, 15);
    const queryLen = results.search.query_len || 1;
    const isProteinHit = program === 'blastp' || program === 'blastx';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border-muted);">
        <h3 style="font-size:14px;margin:0;color:var(--text-primary);">Search Results <span style="font-weight:normal;color:var(--text-muted);font-size:12px;">(${results.search.hits.length} total hits)</span></h3>
        <span style="font-size:11px;color:var(--text-muted);">Showing top ${hits.length}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
    `;

    hits.forEach((hit, i) => {
      const desc = hit.description?.[0];
      const hsp = hit.hsps?.[0];
      if (!hsp) return;

      const identity = hsp.identity ? ((hsp.identity / hsp.align_len * 100).toFixed(1)) : 'N/A';
      const coverage = ((hsp.align_len) / queryLen * 100).toFixed(0);

      const qseq = hsp.qseq || '';
      const hseq = hsp.hseq || '';
      const midline = hsp.midline || '';

      let alignBlocks = '';
      if (qseq && hseq) {
        const blockSize = 60;
        for (let start = 0; start < qseq.length; start += blockSize) {
          const q = qseq.substring(start, start + blockSize);
          const h = hseq.substring(start, start + blockSize);
          const m = midline.substring(start, start + blockSize).replace(/\+/g, '+').replace(/\s/g, '&nbsp;');

          const qFrom = hsp.query_from + start;
          const qTo = Math.min(hsp.query_to, qFrom + q.replace(/-/g, '').length - 1);
          const hFrom = hsp.hit_from + start;
          const hTo = Math.min(hsp.hit_to, hFrom + h.replace(/-/g, '').length - 1);

          alignBlocks += `
                <div style="font-family:var(--font-mono);font-size:11px;line-height:1.4;margin-bottom:10px;display:flex;">
                    <div style="width:40px;color:var(--text-muted);text-align:right;padding-right:8px;display:flex;flex-direction:column;">
                        <span>${qFrom}</span><span></span><span>${hFrom}</span>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600;">${colorCodeBlast(q, isProteinHit, '')}</div>
                        <div style="color:var(--text-muted);">${m}</div>
                        <div style="font-weight:600;">${colorCodeBlast(h, isProteinHit, q)}</div>
                    </div>
                    <div style="width:40px;color:var(--text-muted);padding-left:8px;display:flex;flex-direction:column;">
                        <span>${qTo}</span><span></span><span>${hTo}</span>
                    </div>
                </div>
              `;
        }
      }

      html += `
        <details class="blast-hit-card" style="background:var(--bg-elevated);border:1px solid var(--border-muted);border-radius:var(--radius-md);overflow:hidden;">
            <summary style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;list-style:none;outline:none;">
                <div style="flex:1;min-width:0;padding-right:16px;">
                    <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;" title="${escapeHtml(desc?.title || '')}">
                        ${escapeHtml(desc?.title || 'Unknown sequence')}
                    </div>
                    <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted);">
                        <span><strong style="color:var(--text-secondary);">Acc:</strong> <a href="https://www.ncbi.nlm.nih.gov/nuccore/${desc?.accession}" target="_blank" style="color:var(--accent-blue);text-decoration:none;">${desc?.accession || 'N/A'}</a></span>
                        <span><strong style="color:var(--text-secondary);">Score:</strong> ${hsp.bit_score?.toFixed(0)}</span>
                    </div>
                </div>
                <div style="display:flex;gap:16px;align-items:center;">
                    <div style="display:flex;flex-direction:column;align-items:flex-end;">
                        <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">E-value</span>
                        <span style="font-weight:700;color:var(--accent-green);font-family:var(--font-mono);font-size:12px;">${hsp.evalue?.toExponential(1)}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;">
                        <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Identity</span>
                        <span style="font-weight:600;color:var(--text-primary);font-size:12px;">${identity}%</span>
                    </div>
                     <div style="display:flex;flex-direction:column;align-items:flex-end;">
                        <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Cover</span>
                        <span style="font-weight:600;color:var(--text-primary);font-size:12px;">${coverage}%</span>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </summary>
            <div style="padding:16px;border-top:1px solid var(--border-muted);background:var(--bg-tertiary);overflow-x:auto;">
                <h4 style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);margin:0 0 12px;letter-spacing:0.5px;">Sequence Alignment</h4>
                ${alignBlocks || '<div style="color:var(--text-muted);font-size:11px;">Alignment rendering not available for this hit.</div>'}
            </div>
        </details>
      `;
    });

    html += '</div>';

    // Auto-setup accordion icons
    html += `
    <style>
      details.blast-hit-card > summary::-webkit-details-marker { display:none; }
      details.blast-hit-card[open] > summary svg { transform: rotate(180deg); }
      details.blast-hit-card > summary svg { transition: transform 0.2s; }
      details.blast-hit-card > summary:hover { background:var(--bg-tertiary); }
    </style>
    `;
    return html;
  } catch (e) {
    return `<div class="empty-state"><span class="empty-state-icon">⚠️</span><p class="empty-state-text">Error parsing BLAST results: ${e.message}</p></div>`;
  }
}

// Clustal-like coloring with dotting identical characters against query
function colorCodeBlast(seq, isProtein, queryBlock) {
  let html = '';
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (c === '-') {
      html += `<span class="nt-gap" style="opacity:0.4;">-</span>`;
      continue;
    }

    // Dot identical chars against query if present
    const isMatch = queryBlock && queryBlock[i] && c.toUpperCase() === queryBlock[i].toUpperCase();
    const displayChar = isMatch ? '.' : c;

    const cls = isProtein ? getAminoAcidClass(c) : getNucleotideClass(c);
    const opacity = isMatch ? '0.6' : '1.0';
    const fontWeight = isMatch ? 'normal' : '700';

    html += `<span class="${cls}" style="opacity:${opacity};font-weight:${fontWeight};">${displayChar}</span>`;
  }
  return html;
}

function formatBlastTextResults(text) {
  return `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary);">
      Raw BLAST output received. Parsing not completely supported for this result type.
    </div>
    <div class="sequence-display" style="font-size:11px;max-height:400px;overflow:auto;background:var(--bg-elevated);border:1px solid var(--border-muted);padding:12px;border-radius:var(--radius-md);white-space:pre-wrap;font-family:var(--font-mono);">${escapeHtml(text.substring(0, 5000))}</div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
