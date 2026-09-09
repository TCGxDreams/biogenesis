// ============================================
// BioGenesis — Tool registry
// ============================================
//
// Binds each tool's metadata (src/app/toolMeta.js) to the functions that render
// and wire it. Adding a tool means one entry in each of those two objects plus a
// button in index.html — no control flow to edit.

import { sequenceViewMarkup } from './sequenceViewHost.js';
import { renderSequenceEditor } from '../components/SequenceEditor.js';
import { renderLinearMap, bindLinearMapEvents } from '../components/LinearMap.js';
import { renderPlasmidMap, bindPlasmidMapEvents } from '../components/PlasmidMap.js';
import { renderAlignment } from '../components/SequenceAlignment.js';
import { renderDotPlot } from '../components/DotPlot.js';
import { renderPhyloTree } from '../components/PhyloTree.js';
import { renderStatistics } from '../components/Statistics.js';
import { renderMotifFinder } from '../components/MotifFinder.js';
import {
    renderSequenceProperties,
    bindSequencePropertiesEvents,
} from '../components/SequenceProperties.js';
import { renderRestrictionAnalysis } from '../components/RestrictionAnalysis.js';
import { renderPrimerDesign } from '../components/PrimerDesign.js';
import {
    renderSixFrameTranslation,
    bindSixFrameEvents,
} from '../components/SixFrameTranslation.js';
import { renderCodonOptimization } from '../components/CodonOptimization.js';
import { renderBlastSearch } from '../components/BlastSearch.js';
import { renderProteinViewer3D, bindProteinViewerEvents } from '../components/ProteinViewer3D.js';
import { TOOL_META, DEFAULT_TOOL_ID } from './toolMeta.js';

export { ALL_TYPES, DEFAULT_TOOL_ID, toolUnavailableReason, isToolAvailable } from './toolMeta.js';

/**
 * @typedef {import('./toolMeta.js').ToolMeta} ToolMeta
 * @typedef {import('./toolMeta.js').ToolContext} ToolContext
 */

/**
 * @typedef {ToolMeta & {
 *   render: (seq: Object|null, context: ToolContext) => string,
 *   bind?: (seq: Object|null, context: ToolContext) => void
 * }} ToolDefinition
 */

/**
 * How each tool turns state into markup, and wires it once mounted.
 *
 * @type {{[id: string]: {
 *   render: (seq: any, context: ToolContext) => string,
 *   bind?: (seq: any, context: ToolContext) => void
 * }}}
 */
const RENDERERS = {
    viewer: {
        render: () => sequenceViewMarkup(),
        // The view mounts itself onto the slot and manages its own lifetime;
        // panel.js tears the previous instance down before re-rendering.
        bind: () => {},
    },
    editor: {
        // renderSequenceEditor takes only the sequence; main.js used to pass
        // the whole workspace as a second argument, which was ignored.
        render: seq => renderSequenceEditor(seq),
    },
    linearmap: {
        render: seq => renderLinearMap(seq),
        bind: () => bindLinearMapEvents(),
    },
    plasmid: {
        render: seq => renderPlasmidMap(seq),
        bind: () => bindPlasmidMapEvents(),
    },
    alignment: {
        // renderAlignment derives its own selection; the active index main.js
        // used to pass was ignored.
        render: (seq, { sequences }) => renderAlignment(sequences),
    },
    dotplot: {
        render: (seq, { sequences, activeSequenceIdx }) =>
            renderDotPlot(sequences, activeSequenceIdx >= 0 ? activeSequenceIdx : 0),
    },
    phylo: {
        render: (seq, { sequences }) => renderPhyloTree(sequences),
    },
    stats: {
        render: seq => renderStatistics(seq),
    },
    motif: {
        render: seq => renderMotifFinder(seq),
    },
    properties: {
        render: seq => renderSequenceProperties(seq),
        bind: seq => bindSequencePropertiesEvents(seq),
    },
    restriction: {
        render: seq => renderRestrictionAnalysis(seq),
    },
    primer: {
        render: seq => renderPrimerDesign(seq),
    },
    translation: {
        render: seq => renderSixFrameTranslation(seq),
        bind: seq => bindSixFrameEvents(seq),
    },
    codon: {
        render: seq => renderCodonOptimization(seq),
    },
    protein3d: {
        render: seq => renderProteinViewer3D(seq),
        bind: seq => bindProteinViewerEvents(seq),
    },
    blast: {
        render: seq => renderBlastSearch(seq),
    },
};

/** @type {{[id: string]: ToolDefinition}} */
export const TOOLS = Object.fromEntries(
    Object.entries(TOOL_META).map(([id, meta]) => [id, { ...meta, ...RENDERERS[id] }])
);

/**
 * Look a tool up by id, falling back to the default.
 *
 * @param {string} id
 * @returns {ToolDefinition}
 */
export function getTool(id) {
    return TOOLS[id] || TOOLS[DEFAULT_TOOL_ID];
}
