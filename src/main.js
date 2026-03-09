// ============================================
// BioGenesis — Main Application Controller
// ============================================

import './style.css';
import { SAMPLE_SEQUENCES } from './data/sampleSequences.js';
import { parseFasta, parseGenBank, detectSequenceType, toFasta, downloadFile, reverseComplement, translate, fetchUniProtId } from './utils/bioUtils.js';
import { initStorage, loadWorkspace, saveWorkspace } from './utils/storage.js';
import { autoAnnotate } from './utils/autoAnnotate.js';

// Components
import { renderSequenceViewer, bindSequenceViewerEvents } from './components/SequenceViewer.js';
import { renderSequenceEditor } from './components/SequenceEditor.js';
import { renderPlasmidMap } from './components/PlasmidMap.js';
import { renderAlignment, computeAndRenderAlignment } from './components/SequenceAlignment.js';
import { renderPhyloTree, computeAndRenderTree } from './components/PhyloTree.js';
import { renderPrimerDesign } from './components/PrimerDesign.js';
import { renderBlastSearch, runBlast } from './components/BlastSearch.js';
import { renderRestrictionAnalysis, renderDigestResult } from './components/RestrictionAnalysis.js';
import { renderStatistics } from './components/Statistics.js';
import { renderDotPlot, computeDotPlot } from './components/DotPlot.js';
import { renderMotifFinder, computeMotifSearch } from './components/MotifFinder.js';
import { renderSixFrameTranslation } from './components/SixFrameTranslation.js';
import { renderCodonOptimization, renderCodonAnalysis } from './components/CodonOptimization.js';
import { renderLinearMap } from './components/LinearMap.js';
import { renderProteinViewer3D, bindProteinViewerEvents } from './components/ProteinViewer3D.js';
import { renderSequenceProperties, bindSequencePropertiesEvents } from './components/SequenceProperties.js';

// Application State
const state = {
  sequences: [],
  activeSequenceIdx: -1,
  activeTool: 'viewer',
  tabs: [],
  activeTabId: null,
  tabCounter: 0,
};

// ====== INITIALIZATION ======
async function init() {
  try {
    const savedState = await loadWorkspace();
    if (savedState && savedState.sequences && savedState.sequences.length > 0) {
      state.sequences = savedState.sequences;
      state.tabs = savedState.tabs || [];
      state.activeTabId = savedState.activeTabId;
      state.tabCounter = savedState.tabCounter || 0;
      state.activeSequenceIdx = savedState.activeSequenceIdx || -1;
    } else {
      state.sequences = [...SAMPLE_SEQUENCES];
    }
  } catch (err) {
    console.warn("Failed to load workspace, using default", err);
    state.sequences = [...SAMPLE_SEQUENCES];
  }

  renderFileTree();
  bindToolNav();
  bindToolbar();
  bindNcbiFetch();

  if (state.activeTabId != null) {
    renderTabs();
    renderToolPanel();
  } else {
    renderWelcomeScreen();
  }

  setStatus('Ready');
}

// Global debounced save function
let saveTimeout = null;
function triggerSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveWorkspace(state).catch(e => console.error("Auto-save failed:", e));
  }, 1000); // Debounce to prevent slamming IndexedDB
}

// ====== FILE TREE ======
function renderFileTree() {
  const tree = document.getElementById('file-tree');
  if (!tree) return;
  tree.innerHTML = state.sequences.map((seq, i) => {
    const isActive = i === state.activeSequenceIdx;
    const typeLabel = seq.type === 'protein' ? 'PRT' : seq.type === 'rna' ? 'RNA' : seq.topology === 'circular' ? 'CIR' : 'DNA';
    return `
      <div class="file-item${isActive ? ' active' : ''}" data-idx="${i}">
        <svg class="file-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${seq.type === 'protein'
        ? '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
        : seq.topology === 'circular'
          ? '<circle cx="12" cy="12" r="9"/>'
          : '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'}
        </svg>
        <span class="file-name">${escapeHtml(seq.name)}</span>
        <span class="file-type">${typeLabel}</span>
      </div>`;
  }).join('');

  // Event delegation — single listener instead of N listeners
  if (!tree._delegated) {
    tree.addEventListener('click', (e) => {
      const item = e.target.closest('.file-item');
      if (item && item.dataset.idx != null) {
        openSequence(parseInt(item.dataset.idx));
      }
    });
    tree._delegated = true;
  }

  updateDocsCount();
}

// Update file tree active class without full re-render
function updateFileTreeActive(newIdx) {
  const tree = document.getElementById('file-tree');
  if (!tree) return;
  const prev = tree.querySelector('.file-item.active');
  if (prev) prev.classList.remove('active');
  const next = tree.querySelector(`.file-item[data-idx="${newIdx}"]`);
  if (next) next.classList.add('active');
}

// Update document count badge
function updateDocsCount() {
  const el = document.getElementById('docs-count');
  if (el) el.textContent = `(${state.sequences.length})`;
}

// ====== NCBI FETCH ======
function bindNcbiFetch() {
  const fetchBtn = document.getElementById('ncbi-fetch-btn');
  const input = document.getElementById('ncbi-search-input');
  const dbSelect = document.getElementById('ncbi-db-select');
  const statusEl = document.getElementById('ncbi-status');

  const doFetch = async () => {
    const query = input?.value?.trim();
    if (!query) return;

    let db = dbSelect?.value || 'nucleotide';
    const qUpper = query.toUpperCase();

    // Auto-detect Database based on accession prefix
    if (/^(NP_|XP_|WP_|YP_|AP_)/.test(qUpper) || /^[A-Z][0-9][A-Z0-9]{3}[0-9]/.test(qUpper) || /^[A-Z]{3}\d{5}/.test(qUpper)) {
      db = 'protein';
      if (dbSelect) dbSelect.value = 'protein';
    } else if (/^(NM_|XM_|NR_|XR_|NG_|NC_)/.test(qUpper)) {
      db = 'nucleotide';
      if (dbSelect) dbSelect.value = 'nucleotide';
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--text-muted)';
      statusEl.textContent = `Fetching ${query} from NCBI ${db}...`;
    }
    fetchBtn.disabled = true;
    fetchBtn.textContent = '...';

    try {
      // Try direct accession fetch first
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${db}&id=${encodeURIComponent(query)}&rettype=fasta&retmode=text`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`NCBI returned ${resp.status}`);
      const text = await resp.text();

      if (!text.startsWith('>')) {
        // Might be a search term — try esearch first
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=${db}&term=${encodeURIComponent(query)}&retmax=1&retmode=json`;
        const searchResp = await fetch(searchUrl);
        const searchData = await searchResp.json();
        const ids = searchData?.esearchresult?.idlist;
        if (!ids || ids.length === 0) throw new Error('No results found');

        const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${db}&id=${ids[0]}&rettype=fasta&retmode=text`;
        const r2 = await fetch(fetchUrl);
        const t2 = await r2.text();
        if (!t2.startsWith('>')) throw new Error('Invalid FASTA response');
        addFastaToProject(t2, db);
      } else {
        addFastaToProject(text, db);
      }

      if (statusEl) {
        statusEl.style.color = 'var(--accent-cyan)';
        statusEl.textContent = '✓ Added to project';
        setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
      }
      if (input) input.value = '';
    } catch (err) {
      if (statusEl) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = `✗ ${err.message}`;
      }
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = 'Fetch';
    }
  };

  fetchBtn?.addEventListener('click', doFetch);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFetch(); });
}

function addFastaToProject(fastaText, db) {
  const lines = fastaText.split('\n');
  const header = lines[0].substring(1).trim();
  const seqStr = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();

  if (!seqStr) return;

  // Parse NCBI FASTA header formats:
  // sp|P04637|P53_HUMAN Cellular tumor antigen p53 OS=Homo sapiens ...
  // >NM_001301717.2 Homo sapiens breast cancer 1 ...
  // >gi|12345|ref|NM_000546.6| ...
  let name = 'NCBI_seq';
  let accession = '';
  let organism = '';

  // Try UniProt format: sp|ACCESSION|NAME or tr|ACCESSION|NAME
  const uniprotMatch = header.match(/^(?:sp|tr)\|([A-Z0-9]+)\|(\S+)/);
  if (uniprotMatch) {
    accession = uniprotMatch[1];
    name = uniprotMatch[2].replace(/_\w+$/, ''); // Remove species suffix
  } else {
    // Try gi format: gi|123|ref|ACCESSION| or gi|123|gb|ACCESSION|
    const giMatch = header.match(/gi\|\d+\|(?:ref|gb|emb|dbj)\|([^|]+)\|/);
    if (giMatch) {
      accession = giMatch[1].replace(/\.\d+$/, '');
      name = accession;
    } else {
      // Try plain accession: NM_000546.6 or P04637 at start
      const plainMatch = header.match(/^([A-Z][A-Z0-9_]+(?:\.\d+)?)/);
      if (plainMatch) {
        accession = plainMatch[1].replace(/\.\d+$/, '');
        name = accession;
      }
    }
  }

  // Extract organism from [Homo sapiens] or OS=Homo sapiens
  const orgBracket = header.match(/\[([^\]]+)\]\s*$/);
  const orgOS = header.match(/OS=([^=]+?)(?:\s+OX=|\s+GN=|\s+PE=|\s*$)/);
  if (orgBracket) organism = orgBracket[1];
  else if (orgOS) organism = orgOS[1].trim();

  // Better name: take first meaningful words from description
  if (name === accession || name === 'NCBI_seq') {
    // Get description part (after accession)
    const descPart = header.replace(/^[^\s]+\s+/, '').replace(/\[.*\]$/, '').trim();
    if (descPart) {
      name = descPart.split(/\s+/).slice(0, 3).join('_').substring(0, 30);
    }
  }
  name = name || accession || 'NCBI_seq';

  // Detect type
  let type = db === 'protein' ? 'protein' : 'dna';
  if (db === 'nucleotide') {
    const hasU = /U/i.test(seqStr) && !/T/i.test(seqStr);
    if (hasU) type = 'rna';
  }

  const newSeq = {
    name: name,
    description: header,
    type: type,
    organism: organism || 'NCBI Import',
    accession: accession,
    sequence: seqStr,
    features: [],
  };

  // For proteins: check if accession looks like UniProt (for AlphaFold)
  if (type === 'protein') {
    if (accession && /^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i.test(accession)) {
      newSeq.uniprotId = accession;
    } else {
      // Try to resolve the UniProt ID automatically in background
      fetchUniProtId(accession || name).then(resolvedUniProt => {
        if (resolvedUniProt) {
          newSeq.uniprotId = resolvedUniProt;
          triggerSave();
          console.log(`Mapped ${accession} to UniProt: ${resolvedUniProt}`);
          if (state.sequences[state.activeSequenceIdx] === newSeq) {
            renderToolPanel(); // Refresh 3D viewer cache if open
          }
        }
      });
    }
  }

  // Auto-annotate newly injected sequence
  autoAnnotate(newSeq);

  state.sequences.push(newSeq);
  triggerSave();
  renderFileTree();
  openSequence(state.sequences.length - 1);
  setStatus(`Added ${name} (${seqStr.length} ${type === 'protein' ? 'aa' : 'bp'})${accession ? ' — ' + accession : ''}`);
}

// ====== TOOL NAVIGATION ======
function bindToolNav() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTool = btn.dataset.tool;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderToolPanel();
    });
  });
}

// ====== TOOLBAR ======
function bindToolbar() {
  document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('file-input')?.click());
  document.getElementById('btn-export')?.addEventListener('click', handleExport);
  document.getElementById('btn-new-seq')?.addEventListener('click', showNewSequenceDialog);
  document.getElementById('btn-align')?.addEventListener('click', () => switchTool('alignment'));
  document.getElementById('btn-blast')?.addEventListener('click', () => switchTool('blast'));
  document.getElementById('btn-rc')?.addEventListener('click', handleReverseComplement);
  document.getElementById('btn-translate')?.addEventListener('click', () => switchTool('translation'));
  document.getElementById('file-input')?.addEventListener('change', handleFileImport);

  // Debounced search for performance with many sequences
  let searchTimer = null;
  document.getElementById('global-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = e.target.value.toLowerCase();
      const items = document.querySelectorAll('.file-item');
      items.forEach(item => {
        const name = item.querySelector('.file-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
      });
    }, 150); // 150ms debounce
  });
}

function switchTool(toolName) {
  state.activeTool = toolName;
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === toolName);
  });
  renderToolPanel();
}

// ====== SEQUENCE OPERATIONS ======
function openSequence(idx) {
  state.activeSequenceIdx = idx;
  // Toggle active class without re-rendering entire file tree
  updateFileTreeActive(idx);

  const seq = state.sequences[idx];
  let existingTab = state.tabs.find(t => t.seqIdx === idx);
  if (!existingTab) {
    const tab = { id: ++state.tabCounter, seqIdx: idx, name: seq.name };
    state.tabs.push(tab);
    existingTab = tab;
  }
  state.activeTabId = existingTab.id;
  triggerSave(); // Save tab state changes
  renderTabs();
  renderToolPanel();
  setStatus(`Viewing: ${seq.name} (${seq.sequence.length} ${seq.type === 'protein' ? 'aa' : 'bp'})`);
}

function handleReverseComplement() {
  if (state.activeSequenceIdx < 0) return;
  const seq = state.sequences[state.activeSequenceIdx];
  if (seq.type === 'protein') { setStatus('Cannot reverse complement a protein sequence'); return; }
  const rc = reverseComplement(seq.sequence);
  const newSeq = {
    name: seq.name + '_RC',
    sequence: rc,
    type: seq.type,
    annotations: [],
    description: `Reverse complement of ${seq.name}`,
  };
  state.sequences.push(newSeq);
  triggerSave();
  renderFileTree();
  openSequence(state.sequences.length - 1);
  setStatus(`Created reverse complement: ${newSeq.name}`);
}

// ====== FILE IMPORT / EXPORT ======
function handleFileImport(e) {
  const files = e.target.files;
  if (!files.length) return;
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let parsed = [];
      if (file.name.match(/\.(gb|gbk|genbank)$/i)) {
        const gbSeq = parseGenBank(text);
        if (gbSeq) parsed = [gbSeq];
      } else if (file.name.match(/\.(fasta|fa|fna|faa|seq)$/i)) {
        parsed = parseFasta(text);
      } else {
        const clean = text.replace(/\s/g, '');
        parsed = [{ name: file.name, sequence: clean, type: detectSequenceType(clean), annotations: [], description: '' }];
      }
      if (parsed.length) {
        parsed.forEach(seq => {
          autoAnnotate(seq);

          if (seq.type === 'protein') {
            const uniprotRegex = /([A-NR-Z][0-9][A-Z0-9]{3}[0-9]|[O,P,Q][0-9][A-Z0-9]{3}[0-9])/i;
            const upMatch = seq.name.match(uniprotRegex) || (seq.description && seq.description.match(uniprotRegex));

            if (upMatch) {
              seq.uniprotId = upMatch[1];
            } else {
              // Try resolving accession (e.g. if name is NP_000537)
              fetchUniProtId(seq.name).then(resolved => {
                if (resolved) {
                  seq.uniprotId = resolved;
                  triggerSave();
                  if (state.sequences[state.activeSequenceIdx] === seq) renderToolPanel();
                }
              });
            }
          }
        });

        state.sequences.push(...parsed);
        triggerSave();
        renderFileTree();
        openSequence(state.sequences.length - parsed.length);
        setStatus(`Imported ${parsed.length} sequence(s) from ${file.name}`);
      }
    };
    reader.readAsText(file);
  }
  e.target.value = '';
}

function handleExport() {
  if (state.activeSequenceIdx < 0) { setStatus('No sequence selected'); return; }
  const seq = state.sequences[state.activeSequenceIdx];
  const fasta = toFasta(seq.name, seq.sequence);
  downloadFile(fasta, `${seq.name}.fasta`);
  setStatus(`Exported ${seq.name}.fasta`);
}

// ====== TABS ======
function renderTabs() {
  const container = document.getElementById('tabs-container');
  if (!container) return;
  container.innerHTML = state.tabs.map(tab => `
    <button class="tab${tab.id === state.activeTabId ? ' active' : ''}" data-tab-id="${tab.id}">
      <span>${escapeHtml(tab.name)}</span>
      <span class="tab-close" data-close-tab="${tab.id}">&times;</span>
    </button>
  `).join('');

  container.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('tab-close')) return;
      const tabId = parseInt(el.dataset.tabId);
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) { state.activeTabId = tabId; openSequence(tab.seqIdx); }
    });
  });

  container.querySelectorAll('.tab-close').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const tabId = parseInt(el.dataset.closeTab);
      state.tabs = state.tabs.filter(t => t.id !== tabId);
      if (state.activeTabId === tabId) {
        if (state.tabs.length > 0) {
          state.activeTabId = state.tabs[state.tabs.length - 1].id;
          openSequence(state.tabs[state.tabs.length - 1].seqIdx);
        } else {
          state.activeTabId = null;
          state.activeSequenceIdx = -1;
          renderWelcomeScreen();
        }
      }
      triggerSave();
      renderTabs();
    });
  });
}

// ====== WELCOME SCREEN ======
function renderWelcomeScreen() {
  const panel = document.getElementById('panel-container');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:40px;">
      <div style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent-cyan);display:flex;align-items:center;justify-content:center;opacity:0.6;">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <path d="M8 14 C8 8, 14 6, 14 14 C14 6, 20 8, 20 14 C20 20, 14 22, 14 14 C14 22, 8 20, 8 14Z" fill="url(#wg)"/>
          <defs><linearGradient id="wg" x1="0" y1="0" x2="28" y2="28"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
        </svg>
      </div>
      <h1 style="font-size:28px;font-weight:700;background:var(--gradient-accent);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">BioGenesis</h1>
      <p style="color:var(--text-secondary);font-size:14px;max-width:500px;text-align:center;line-height:1.6;">Premium Bioinformatics Suite — Sequence Analysis, Alignment, Phylogenetics, Cloning, and More</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
        ${makeWelcomeCard('Import File', 'import', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>')}
        ${makeWelcomeCard('New Sequence', 'new', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>')}
        ${makeWelcomeCard('Sample: pUC19', 'sample-0', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3a3 3 0 013 3" stroke-width="2.5" opacity="0.5"/></svg>')}
        ${makeWelcomeCard('Sample: GFP', 'sample-1', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>')}
        ${makeWelcomeCard('BLAST Search', 'blast', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>')}
      </div>
    </div>
  `;

  panel.querySelectorAll('.welcome-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      if (action === 'import') document.getElementById('file-input')?.click();
      else if (action === 'new') showNewSequenceDialog();
      else if (action === 'blast') switchTool('blast');
      else if (action.startsWith('sample-')) openSequence(parseInt(action.split('-')[1]));
    });
  });
}

function makeWelcomeCard(label, action, iconSvg) {
  return `
    <div class="welcome-card" data-action="${action}" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 28px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);cursor:pointer;transition:all var(--transition-normal);min-width:120px;" onmouseover="this.style.borderColor='var(--accent-cyan)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border-default)';this.style.transform='none'">
      <span style="color:var(--text-muted);">${iconSvg}</span>
      <span style="font-size:12px;color:var(--text-secondary);">${label}</span>
    </div>`;
}

// ====== TOOL PANEL ROUTING ======
function renderToolPanel() {
  const panel = document.getElementById('panel-container');
  if (!panel) return;

  const seq = state.activeSequenceIdx >= 0 ? state.sequences[state.activeSequenceIdx] : null;

  if (!seq && !['blast', 'alignment', 'phylo', 'dotplot', 'protein3d'].includes(state.activeTool)) {
    renderWelcomeScreen();
    return;
  }

  switch (state.activeTool) {
    case 'viewer':
      panel.innerHTML = renderSequenceViewer(seq) + renderQuickActions(seq);
      bindSequenceViewerEvents(seq);
      break;
    case 'editor':
      panel.innerHTML = renderSequenceEditor(seq, state.sequences);
      bindEditorEvents(seq);
      break;
    case 'linearmap':
      panel.innerHTML = renderLinearMap(seq);
      break;
    case 'plasmid':
      panel.innerHTML = renderPlasmidMap(seq);
      break;
    case 'alignment':
      panel.innerHTML = renderAlignment(state.sequences, state.activeSequenceIdx >= 0 ? state.activeSequenceIdx : 0);
      bindAlignmentEvents();
      break;
    case 'dotplot':
      panel.innerHTML = renderDotPlot(state.sequences, state.activeSequenceIdx >= 0 ? state.activeSequenceIdx : 0);
      bindDotPlotEvents();
      break;
    case 'phylo':
      panel.innerHTML = renderPhyloTree(state.sequences);
      bindPhyloEvents();
      break;
    case 'stats':
      panel.innerHTML = renderStatistics(seq);
      break;
    case 'motif':
      panel.innerHTML = renderMotifFinder(seq);
      bindMotifEvents(seq);
      break;
    case 'properties':
      panel.innerHTML = renderSequenceProperties(seq);
      bindSequencePropertiesEvents(seq);
      break;
    case 'restriction':
      panel.innerHTML = renderRestrictionAnalysis(seq);
      bindRestrictionEvents(seq);
      break;
    case 'primer':
      panel.innerHTML = renderPrimerDesign(seq);
      break;
    case 'translation':
      panel.innerHTML = renderSixFrameTranslation(seq);
      break;
    case 'codon':
      panel.innerHTML = renderCodonOptimization(seq);
      bindCodonEvents(seq);
      break;
    case 'blast':
      panel.innerHTML = renderBlastSearch(seq);
      bindBlastEvents();
      break;
    case 'protein3d':
      panel.innerHTML = renderProteinViewer3D(seq);
      bindProteinViewerEvents(seq);
      break;
    default:
      panel.innerHTML = renderSequenceViewer(seq);
  }

  // Bind cross-tool quick action buttons everywhere
  bindCrossToolActions();
}

// ====== CROSS-TOOL QUICK ACTIONS ======
function renderQuickActions(seq) {
  if (!seq) return '';
  const isProtein = seq.type === 'protein';
  const isDNA = seq.type === 'dna';
  const isRNA = seq.type === 'rna';
  const hasPdb = !!seq.pdbId;
  const isCircular = seq.topology === 'circular';

  const actions = [];
  if (isDNA || isRNA) {
    actions.push({ tool: 'translation', label: 'Translate', icon: '<path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04z"/><path d="M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>' });
    actions.push({ tool: 'properties', label: 'GC Plot', icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' });
    actions.push({ tool: 'restriction', label: 'Restriction Sites', icon: '<path d="M14.5 2H18l-4 8 4 8h-3.5L11 12z"/><path d="M5.5 2H9l4 8-4 8H5.5l4-8z"/>' });
    actions.push({ tool: 'motif', label: 'Find Motifs', icon: '<circle cx="10" cy="10" r="7"/><path d="M20 21l-4.35-4.35"/><line x1="8" y1="10" x2="12" y2="10"/><line x1="10" y1="8" x2="10" y2="12"/>' });
    actions.push({ tool: 'primer', label: 'Design Primers', icon: '<path d="M2 12h6"/><path d="M16 12h6"/><circle cx="12" cy="12" r="4"/>' });
    if (isDNA) actions.push({ tool: 'codon', label: 'Codon Optimize', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' });
  }
  if (isCircular) {
    actions.push({ tool: 'plasmid', label: 'Plasmid Map', icon: '<circle cx="12" cy="12" r="9"/>' });
  }
  actions.push({ tool: 'linearmap', label: 'Linear Map', icon: '<line x1="2" y1="12" x2="22" y2="12"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="22" cy="12" r="1.5" fill="currentColor"/>' });
  if (isProtein || hasPdb) {
    actions.push({ tool: 'protein3d', label: 'View 3D Structure', icon: '<path d="M12 2l8 4.5v9L12 22l-8-6.5v-9L12 2z"/>' });
  }
  if (isProtein) {
    actions.push({ tool: 'properties', label: 'Hydrophobicity', icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' });
  }
  actions.push({ tool: 'stats', label: 'Statistics', icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>' });

  return `
    <div style="padding:12px 16px;border-top:1px solid var(--border-muted);">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Quick Actions</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${actions.map(a => `
          <button class="cross-tool-btn" data-cross-tool="${a.tool}"
            style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;transition:all 0.15s;font-family:var(--font-sans);"
            onmouseover="this.style.borderColor='var(--accent-cyan)';this.style.color='var(--accent-cyan)'"
            onmouseout="this.style.borderColor='var(--border-muted)';this.style.color='var(--text-secondary)'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.icon}</svg>
            ${a.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function bindCrossToolActions() {
  document.querySelectorAll('.cross-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.crossTool;
      if (tool) switchTool(tool);
    });
  });
}

// ====== EVENT BINDINGS ======

function bindAlignmentEvents() {
  document.getElementById('run-alignment-btn')?.addEventListener('click', () => {
    const sel1 = document.getElementById('align-seq1');
    const sel2 = document.getElementById('align-seq2');
    const algo = document.getElementById('align-algo');
    if (!sel1 || !sel2 || !algo) return;
    const seq1 = state.sequences[parseInt(sel1.value)];
    const seq2 = state.sequences[parseInt(sel2.value)];
    if (!seq1 || !seq2) return;
    const resultDiv = document.getElementById('alignment-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Computing alignment...</p>';
      setTimeout(() => {
        resultDiv.innerHTML = computeAndRenderAlignment(seq1, seq2, algo.value);
      }, 50);
    }
  });
}

function bindDotPlotEvents() {
  document.getElementById('run-dotplot-btn')?.addEventListener('click', () => {
    const s1 = document.getElementById('dotplot-seq1');
    const s2 = document.getElementById('dotplot-seq2');
    const win = document.getElementById('dotplot-window');
    const thr = document.getElementById('dotplot-threshold');
    if (!s1 || !s2) return;
    const seq1 = state.sequences[parseInt(s1.value)];
    const seq2 = state.sequences[parseInt(s2.value)];
    const resultDiv = document.getElementById('dotplot-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Computing dot plot...</p>';
      setTimeout(() => {
        resultDiv.innerHTML = computeDotPlot(seq1, seq2, parseInt(win?.value || 10), parseInt(thr?.value || 70));
      }, 50);
    }
  });
}

function bindPhyloEvents() {
  document.getElementById('build-tree-btn')?.addEventListener('click', () => {
    const checks = document.querySelectorAll('.phylo-seq-check:checked');
    const seqs = Array.from(checks).map(c => state.sequences[parseInt(c.value)]);
    const resultDiv = document.getElementById('phylo-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Building tree...</p>';
      setTimeout(() => {
        resultDiv.innerHTML = computeAndRenderTree(seqs);
      }, 50);
    }
  });
}

function bindMotifEvents(seq) {
  // Quick shortcuts
  document.querySelectorAll('.motif-shortcut').forEach(el => {
    el.addEventListener('click', () => {
      const input = document.getElementById('motif-pattern');
      if (input) input.value = el.dataset.motif;
    });
  });

  document.getElementById('run-motif-btn')?.addEventListener('click', () => {
    const pattern = document.getElementById('motif-pattern')?.value;
    const mode = document.getElementById('motif-mode')?.value || 'exact';
    const strand = document.getElementById('motif-strand')?.value || 'both';
    if (!pattern) return;
    const resultDiv = document.getElementById('motif-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Searching...</p>';
      setTimeout(() => {
        resultDiv.innerHTML = computeMotifSearch(seq, pattern, mode, strand);
      }, 50);
    }
  });
}

function bindRestrictionEvents(seq) {
  const selectedEnzymes = new Set();

  function getChecked() {
    return [...document.querySelectorAll('.enzyme-check:checked')].map(el => el.dataset.enzyme);
  }

  function updateGel() {
    const names = getChecked();
    selectedEnzymes.clear();
    names.forEach(n => selectedEnzymes.add(n));
    const gelDiv = document.getElementById('gel-result');
    if (gelDiv) {
      gelDiv.innerHTML = renderDigestResult(seq, [...selectedEnzymes]);
    }
  }

  function applyFilters() {
    const groupVal = document.getElementById('re-filter-group')?.value || 'all';
    const cutsVal = document.getElementById('re-filter-cuts')?.value || 'all';
    document.querySelectorAll('.enzyme-row').forEach(row => {
      const check = row.querySelector('.enzyme-check');
      if (!check) return;
      const enzyme = check.dataset.enzyme;
      // Group filter — we check via data attribute on row
      const rowGroup = row.dataset.group || 'common';
      const groupOk = groupVal === 'all' || rowGroup === groupVal;
      // Cuts filter
      const cutsText = row.querySelector('.cuts-badge')?.textContent || '0';
      const cuts = parseInt(cutsText) || 0;
      let cutsOk = true;
      if (cutsVal === '1') cutsOk = cuts === 1;
      else if (cutsVal === '2-3') cutsOk = cuts >= 2 && cuts <= 3;
      else if (cutsVal === 'many') cutsOk = cuts >= 4;
      row.style.display = groupOk && cutsOk ? '' : 'none';
    });
  }

  // Attach group/site to rows (needed for filter)
  document.querySelectorAll('.enzyme-row').forEach(row => {
    const name = row.dataset.enzyme;
    // We assign group from the enzyme data
    const { findRestrictionSites, RESTRICTION_ENZYMES_UNIQUE } = window.__restrictionUtils || {};
    const enzyme = (RESTRICTION_ENZYMES_UNIQUE || []).find(e => e.name === name);
    if (enzyme) row.dataset.group = enzyme.group || 'common';
  });

  // Enzyme checkbox toggle
  document.querySelectorAll('.enzyme-check').forEach(chk => {
    chk.addEventListener('change', updateGel);
  });

  // TR click → toggle checkbox
  document.querySelectorAll('.enzyme-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return; // let checkbox handle itself
      const chk = row.querySelector('.enzyme-check');
      if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    });
  });

  // Filter dropdowns
  document.getElementById('re-filter-group')?.addEventListener('change', applyFilters);
  document.getElementById('re-filter-cuts')?.addEventListener('change', applyFilters);

  // Select unique button
  document.getElementById('re-select-unique')?.addEventListener('click', () => {
    document.querySelectorAll('.enzyme-row').forEach(row => {
      const chk = row.querySelector('.enzyme-check');
      if (!chk) return;
      const badge = row.querySelector('.cuts-unique');
      if (badge && row.style.display !== 'none') { chk.checked = true; }
      else chk.checked = false;
    });
    updateGel();
  });

  // Clear all
  document.getElementById('re-clear-all')?.addEventListener('click', () => {
    document.querySelectorAll('.enzyme-check').forEach(c => c.checked = false);
    selectedEnzymes.clear();
    updateGel();
  });
}

function bindCodonEvents(seq) {
  document.getElementById('run-codon-btn')?.addEventListener('click', () => {
    const org = document.getElementById('codon-organism')?.value || 'ecoli';
    const resultDiv = document.getElementById('codon-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Optimizing...</p>';
      setTimeout(() => {
        resultDiv.innerHTML = renderCodonAnalysis(seq.sequence, org);
      }, 50);
    }
  });
}

function bindBlastEvents() {
  document.getElementById('run-blast-btn')?.addEventListener('click', async () => {
    const query = document.getElementById('blast-query')?.value;
    const program = document.getElementById('blast-program')?.value || 'blastn';
    const db = document.getElementById('blast-db')?.value || 'nt';
    if (!query || query.trim().length < 10) { setStatus('Query too short (min 10 chars)'); return; }
    const resultDiv = document.getElementById('blast-result');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div style="text-align:center;padding:40px;">
          <div class="spinner"></div>
          <p style="color:var(--text-secondary);margin-top:12px;">Submitting BLAST query to NCBI...</p>
          <p style="color:var(--text-muted);font-size:11px;margin-top:4px;">This typically takes 30-60 seconds</p>
        </div>
      `;
      try {
        const html = await runBlast(query, program, db);
        resultDiv.innerHTML = html;
        setStatus('BLAST search complete');
      } catch (err) {
        resultDiv.innerHTML = `<div class="empty-state"><p class="empty-state-text">Error: ${err.message}</p></div>`;
        setStatus('BLAST search failed');
      }
    }
  });
}

function bindEditorEvents(seq) {
  document.getElementById('add-annotation-btn')?.addEventListener('click', () => {
    showAnnotationDialog(seq);
  });
}

// ====== DIALOGS ======
function showNewSequenceDialog() {
  showModal(`
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;">New Sequence</h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Name</label>
      <input class="form-input" id="new-seq-name" type="text" placeholder="My Sequence" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Sequence</label>
      <textarea id="new-seq-data" rows="6" placeholder="ATCGATCG..." style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;resize:vertical;outline:none;"></textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;">Create</button>
    </div>
  `);

  document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    const name = document.getElementById('new-seq-name')?.value || 'Untitled';
    const seqData = (document.getElementById('new-seq-data')?.value || '').replace(/[^A-Za-z*]/g, '');
    if (!seqData) { setStatus('Please enter a sequence'); return; }
    const type = detectSequenceType(seqData);
    const newSeq = { name, sequence: seqData, type, annotations: [], description: 'User-created sequence' };
    autoAnnotate(newSeq);
    state.sequences.push(newSeq);
    triggerSave();
    renderFileTree();
    openSequence(state.sequences.length - 1);
    hideModal();
    setStatus(`Created: ${name}`);
  });
}

function showAnnotationDialog(seq) {
  showModal(`
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;">Add Annotation</h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Feature Name</label>
      <input class="form-input" id="ann-name" type="text" placeholder="e.g., GFP" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Type</label>
        <select id="ann-type" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="gene">Gene</option><option value="CDS">CDS</option><option value="promoter">Promoter</option>
          <option value="terminator">Terminator</option><option value="rep_origin">Origin of Replication</option>
          <option value="primer_bind">Primer Binding Site</option><option value="misc_feature">Misc Feature</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">Strand</label>
        <select id="ann-strand" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="forward">Forward (+)</option><option value="reverse">Reverse (-)</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Start Position</label>
        <input class="form-input" id="ann-start" type="number" value="1" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">End Position</label>
        <input class="form-input" id="ann-end" type="number" value="${Math.min(100, seq.sequence.length)}" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;">Add</button>
    </div>
  `);

  document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
  document.getElementById('modal-confirm')?.addEventListener('click', () => {
    const name = document.getElementById('ann-name')?.value || 'Feature';
    const type = document.getElementById('ann-type')?.value || 'misc_feature';
    const strand = document.getElementById('ann-strand')?.value || 'forward';
    const start = parseInt(document.getElementById('ann-start')?.value || '1') - 1;
    const end = parseInt(document.getElementById('ann-end')?.value || '100');
    if (!seq.annotations) seq.annotations = [];
    seq.annotations.push({ name, type, start, end, direction: strand });
    triggerSave();
    hideModal();
    renderToolPanel();
    setStatus(`Added annotation: ${name}`);
  });
}

// ====== MODAL ======
function showModal(content) {
  const overlay = document.getElementById('modal-overlay');
  const modalContent = document.getElementById('modal-content');
  if (overlay && modalContent) {
    modalContent.innerHTML = content;
    overlay.classList.remove('hidden');
  }
}

function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ====== STATUS BAR ======
function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
  const info = document.getElementById('status-seq-info');
  if (info && state.activeSequenceIdx >= 0) {
    const seq = state.sequences[state.activeSequenceIdx];
    info.textContent = `${seq.name} | ${seq.sequence.length} ${seq.type === 'protein' ? 'aa' : 'bp'} | ${seq.type.toUpperCase()}`;
  }
}

// ====== UTILITIES ======
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====== BOOT ======
// Module scripts are deferred by default, so DOM is already ready when this executes.
// Using both approaches for safety:
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
