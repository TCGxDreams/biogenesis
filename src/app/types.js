// ============================================
// BioGenesis — Application-layer types
// ============================================
//
// Shapes shared by the modules under src/app/. Domain shapes live in
// src/core/types.js; these describe the controller's own state and the context
// object the modules are wired through.
//
// This module exports nothing at runtime; it exists for `checkJs`.

/**
 * The workspace state the store owns.
 *
 * @typedef {Object} WorkspaceState
 * @property {import('../core/types.js').Sequence[]} sequences
 * @property {import('./documentImport.js').AnalysisDocument[]} analysisDocuments
 * @property {string|null} activeAnalysisId
 * @property {number} activeSequenceIdx -1 when nothing is open.
 * @property {string} activeTool Id into the tool registry.
 * @property {Array<{id: number, seqIdx: number, name: string, documentId?: string}>} tabs
 * @property {number|null} activeTabId
 * @property {number} tabCounter Monotonic, so tab ids stay unique.
 */

/**
 * The application context. Every module receives this object and looks its
 * collaborators up on it at call time, so modules can reference each other
 * without import cycles and without a fixed wiring order.
 *
 * @typedef {Object} App
 * @property {WorkspaceState} state Live state. Read here, write via setState.
 * @property {(patch: Object) => Object} setState
 * @property {(str: string) => string} escapeHtml
 * @property {(msg: string) => void} setStatus
 * @property {(id: string) => void} openAnalysisDocument
 * @property {() => void} renderAnalysisDocument
 * @property {() => void} renderFileTree
 * @property {(newIdx: number) => void} updateFileTreeActive
 * @property {() => void} updateDocsCount
 * @property {() => void} renderTabs
 * @property {(idx: number) => void} openSequence
 * @property {() => void} renderToolPanel
 * @property {() => void} updateToolAvailability
 * @property {() => void} renderWelcomeScreen
 * @property {(seq: Object|null) => string} renderQuickActions
 * @property {() => void} bindCrossToolActions
 * @property {(label: string, action: string, iconSvg: string) => string} makeWelcomeCard
 * @property {() => void} bindToolNav
 * @property {() => void} bindToolbar
 * @property {(toolName: string) => void} switchTool
 * @property {() => void} handleReverseComplement
 * @property {(e: Event) => void} handleFileImport
 * @property {() => void} handleExport
 * @property {() => void} bindNcbiFetch
 * @property {(fastaText: string, db: string) => void} addFastaToProject
 * @property {() => void} showNewSequenceDialog
 * @property {(seq: Object) => void} showAnnotationDialog
 * @property {(content: string) => void} showModal
 * @property {() => void} hideModal
 * @property {{[toolId: string]: (seq: Object|null) => void}} toolBindings
 */

export {};
