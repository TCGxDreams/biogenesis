// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — 3D Protein Structure Viewer
// Uses 3Dmol.js — supports RCSB PDB + AlphaFold DB
// ============================================

import { resolveStructureInput, PROTEIN_PRESETS, proteinNameQuery } from '../services/proteinWorkflow.js';
import { searchDatabase } from '../services/database.js';
import { escapeHtml } from '../app/ui.js';
import { downloadFile } from '../utils/bioUtils.js';
import { bindingSites, residueSelection } from '../services/proteinPrediction.js';
import * as $3Dmol from '3dmol';

/**
 * Largest PDB payload the prediction service accepts, mirroring MAX_PDB_BYTES
 * in backend/server.py. Kept here so an oversized structure is rejected before
 * it is uploaded.
 */
const MAX_PDB_BYTES = 5 * 1024 * 1024;

// Known PDB IDs for demo proteins
const KNOWN_PDBS = {
  '1EMA': 'GFP',
  '1AKI': 'Lysozyme',
  '4EY1': 'Insulin',
  '1HHO': 'Hemoglobin',
  '2XWR': 'p53 DBD',
  '6VXX': 'SARS-CoV-2 Spike',
  '6LU7': 'SARS-CoV-2 Mpro',
  '1BNA': 'B-DNA Dodecamer',
  '4HHB': 'Hemoglobin (deoxy)',
  '1CRN': 'Crambin',
  '1D66': 'Trans FactorDNA',
};

export function renderProteinViewer3D(seq) {
  const pdbId = seq?.pdbId || '';
  const isProtein = seq?.type === 'protein';
  const uniprotId = seq?.uniprotId || seq?.accession || '';

  return `
    <div class="panel-section protein-studio">
      <div class="panel-body protein-studio-body">

        <section class="protein-workflow" aria-label="Protein workflow">
          <div class="analysis-actions"><strong data-vi="Cấu trúc protein" data-en="Protein structure">Cấu trúc protein</strong><button class="btn btn-secondary" id="protein-basic" aria-pressed="true" data-vi="Cơ bản" data-en="Basic">Cơ bản</button><button class="btn btn-secondary" id="protein-advanced" aria-pressed="false" data-vi="Nâng cao" data-en="Advanced">Nâng cao</button></div>
          <ol class="protein-steps"><li data-step="load" data-vi="1. Chọn cấu trúc" data-en="1. Choose structure">1. Chọn cấu trúc</li><li data-step="predict" data-vi="2. Dự đoán" data-en="2. Predict">2. Dự đoán</li><li data-step="results" data-vi="3. Khám phá kết quả" data-en="3. Explore results">3. Khám phá kết quả</li></ol>
          <label for="protein-smart-id" data-vi="Tên protein hoặc mã — tự tìm nguồn" data-en="Protein name or ID — automatic source lookup">Tên protein hoặc mã — tự tìm nguồn</label>
          <div class="analysis-actions"><input id="protein-smart-id" class="form-input" placeholder="insulin / 1EMA / P04637" value="${escapeHtml(pdbId || uniprotId || (seq?.type === 'protein' ? proteinNameQuery(seq.name) : ''))}"><button id="protein-smart-load" class="btn btn-primary" data-vi="Tìm cấu trúc" data-en="Find structure">Tìm cấu trúc</button><button id="protein-demo" class="btn btn-secondary" data-vi="Thử mẫu GFP" data-en="Try GFP sample">Thử mẫu GFP</button></div>
          <div id="protein-name-results" aria-live="polite"></div>
          <details class="protein-import-options"><summary data-vi="Mở tệp PDB · Tự động hóa" data-en="Open PDB file · Automation">Mở tệp PDB · Tự động hóa</summary><div class="protein-import-content">
          <label class="protein-file-label" for="local-pdb-file"><span data-vi="Tệp cấu trúc PDB (tối đa 5 MB)" data-en="PDB structure file (up to 5 MB)">Tệp cấu trúc PDB (tối đa 5 MB)</span><input type="file" id="local-pdb-file" accept=".pdb"></label>
          <label><input type="checkbox" id="protein-auto-predict"> <span data-vi="Tự chạy dự đoán sau khi tải cấu trúc (gửi cấu trúc đến dịch vụ GGNN2025)" data-en="Run prediction after loading (sends the structure to the GGNN2025 service)">Tự chạy dự đoán sau khi tải cấu trúc (gửi cấu trúc đến dịch vụ GGNN2025)</span></label>
          </div></details>
          <p id="protein-workflow-status" role="status" aria-live="polite" data-vi="Nhập mã hoặc thử mẫu. Bạn cũng có thể mở tệp PDB bên dưới." data-en="Enter an ID or try the sample. You can also open a PDB file below.">Nhập mã hoặc thử mẫu. Bạn cũng có thể mở tệp PDB bên dưới.</p>
        </section>
        <div data-protein-advanced hidden>
        <!-- Source Tabs -->
        <div style="display:flex;gap:0;margin-bottom:16px;">
          <button id="src-pdb-tab" class="struct-src-tab active" style="flex:1;padding:8px 12px;background:rgba(6,182,212,0.1);border:1px solid var(--accent-cyan);border-radius:var(--radius-sm) 0 0 var(--radius-sm);color:var(--accent-cyan);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-sans);">
            RCSB PDB
          </button>
          <button id="src-af-tab" class="struct-src-tab" style="flex:1;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-left:none;border-radius:0 var(--radius-sm) var(--radius-sm) 0;color:var(--text-secondary);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-sans);">
            AlphaFold (UniProt)
          </button>
        </div>

        <!-- PDB input -->
        <div id="pdb-input-section">
          <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">PDB ID</label>
              <input id="pdb-id-input" type="text" value="${escapeHtml(pdbId)}" placeholder="e.g., 1EMA, 1AKI, 4EY1"
                style="width:100%;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;outline:none;text-transform:uppercase;" />
            </div>
            <button id="load-pdb-btn" class="btn btn-primary" style="padding:8px 20px;white-space:nowrap;">Load Structure</button>
          </div>
          <!-- Gallery -->
          <div style="margin-bottom:16px;">
            <label class="form-label" style="display:block;margin-bottom:8px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Gallery</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;" id="pdb-gallery">
              ${Object.entries(KNOWN_PDBS).map(([id, name]) => `
                <button class="pdb-gallery-btn" data-pdb="${escapeHtml(id)}"
                  style="padding:5px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;transition:all 0.15s;font-family:var(--font-sans);"
                  onmouseover="this.style.borderColor='var(--accent-cyan)';this.style.color='var(--accent-cyan)'"
                  onmouseout="this.style.borderColor='var(--border-muted)';this.style.color='var(--text-secondary)'"
                >${escapeHtml(id)} <span style="opacity:0.6;font-size:10px;">${name}</span></button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- AlphaFold input (hidden by default) -->
        <div id="af-input-section" style="display:none;">
          <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label class="form-label" style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">UniProt Accession</label>
              <input id="af-id-input" type="text" value="${escapeHtml(uniprotId)}" placeholder="e.g., P04637, P69905, P01308"
                style="width:100%;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;outline:none;text-transform:uppercase;" />
            </div>
            <button id="load-af-btn" class="btn btn-primary" style="padding:8px 20px;white-space:nowrap;">Load AlphaFold</button>
          </div>
          <div style="margin-bottom:16px;">
            <p style="color:var(--text-muted);font-size:11px;line-height:1.5;">
              AlphaFold DB provides AI-predicted structures for proteins by UniProt accession.
              <br/>Enter a UniProt ID (e.g. <strong>P04637</strong> for p53, <strong>P01308</strong> for Insulin).
              <br/>Fetched NCBI proteins will auto-fill the accession if detected.
            </p>
          </div>
        </div>

        </div>
        <div data-protein-advanced hidden>
        <!-- Style controls -->
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
          <div>
            <label class="form-label" style="display:block;margin-bottom:4px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Style</label>
            <select id="mol-style" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
              <option value="cartoon">Cartoon</option>
              <option value="stick">Stick</option>
              <option value="sphere">Space-Fill</option>
              <option value="line">Wireframe</option>
              <option value="cross">Ball & Cross</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="display:block;margin-bottom:4px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Color</label>
            <select id="mol-color" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
              <option value="spectrum">Rainbow Spectrum</option>
              <option value="chain">By Chain</option>
              <option value="ss">By Secondary Structure</option>
              <option value="residue">By Residue Type</option>
              <option value="element">By Element (CPK)</option>
              <option value="confidence">By Confidence (pLDDT)</option>
              <option value="cyan">Cyan</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <button id="mol-spin-btn" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;">Spin</button>
            <button id="mol-reset-btn" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;">Reset View</button>
            <button id="mol-surface-btn" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;">Surface</button>
          </div>
        </div>

        </div>
        <!-- Structure info panel -->
        <div id="structure-info" style="margin-top:16px;display:none;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;" id="structure-stats"></div>
        </div>

        <div class="protein-stage">
        <!-- 3D viewer container -->
        <div id="viewer-3d-container" style="width:100%;height:520px;background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-default);position:relative;overflow:hidden;">
          <div id="viewer-3d-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5" opacity="0.4">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <p style="color:var(--text-muted);font-size:13px;">Enter a PDB ID or UniProt accession</p>
            <p style="color:var(--text-muted);font-size:11px;opacity:0.6;">or select from the gallery above</p>
          </div>
          <div id="viewer-3d" style="width:100%;height:100%;"></div>
        </div>

        <!-- GGNN2025 AI Prediction -->
        <div id="ai-predict-section" style="margin-top:16px;display:none;">
          <div style="background:var(--bg-tertiary);border:1px solid rgba(139,92,246,0.3);border-radius:var(--radius-md);overflow:hidden;">
            <div style="padding:12px 16px;background:rgba(139,92,246,0.1);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <h3 style="margin:0;font-size:13px;color:var(--accent-purple);font-weight:600;display:flex;align-items:center;gap:6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                  <span data-vi="Dự đoán vùng liên kết" data-en="Binding-site prediction">Dự đoán vùng liên kết</span>
                </h3>
                <p style="margin:4px 0 0 0;font-size:11px;color:var(--text-muted);">GGNN2025</p>
              </div>
              <button id="btn-predict-ggnn" class="btn btn-primary" style="background:var(--accent-purple);border-color:var(--accent-purple);font-size:11px;padding:6px 12px;display:flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <span data-vi="Chạy dự đoán" data-en="Run prediction">Chạy dự đoán</span>
              </button>
            </div>

            <button id="cancel-prediction" class="btn btn-secondary" hidden data-vi="Hủy dự đoán" data-en="Cancel prediction">Hủy dự đoán</button>
            <div class="protein-presets"><label for="protein-preset" data-vi="Bộ lọc kết quả" data-en="Result filter">Bộ lọc kết quả</label><select id="protein-preset" class="form-select"><option value="explore" data-vi="Khám phá: ngưỡng 0.40, tối đa 25 residue" data-en="Explore: threshold 0.40, up to 25 residues">Khám phá: ngưỡng 0.40, tối đa 25 residue</option><option value="strict" data-vi="Lọc điểm cao: ngưỡng 0.70, tối đa 10" data-en="Higher scores: threshold 0.70, up to 10">Lọc điểm cao: ngưỡng 0.70, tối đa 10</option><option value="broad" data-vi="Xem rộng: ngưỡng 0.20, tối đa 100" data-en="Broader view: threshold 0.20, up to 100">Xem rộng: ngưỡng 0.20, tối đa 100</option><option value="custom" disabled data-vi="Tùy chỉnh ở chế độ nâng cao" data-en="Custom advanced settings">Tùy chỉnh ở chế độ nâng cao</option></select></div>
            <details class="protein-prediction-help"><summary data-vi="Cách đọc kết quả" data-en="How to read results">Cách đọc kết quả</summary>            <p style="padding:0 16px;color:var(--text-secondary)" data-vi="Chọn residue trong kết quả để xem trên cấu trúc. Điểm model không phải ái lực liên kết hoặc xác suất đã được hiệu chỉnh." data-en="Select a result residue to focus it in 3D. Model scores are not binding affinity or calibrated probabilities.">Chọn residue trong kết quả để xem trên cấu trúc. Điểm model không phải ái lực liên kết hoặc xác suất đã được hiệu chỉnh.</p>
<p data-vi="Đây là bộ lọc điểm model, không phải mức chính xác được bảo đảm. Đổi bộ lọc rồi bấm Dự đoán để áp dụng." data-en="These are model-score filters, not guaranteed accuracy levels. Change the filter and run prediction to apply.">Đây là bộ lọc điểm model, không phải mức chính xác được bảo đảm. Đổi bộ lọc rồi bấm Dự đoán để áp dụng.</p></details>
            <div data-protein-advanced hidden>
            <!-- Prediction Options -->
            <div style="padding:10px 16px;border-top:1px solid rgba(139,92,246,0.1);background:rgba(139,92,246,0.04);display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
              <!-- Threshold Slider -->
              <div style="display:flex;flex-direction:column;gap:4px;min-width:180px;flex:1;">
                <label style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Model score threshold: <span id="thresh-display" style="color:var(--accent-purple);font-weight:700;">0.40</span></label>
                <input type="range" id="binding-threshold" min="0.20" max="0.95" step="0.05" value="0.40"
                  style="width:100%;accent-color:var(--accent-purple);cursor:pointer;" />
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);">
                  <span>0.20 (very sensitive)</span>
                  <span>0.95 (strict)</span>
                </div>
              </div>
              <!-- Top-N Selector -->
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Show Top</label>
                <select id="binding-topn" style="padding:5px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
                  <option value="10">10 sites</option>
                  <option value="25" selected>25 sites</option>
                  <option value="50">50 sites</option>
                  <option value="100">100 sites</option>
                  <option value="0">All</option>
                </select>
              </div>
              <!-- Color Mode -->
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Color Mode</label>
                <select id="binding-colormode" style="padding:5px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
                  <option value="heatmap" selected>Heatmap (confidence)</option>
                  <option value="flat">Flat red</option>
                  <option value="pocket">Sequence groups (not 3D pockets)</option>
                </select>
              </div>
            </div>

            </div>
            <div id="ggnn-results" style="padding:12px 16px;font-size:12px;display:none;border-top:1px solid rgba(139,92,246,0.1);color:var(--text-secondary);">
              <!-- Results go here -->
            </div>
          </div>
        </div>

        </div>
      </div>
    </div>
  `;
}

let currentViewer = null;
let currentPdbData = null;
let structureVersion = 0;
let predictionController = null;
let currentFormat = 'pdb';
let structureMetadata = null;
let isSpinning = false;
let hasSurface = false;
let currentSource = 'pdb'; // 'pdb' or 'alphafold'

export function bindProteinViewerEvents(seq) {
  structureVersion++;
  predictionController?.abort();
  currentPdbData = null;
  const mountedVersion = structureVersion;
  const setMode = advanced => {
    document.querySelectorAll('[data-protein-advanced]').forEach(el => { el.hidden = !advanced; });
    document.getElementById('protein-basic')?.setAttribute('aria-pressed', String(!advanced));
    document.getElementById('protein-advanced')?.setAttribute('aria-pressed', String(advanced));
    try { localStorage.setItem('protein-ui-mode', advanced ? 'advanced' : 'basic'); } catch { /* Optional preference. */ }
  };
  document.getElementById('protein-basic')?.addEventListener('click', () => setMode(false));
  document.getElementById('protein-advanced')?.addEventListener('click', () => setMode(true));
  try { setMode(localStorage.getItem('protein-ui-mode') === 'advanced'); } catch { setMode(false); }
  let searchController = null;
  let searchVersion = 0;
  const smartInput = document.getElementById('protein-smart-id');
  const resultBox = document.getElementById('protein-name-results');
  smartInput.addEventListener('input', () => { searchController?.abort(); searchVersion++; resultBox.innerHTML = ''; });
  const startSmart = async () => {
    searchController?.abort();
    const request = ++searchVersion;
    const value = smartInput.value.trim();
    resultBox.innerHTML = '';
    if (!value) { workflowStatus('Nhập tên protein hoặc mã. / Enter a protein name or ID.', 'load'); return; }
    let resolved;
    try { resolved = resolveStructureInput(value); } catch { /* Name lookup follows. */ }
    if (resolved) {
      loadStructure(resolved.id, resolved.source, null, document.getElementById('protein-auto-predict').checked);
      return;
    }
    const controller = new AbortController();
    searchController = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    const version = structureVersion;
    workflowStatus('Đang tìm tên trên UniProt… / Searching UniProt by name…', 'load');
    try {
      const query = proteinNameQuery(value);
      const result = await searchDatabase('uniprot', query, 0, controller.signal);
      if (request !== searchVersion || version !== structureVersion || !resultBox.isConnected) return;
      workflowStatus(`UniProt: ${query} · ${result.total} kết quả / results. Chọn đúng protein và loài. / Choose the matching protein and organism.`, 'load');
      if (!result.records.length) { resultBox.textContent = 'Không tìm thấy. Thử tên tiếng Anh hoặc mã UniProt. / No matches. Try an English name or UniProt ID.'; return; }
      resultBox.innerHTML = `<p data-vi="Hiển thị tối đa 10 kết quả. Cấu trúc tìm theo tên chưa được đối chiếu với trình tự đang mở." data-en="Showing up to 10 matches. Name matches have not been verified against the open sequence.">Hiển thị tối đa 10 kết quả. Cấu trúc tìm theo tên chưa được đối chiếu với trình tự đang mở.</p>` + result.records.map((record,index) => `<button type="button" class="protein-name-result" data-protein-match="${index}"><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.accession)} · ${escapeHtml(record.organism)} · ${record.length} aa</span><small data-vi="Mở cấu trúc AlphaFold →" data-en="Open AlphaFold structure →">Mở cấu trúc AlphaFold →</small></button>`).join('');
      resultBox.querySelectorAll('[data-protein-match]').forEach(button => button.addEventListener('click', () => {
        const record = result.records[Number(button.dataset.proteinMatch)];
        smartInput.value = record.accession;
        resultBox.innerHTML = '';
        loadStructure(record.accession, 'alphafold', null, document.getElementById('protein-auto-predict').checked);
      }));
    } catch (error) {
      if (request === searchVersion && version === structureVersion && resultBox.isConnected) workflowStatus(error.name === 'AbortError' ? 'Tìm kiếm đã hủy hoặc quá 20 giây. / Search cancelled or timed out.' : error.message, 'load');
    } finally { clearTimeout(timer); }
  };
  document.getElementById('protein-smart-load')?.addEventListener('click', startSmart);
  document.getElementById('protein-smart-id')?.addEventListener('keydown', event => { if (event.key === 'Enter') startSmart(); });
  document.getElementById('protein-demo')?.addEventListener('click', () => { document.getElementById('protein-smart-id').value = '1EMA'; startSmart(); });
  document.getElementById('cancel-prediction')?.addEventListener('click', () => predictionController?.abort());
  document.getElementById('local-pdb-file')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PDB_BYTES) { workflowStatus('Tệp PDB tối đa 5 MB. / PDB file must be at most 5 MB.', 'load'); event.target.value = ''; return; }
    const version = structureVersion;
    const text = await file.text();
    if (version !== structureVersion) return;
    loadStructure(file.name, 'local', text, document.getElementById('protein-auto-predict').checked);
  });
  const loadBtn = document.getElementById('load-pdb-btn');
  const loadAfBtn = document.getElementById('load-af-btn');
  const input = document.getElementById('pdb-id-input');
  const afInput = document.getElementById('af-id-input');
  const styleSelect = document.getElementById('mol-style');
  const colorSelect = document.getElementById('mol-color');
  const spinBtn = document.getElementById('mol-spin-btn');
  const resetBtn = document.getElementById('mol-reset-btn');
  const surfaceBtn = document.getElementById('mol-surface-btn');
  const pdbTab = document.getElementById('src-pdb-tab');
  const afTab = document.getElementById('src-af-tab');
  const pdbSection = document.getElementById('pdb-input-section');
  const afSection = document.getElementById('af-input-section');

  // Source tabs
  pdbTab?.addEventListener('click', () => {
    currentSource = 'pdb';
    pdbTab.style.background = 'rgba(6,182,212,0.1)';
    pdbTab.style.borderColor = 'var(--accent-cyan)';
    pdbTab.style.color = 'var(--accent-cyan)';
    afTab.style.background = 'var(--bg-tertiary)';
    afTab.style.borderColor = 'var(--border-default)';
    afTab.style.color = 'var(--text-secondary)';
    if (pdbSection) pdbSection.style.display = '';
    if (afSection) afSection.style.display = 'none';
  });

  afTab?.addEventListener('click', () => {
    currentSource = 'alphafold';
    afTab.style.background = 'rgba(6,182,212,0.1)';
    afTab.style.borderColor = 'var(--accent-cyan)';
    afTab.style.color = 'var(--accent-cyan)';
    pdbTab.style.background = 'var(--bg-tertiary)';
    pdbTab.style.borderColor = 'var(--border-default)';
    pdbTab.style.color = 'var(--text-secondary)';
    if (pdbSection) pdbSection.style.display = 'none';
    if (afSection) afSection.style.display = '';
  });

  // GGNN2025 AI Prediction Binding
  const predictBtn = document.getElementById('btn-predict-ggnn');
  const ggnnResults = document.getElementById('ggnn-results');
  const threshSlider = document.getElementById('binding-threshold');
  const threshDisplay = document.getElementById('thresh-display');
  const topNSelect = document.getElementById('binding-topn');
  const colorModeSelect = document.getElementById('binding-colormode');

  document.getElementById('protein-preset')?.addEventListener('change', event => {
    const preset = PROTEIN_PRESETS[event.target.value];
    if (!preset) return;
    threshSlider.value = String(preset.threshold);
    threshDisplay.textContent = preset.threshold.toFixed(2);
    topNSelect.value = String(preset.topN);
  });
  [threshSlider, topNSelect].forEach(control => control?.addEventListener('input', () => { document.getElementById('protein-preset').value = 'custom'; }));
  // Live threshold display
  threshSlider?.addEventListener('input', () => {
    if (threshDisplay) threshDisplay.textContent = parseFloat(threshSlider.value).toFixed(2);
  });

  predictBtn?.addEventListener('click', async () => {
    if (!currentViewer || !currentPdbData) return;
    if (currentFormat !== 'pdb') { ggnnResults.style.display = 'block'; ggnnResults.textContent = 'Prediction requires PDB format; this structure is mmCIF.'; return; }
    const version = structureVersion;
    const requestViewer = currentViewer;
    const predictionSource = structuredClone(structureMetadata);
    predictionController?.abort();
    const controller = new AbortController();
    predictionController = controller;
    const timer = setTimeout(() => controller.abort(), 120000);
    const cancelBtn = document.getElementById('cancel-prediction');
    if (cancelBtn) cancelBtn.hidden = false;

    const threshold = parseFloat(threshSlider?.value || '0.40');
    const topN = parseInt(topNSelect?.value || '25');
    const colorMode = colorModeSelect?.value || 'heatmap';

    workflowStatus('Đang dự đoán… / Running prediction…', 'predict');
    predictBtn.disabled = true;
    predictBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span data-vi="Đang dự đoán…" data-en="Predicting…">Đang dự đoán…</span>';
    ggnnResults.style.display = 'block';
    ggnnResults.innerHTML = `<span style="color:var(--text-muted);display:flex;align-items:center;gap:6px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Running GGNN2025 — threshold: ${threshold.toFixed(2)}, top-${topN === 0 ? 'all' : topN}...
    </span>`;

    try {
      // Mirror the backend's MAX_PDB_BYTES. Without this the server rejects on
      // Content-Length and closes the connection mid-upload, which surfaces in
      // the browser as an opaque "Failed to fetch".
      const payloadBytes = new Blob([currentPdbData]).size;
      if (payloadBytes > MAX_PDB_BYTES) {
        throw new Error(
          `This structure is ${(payloadBytes / 1024 / 1024).toFixed(1)} MB, above the ` +
          `${(MAX_PDB_BYTES / 1024 / 1024).toFixed(0)} MB limit of the prediction service.`
        );
      }

      const formData = new FormData();
      formData.append('pdb_data', currentPdbData);
      formData.append('threshold', threshold.toString());
      formData.append('top_n', topN.toString());

      const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${BACKEND}/predict`, {
        method: 'POST',
        body: formData, signal:controller.signal
      });

      if (!res.ok) {
        throw new Error(await describePredictFailure(res));
      }

      const data = await res.json();
      if (version !== structureVersion || requestViewer !== currentViewer || !ggnnResults.isConnected) return;
      data.binding_sites = bindingSites(data.binding_sites);
      workflowStatus('Đã có kết quả. Bấm một residue để xem vị trí 3D; dùng Export để lưu. / Results ready: select a residue to focus it in 3D, or export.', 'results');
      if (!Number.isInteger(data.total_residues) || data.total_residues < 0) throw new Error('Invalid residue count from prediction service.');

      if (data.binding_sites && data.binding_sites.length > 0) {
        let sites = data.binding_sites;
        // Client-side filter by threshold (in case backend ignores the param)
        sites = sites.filter(s => (s.probability ?? s.score ?? 1.0) >= threshold);
        // Limit top-N
        if (topN > 0) sites = sites.slice(0, topN);

        const total = sites.length;

        // Residue tags — colored by confidence
        const residueListHtml = sites.map(site => {
          const prob = site.probability ?? site.score ?? 1.0;
          const pct = Math.max(0, Math.min(1, (prob - threshold) / (1 - threshold)));
          const tagColor = confidenceColor(pct);
          return `<button type="button" data-residue-index="${sites.indexOf(site)}" title="Model score: ${(prob * 100).toFixed(1)}%" style="display:inline-flex;align-items:center;background:${tagColor}22;color:var(--text-primary);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11px;border:1px solid ${tagColor}55;">${escapeHtml(site.chain || "∅")}:${escapeHtml(site.resn)} ${site.resi} <span style="opacity:0.7;margin-left:4px;font-size:10px;">${(prob * 100).toFixed(0)}%</span></button>`;
        }).join('');

        ggnnResults.innerHTML = `
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="color:#10b981;font-weight:500;">✓ ${total} binding residues</span>
            <span style="color:var(--text-muted);font-size:11px;">of ${data.total_residues} total — threshold: ${threshold.toFixed(2)}</span>
            <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);">
              <span style="width:10px;height:10px;border-radius:2px;background:#fbbf24;display:inline-block;"></span>low
              <span style="width:10px;height:10px;border-radius:2px;background:#f97316;display:inline-block;margin-left:4px;"></span>med
              <span style="width:10px;height:10px;border-radius:2px;background:#ef4444;display:inline-block;margin-left:4px;"></span>high
            </div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">Predicted Residues:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;padding-right:4px;">${residueListHtml}</div>
        `;

        // Visualize on 3D viewer
        highlightBindingSites(sites, colorMode, threshold);
        ggnnResults.querySelectorAll('[data-residue-index]').forEach(button => button.addEventListener('click', () => {
          const site = sites[Number(button.dataset.residueIndex)];
          currentViewer.zoomTo(residueSelection(site));
          currentViewer.render();
        }));
        const exportButton = document.createElement('button');
        exportButton.className = 'btn btn-secondary';
        exportButton.textContent = 'Export prediction JSON';
        exportButton.onclick = () => downloadFile(JSON.stringify({model:'GGNN2025',structure:predictionSource,threshold,topN,createdAt:new Date().toISOString(),...data,binding_sites:sites},null,2),'ggnn2025-prediction.json');
        ggnnResults.append(exportButton);

      } else {
        const tip = threshold > 0.6
          ? `<br/><span style="color:var(--accent-purple);font-size:11px;">→ Try lowering threshold to ${(threshold - 0.15).toFixed(2)} to find more sites</span>`
          : '';
        ggnnResults.innerHTML = `No binding sites found at threshold ${threshold.toFixed(2)}.${tip}`;
      }

    } catch (err) {
      // A TypeError from fetch means the request never got a response; anything
      // else is the backend telling us what went wrong, so the "is it running?"
      // hint would only be misleading.
      if (version !== structureVersion || !ggnnResults.isConnected) return;
      const unreachable = err instanceof TypeError;
      const hint = unreachable
        ? '<br/><br/><i>Make sure the backend is running: <code>python backend/server.py</code></i>'
        : '';
      const message = err.name === 'AbortError' ? 'Prediction cancelled or timed out (120 seconds).' : unreachable ? 'Could not reach the prediction service.' : err.message;
      workflowStatus(message, 'predict');
      ggnnResults.innerHTML = `<span style="color:#ef4444;"><b>Error:</b> ${escapeHtml(message)}${hint}</span>`;
    } finally {
      clearTimeout(timer);
      if (cancelBtn) cancelBtn.hidden = true;
      predictBtn.disabled = false;
      predictBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span data-vi="Chạy dự đoán" data-en="Run prediction">Chạy dự đoán</span>';
    }
  });

  // Gallery buttons
  document.querySelectorAll('.pdb-gallery-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (input) input.value = btn.dataset.pdb;
      // Switch to PDB tab
      pdbTab?.click();
      loadStructure(btn.dataset.pdb, 'pdb');
    });
  });

  // Load PDB button
  loadBtn?.addEventListener('click', () => {
    const pdbId = input?.value?.trim();
    if (pdbId) loadStructure(pdbId, 'pdb');
  });

  // Load AlphaFold button
  loadAfBtn?.addEventListener('click', () => {
    const afId = afInput?.value?.trim();
    if (afId) loadStructure(afId, 'alphafold');
  });

  // Enter key in inputs
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (v) loadStructure(v, 'pdb');
    }
  });
  afInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = afInput.value.trim();
      if (v) loadStructure(v, 'alphafold');
    }
  });

  // Style change
  styleSelect?.addEventListener('change', () => {
    if (currentViewer) applyStyle(currentViewer, styleSelect.value, colorSelect?.value || 'spectrum');
  });

  // Color change
  colorSelect?.addEventListener('change', () => {
    if (currentViewer) applyStyle(currentViewer, styleSelect?.value || 'cartoon', colorSelect.value);
  });

  // Spin toggle
  spinBtn?.addEventListener('click', () => {
    if (currentViewer) {
      isSpinning = !isSpinning;
      currentViewer.spin(isSpinning ? 'y' : false);
      spinBtn.style.borderColor = isSpinning ? 'var(--accent-cyan)' : 'var(--border-muted)';
      spinBtn.style.color = isSpinning ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    }
  });

  // Reset view
  resetBtn?.addEventListener('click', () => {
    if (currentViewer) { currentViewer.zoomTo(); currentViewer.render(); }
  });

  // Surface toggle
  surfaceBtn?.addEventListener('click', () => {
    if (currentViewer) {
      hasSurface = !hasSurface;
      if (hasSurface) {
        currentViewer.addSurface($3Dmol.SurfaceType.VDW, {
          opacity: 0.65,
          color: 'white',
          colorscheme: { prop: 'b', gradient: 'rwb' },
          smooth: true
        });
      } else {
        currentViewer.removeAllSurfaces();
      }
      currentViewer.render();
      surfaceBtn.style.borderColor = hasSurface ? 'var(--accent-cyan)' : 'var(--border-muted)';
      surfaceBtn.style.color = hasSurface ? 'var(--accent-cyan)' : 'var(--text-secondary)';
    }
  });

  // Auto-load: PDB ID takes priority, then try AlphaFold with accession/uniprotId
  const uniprotRegex = /^[A-NR-Z][0-9][A-Z0-9]{3}[0-9]|^[O,P,Q][0-9][A-Z0-9]{3}[0-9]/i;

  if (seq?.pdbId) {
    setTimeout(() => { if (mountedVersion === structureVersion) loadStructure(seq.pdbId, 'pdb'); }, 100);
  } else if (seq?.type === 'protein' && (seq?.uniprotId || (seq?.accession && uniprotRegex.test(seq.accession)))) {
    const afId = seq.uniprotId || seq.accession;
    if (afInput) afInput.value = afId;
    afTab?.click();
    setTimeout(() => { if (mountedVersion === structureVersion) loadStructure(afId, 'alphafold'); }, 100);
  } else if (seq?.type === 'protein' && !seq?.accession && !seq?.uniprotId) {
    setTimeout(() => { if (mountedVersion === structureVersion) startSmart(); }, 100);
  } else if (seq?.type === 'protein' && seq?.accession) {
    // If it's an NCBI RefSeq accession, it won't work in Alphafold
    if (afInput) afInput.value = ''; // Don't pre-fill with invalid ID
    afTab?.click();
    const loadingEl = document.getElementById('viewer-3d-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5" opacity="0.4">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:8px;"><span data-i18n="Sequence">Sequence</span> <b>${escapeHtml(seq.accession)}</b> is not a UniProt ID.</p>
          <p style="color:var(--text-muted);font-size:11px;text-align:center;max-width:320px;margin-top:4px;">
            AlphaFold DB requires a <b>UniProt Accession</b> (e.g., P04637). Please find the equivalent UniProt ID and enter it above to load the AI prediction.
          </p>
        `;
      loadingEl.style.display = 'flex';
    }
  }
}

async function loadStructure(id, source, localText = null, autoPredict = false) {
  workflowStatus('Đang tải cấu trúc… / Loading structure…', 'load');
  const version = ++structureVersion;
  predictionController?.abort();
  currentPdbData = null;
  id = id.toUpperCase().trim();
  const container = document.getElementById('viewer-3d');
  const loadingEl = document.getElementById('viewer-3d-loading');

  if (!container) return;

  const sourceLabel = source === 'local' ? 'Local PDB' : source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB';
  if (loadingEl) {
    loadingEl.innerHTML = `
      <div class="spinner"></div>
      <p style="color:var(--text-secondary);font-size:13px;">Loading ${escapeHtml(id)} from ${sourceLabel}...</p>
      <p style="color:var(--text-muted);font-size:11px;opacity:0.6;">This may take a few seconds...</p>
    `;
    loadingEl.style.display = 'flex';
  }

  try {
    let pdbData = null;
    let format = 'pdb';

    if (source === 'local') {
      pdbData = localText;
    } else if (source === 'alphafold') {
      const isUniProt = /^[A-NR-Z][0-9][A-Z0-9]{3}[0-9]|^[O,P,Q][0-9][A-Z0-9]{3}[0-9]/i.test(id);
      if (!isUniProt) {
        throw new Error(`AlphaFold DB requires a UniProt Accession. "${escapeHtml(id)}" does not look like a valid UniProt ID.`);
      }

      try {
        // Step 1: Query AlphaFold API to get the correct URL (handles v4, v5, v6 etc.)
        const apiResp = await fetchWithTimeout(`https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(id)}`, 10000);
        const apiData = JSON.parse(apiResp);
        if (apiData && apiData.length > 0) {
          const modelUrl = apiData[0].pdbUrl || apiData[0].cifUrl;
          if (modelUrl) {
            pdbData = await fetchWithTimeout(modelUrl, 15000);
            if (modelUrl.endsWith('.cif')) format = 'mmcif';
          }
        }
      } catch (e) {
        console.warn('AlphaFold API query failed, falling back to direct URLs', e);
      }

      // Step 2: Fallback if API fails or parsing fails
      if (!pdbData) {
        // Try AlphaFold v6, then v5, then v4 PDB, etc...
        const urls = [
          `https://alphafold.ebi.ac.uk/files/AF-${encodeURIComponent(id)}-F1-model_v4.pdb`,
          `https://alphafold.ebi.ac.uk/files/AF-${encodeURIComponent(id)}-F1-model_v6.pdb`,
          `https://alphafold.ebi.ac.uk/files/AF-${encodeURIComponent(id)}-F1-model_v6.cif`,
          `https://alphafold.ebi.ac.uk/files/AF-${encodeURIComponent(id)}-F1-model_v4.cif`,
        ];
        for (const url of urls) {
          try {
            pdbData = await fetchWithTimeout(url, 15000);
            if (url.endsWith('.cif')) format = 'mmcif';
            break;
          } catch (e) {
            continue;
          }
        }
      }
      if (!pdbData) {
        throw new Error(`Could not fetch AlphaFold structure for ${escapeHtml(id)}. Check the UniProt accession or your network.`);
      }
    } else {
      // RCSB PDB — try PDB, then CIF
      try {
        pdbData = await fetchWithTimeout(`https://files.rcsb.org/download/${encodeURIComponent(id)}.pdb`, 15000);
      } catch (e) {
        try {
          pdbData = await fetchWithTimeout(`https://files.rcsb.org/download/${encodeURIComponent(id)}.cif`, 15000);
          format = 'mmcif';
        } catch (e2) {
          throw new Error(`Could not load ${escapeHtml(id)} from RCSB PDB. Check your connection.`);
        }
      }
    }

    // Validate
    if (!pdbData || (!pdbData.includes('ATOM') && !pdbData.includes('_atom_site'))) {
      throw new Error('Invalid structure data received');
    }

    if (version !== structureVersion || !container.isConnected) return;
    container.innerHTML = '';
    isSpinning = false;
    hasSurface = false;

    currentViewer = $3Dmol.createViewer(container, {
      backgroundColor: document.documentElement.dataset.theme === 'dark' ? '0x101b2e' : '0xffffff',
      antialias: true,
      quality: 'high',
      light: { directional: true, color: 0xffffff, intensity: 1.2 }
    });

    currentViewer.addModel(pdbData, format);
    structureMetadata = {id,source,format};
    currentFormat = format;
    currentPdbData = pdbData; // Save current data for AI prediction

    const styleSelect = document.getElementById('mol-style');
    const colorSelect = document.getElementById('mol-color');
    applyStyle(currentViewer, styleSelect?.value || 'cartoon', colorSelect?.value || 'spectrum');

    currentViewer.zoomTo();
    currentViewer.render();

    if (loadingEl) loadingEl.style.display = 'none';

    // Show AI prediction section
    const aiSection = document.getElementById('ai-predict-section');
    if (aiSection) aiSection.style.display = 'block';
    currentViewer.resize();
    currentViewer.render();
    const ggnnResults = document.getElementById('ggnn-results');
    if (ggnnResults) {
      ggnnResults.style.display = 'none';
      ggnnResults.innerHTML = '';
    }

    showStructureInfo(id, pdbData, source);
    workflowStatus(format === 'pdb' ? 'Cấu trúc đã sẵn sàng. Bấm Dự đoán để tiếp tục. / Structure ready. Run prediction to continue.' : 'Đã mở mmCIF. Để dự đoán, hãy mở bản PDB. / mmCIF loaded. Open a PDB structure to predict.', 'predict');
    if (autoPredict && format === 'pdb') document.getElementById('btn-predict-ggnn')?.click();

  } catch (error) {
    if (version === structureVersion) workflowStatus(`Không tải được cấu trúc / Could not load structure: ${error.message}`, 'load');
    const suggestion = source === 'pdb' && /^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i.test(id)
      ? '<br><span style="color:var(--accent-cyan);font-size:11px;">This looks like a UniProt ID — try the AlphaFold tab instead.</span>'
      : '';

    if (version !== structureVersion || !container.isConnected) return;
    if (loadingEl) {
      loadingEl.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" opacity="0.6">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p style="color:#ef4444;font-size:13px;">Failed to load: ${escapeHtml(id)}</p>
        <p style="color:var(--text-muted);font-size:11px;text-align:center;max-width:400px;">${escapeHtml(error.message)}${suggestion}</p>
      `;
      loadingEl.style.display = 'flex';
    }
  }
}

// Fetch with timeout
async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    if (!text || text.length < 50) throw new Error('Empty response');
    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out (15s)');
    throw err;
  }
}

// ====== BINDING SITE VISUALIZATION ======

// Map [0,1] confidence level to RRGGBB color (yellow → orange → red)
/**
 * Turn a failed /predict response into a message worth showing.
 *
 * The backend signals failure with an HTTP status and a JSON `detail` (see
 * backend/server.py), so the status decides the wording and `detail` supplies
 * the specifics.
 *
 * @param {Response} res
 * @returns {Promise<string>}
 */
async function describePredictFailure(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.detail ?? body?.error ?? '';
    if (Array.isArray(detail)) {
      // FastAPI validation errors arrive as a list of {loc, msg}.
      detail = detail.map(d => d.msg || JSON.stringify(d)).join('; ');
    }
  } catch {
    detail = await res.text().catch(() => '');
  }

  switch (res.status) {
    case 400:
      return detail || 'The structure could not be parsed. Check that it is a protein PDB.';
    case 413:
      return detail || 'This structure is too large for the prediction service.';
    case 422:
      return detail || 'The prediction settings are out of range.';
    case 429:
      return detail || 'Too many prediction requests. Wait a moment and try again.';
    case 500:
      return detail || 'The prediction service failed while running the model.';
    case 502:
    case 503:
    case 504:
      return 'The prediction service is unavailable. It may be starting up — try again shortly.';
    default:
      return detail || `Prediction failed (HTTP ${res.status}).`;
  }
}

function confidenceColor(pct) {
  // pct: 0 = low confidence (at threshold), 1 = highest confidence
  if (pct < 0.5) {
    // yellow (#fbbf24) → orange (#f97316)
    const t = pct * 2;
    const r = Math.round(251 + (249 - 251) * t).toString(16).padStart(2, '0');
    const g = Math.round(191 + (115 - 191) * t).toString(16).padStart(2, '0');
    const b = Math.round(36 + (22 - 36) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  } else {
    // orange (#f97316) → red (#ef4444)
    const t = (pct - 0.5) * 2;
    const r = Math.round(249 + (239 - 249) * t).toString(16).padStart(2, '0');
    const g = Math.round(115 + (68 - 115) * t).toString(16).padStart(2, '0');
    const b = Math.round(22 + (68 - 22) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
}

// Highlight binding sites on 3D viewer with chosen color mode
function highlightBindingSites(sites, colorMode, threshold) {
  if (!currentViewer || !sites || sites.length === 0) return;

  // Base style: white semi-transparent cartoon
  currentViewer.setStyle({}, { cartoon: { color: '#7895bd', opacity: 0.82, arrows: true, thickness: 0.3 } });

  // Build a list of resi numbers per chain
  // 3Dmol chain selector: if chain is space/empty treat as wildcard
  const sitesByChain = {};
  sites.forEach(site => {
    const ch = (site.chain || '').trim();
    if (!sitesByChain[ch]) sitesByChain[ch] = [];
    sitesByChain[ch].push({ resi: parseInt(site.resi), prob: site.probability ?? site.score ?? 1.0 });
  });

  if (colorMode === 'flat') {
    // Batch select all resi in one shot per chain — much faster
    Object.entries(sitesByChain).forEach(([ch, residues]) => {
      const resiList = residues.map(r => r.resi);
      const sel = { chain: ch, resi: resiList };
      currentViewer.setStyle(sel, {
        cartoon: { color: '#ef4444', opacity: 1.0, arrows: true, thickness: 0.3 },
        stick: { color: '#ef4444', radius: 0.18 },
        sphere: { color: '#ef4444', scale: 0.38, opacity: 0.9 }
      });
    });

  } else if (colorMode === 'pocket') {
    const POCKET_COLORS = ['#06b6d4', '#f97316', '#a855f7', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];
    // Group consecutive residues into pockets by proximity
    const sorted = [...sites].sort((a, b) => a.chain.localeCompare(b.chain) || a.resi - b.resi);
    let lastChain = null;
    let pocketIdx = 0;
    let lastResi = -999;
    const pocketMap = [];
    sorted.forEach(site => {
      if (site.chain !== lastChain || parseInt(site.resi) - lastResi > 6) pocketIdx++;
      pocketMap.push({ site, pocket: pocketIdx });
      lastResi = parseInt(site.resi);
      lastChain = site.chain;
    });
    // Apply per-pocket color using batch resi selectors
    const pocketGroups = {};
    pocketMap.forEach(({ site, pocket }) => {
      const ch = (site.chain || '').trim();
      const key = `${pocket}-${ch}`;
      if (!pocketGroups[key]) pocketGroups[key] = { ch, pocket, resis: [] };
      pocketGroups[key].resis.push(parseInt(site.resi));
    });
    Object.values(pocketGroups).forEach(({ ch, pocket, resis }) => {
      const col = POCKET_COLORS[pocket % POCKET_COLORS.length];
      const sel = { chain: ch, resi: resis };
      currentViewer.setStyle(sel, {
        cartoon: { color: col, opacity: 1.0, arrows: true, thickness: 0.3 },
        stick: { color: col, radius: 0.18 },
        sphere: { color: col, scale: 0.38, opacity: 0.9 }
      });
    });

  } else {
    // Heatmap mode — must do per-residue bc each has unique color
    const maxProb = Math.max(...sites.map(s => s.probability ?? s.score ?? 1.0));
    const minProb = Math.min(...sites.map(s => s.probability ?? s.score ?? threshold));
    const range = maxProb - minProb || 0.01;

    sites.forEach(site => {
      const prob = site.probability ?? site.score ?? 1.0;
      const pct = (prob - minProb) / range;
      const col = confidenceColor(pct);
      const ch = (site.chain || '').trim();
      const sel = { chain: ch, resi: parseInt(site.resi) };
      currentViewer.setStyle(sel, {
        cartoon: { color: col, opacity: 1.0, arrows: true, thickness: 0.3 },
        stick: { color: col, radius: 0.18 },
        sphere: { color: col, scale: 0.38, opacity: 0.9 }
      });
    });
  }

  currentViewer.render();
}

function applyStyle(viewer, styleName, colorScheme) {
  const models = viewer.getModel();
  if (!models) return;

  viewer.setStyle({}, {});
  const colorOpts = getColorOptions(colorScheme);
  // Add smooth shading for premium look
  const styleOpts = { ...colorOpts, smooth: true };

  switch (styleName) {
    case 'cartoon':
      viewer.setStyle({}, { cartoon: { ...styleOpts, arrows: true, tubes: false, thickness: 0.35, ribbontruss: true } });
      break;
    case 'stick':
      viewer.setStyle({}, { stick: { ...styleOpts, radius: 0.15, colorscheme: 'Jmol' } });
      break;
    case 'sphere':
      viewer.setStyle({}, { sphere: { ...styleOpts, scale: 0.3 } });
      break;
    case 'line':
      viewer.setStyle({}, { line: styleOpts });
      break;
    case 'cross':
      viewer.setStyle({}, { sphere: { ...styleOpts, scale: 0.2 }, stick: { ...styleOpts, radius: 0.1 } });
      break;
    default:
      viewer.setStyle({}, { cartoon: { ...styleOpts } });
  }
  viewer.render();
}

function getColorOptions(scheme) {
  switch (scheme) {
    case 'spectrum': return { color: 'spectrum' };
    case 'chain': return { colorscheme: 'chainHetatm' };
    case 'ss': return { colorscheme: 'ssJmol' };
    case 'residue': return { colorscheme: 'amino' };
    case 'element': return { colorscheme: 'default' };
    case 'confidence': return { colorscheme: { prop: 'b', gradient: new $3Dmol.Gradient.RWB(50, 90) } };
    case 'cyan': return { color: '0x06b6d4' };
    default: return { color: 'spectrum' };
  }
}

function showStructureInfo(id, pdbData, source) {
  const infoEl = document.getElementById('structure-info');
  const statsEl = document.getElementById('structure-stats');
  if (!infoEl || !statsEl) return;

  const lines = pdbData.split('\n');
  const atomCount = lines.filter(l => l.startsWith('ATOM')).length;
  const chains = new Set(lines.filter(l => l.startsWith('ATOM')).map(l => l[21]).filter(Boolean));
  const residues = new Set(lines.filter(l => l.startsWith('ATOM')).map(l => l.substring(17, 26).trim()));

  const titleLine = lines.find(l => l.startsWith('TITLE'));
  const title = titleLine ? titleLine.substring(10).trim() : id;

  const expLine = lines.find(l => l.startsWith('EXPDTA'));
  const method = expLine ? expLine.substring(10).trim() : (source === 'alphafold' ? 'AI Prediction (AlphaFold2)' : 'Unknown');

  const resLine = lines.find(l => l.startsWith('REMARK   2 RESOLUTION'));
  const resolution = resLine ? resLine.replace(/.*RESOLUTION[\.\s]*/i, '').replace(/ANGSTROMS.*/i, '').trim() : 'N/A';

  const sourceLabel = source === 'local' ? 'Local PDB' : source === 'alphafold'
    ? `<span style="color:#4ade80;">AlphaFold DB</span>`
    : `<span style="color:var(--accent-cyan);">RCSB PDB</span>`;

  statsEl.innerHTML = `
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${source === 'alphafold' ? 'UniProt' : 'PDB'} ID</div>
      <div style="font-size:20px;font-weight:700;color:var(--accent-cyan);">${escapeHtml(id)}</div>
    </div>
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Source</div>
      <div style="font-size:14px;font-weight:600;">${sourceLabel}</div>
    </div>
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Atoms</div>
      <div style="font-size:20px;font-weight:700;color:var(--text-primary);">${atomCount.toLocaleString()}</div>
    </div>
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Chains</div>
      <div style="font-size:20px;font-weight:700;color:var(--text-primary);">${chains.size}</div>
    </div>
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Residues</div>
      <div style="font-size:20px;font-weight:700;color:var(--text-primary);">${residues.size.toLocaleString()}</div>
    </div>
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Method</div>
      <div style="font-size:12px;color:var(--text-secondary);">${method}</div>
    </div>
    ${source !== 'alphafold' ? `
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Resolution</div>
      <div style="font-size:12px;color:var(--text-secondary);">${resolution} ${resolution !== 'N/A' ? 'Å' : ''}</div>
    </div>` : `
    <div style="background:var(--bg-tertiary);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--border-muted);">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Confidence</div>
      <div style="font-size:12px;color:var(--text-secondary);">Use "By Confidence" color to view pLDDT scores</div>
    </div>`}
  `;
  infoEl.style.display = 'block';
}

function workflowStatus(message, step) {
  const status = document.getElementById('protein-workflow-status');
  if (status) {
    const parts = message.split(' / ');
    if (parts.length === 2) {
      status.dataset.vi = parts[0];
      status.dataset.en = parts[1];
      status.textContent = document.documentElement.lang === 'en' ? parts[1] : parts[0];
    } else {
      status.removeAttribute('data-vi'); status.removeAttribute('data-en'); status.textContent = message;
    }
  }
  document.querySelectorAll('.protein-steps [data-step]').forEach(item => {
    if (item.dataset.step === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}
