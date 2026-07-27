// ============================================
// BioGenesis — Application store
// ============================================
//
// The single place application state is written. Everything else reads through
// `getState()` and writes through `setState()`, so no code path can mutate state
// and forget to notify subscribers or schedule a save.
//
// The state object is mutated in place rather than replaced. This is deliberate:
// the app has no framework and no diffing, existing call sites read `state.x`
// directly, and an identity-stable object keeps those reads correct without a
// rewrite. What matters here is that writes are funnelled, not that they are
// immutable.

/**
 * @typedef {Object} StoreOptions
 * @property {(state: Object) => (void|Promise<void>)} [persist] Called on a
 *   trailing debounce after any write. Rejections are reported, not thrown.
 * @property {number} [debounceMs=1000] Quiet period before `persist` runs.
 */

/**
 * @typedef {Object} Store
 * @property {() => Object} getState Live state object. Do not mutate it.
 * @property {(patch: Object|((state: Object) => Object)) => Object} setState
 *   Merge a patch (or the result of a reducer) into state, notify subscribers,
 *   and schedule persistence.
 * @property {(listener: (state: Object) => void) => () => void} subscribe
 *   Register a listener; returns an unsubscribe function.
 * @property {() => Promise<void>} flush Persist immediately, cancelling any
 *   pending debounce. Resolves once the write settles.
 * @property {() => void} cancelPendingSave Drop a pending save without running it.
 */

/**
 * Create the application store.
 *
 * @param {Object} initialState
 * @param {StoreOptions} [options]
 * @returns {Store}
 */
export function createStore(initialState, options = {}) {
    const { persist, debounceMs = 1000 } = options;

    const state = { ...initialState };
    /** @type {Set<(state: Object) => void>} */
    const listeners = new Set();

    /** @type {ReturnType<typeof setTimeout>|null} */
    let saveTimer = null;

    function runPersist() {
        saveTimer = null;
        if (!persist) return Promise.resolve();
        // `persist` is invoked synchronously so a caller that advances timers
        // sees the call immediately; only its result is awaited.
        try {
            return Promise.resolve(persist(state)).catch(e =>
                console.error('Auto-save failed:', e)
            );
        } catch (e) {
            console.error('Auto-save failed:', e);
            return Promise.resolve();
        }
    }

    function schedulePersist() {
        if (!persist) return;
        if (saveTimer !== null) clearTimeout(saveTimer);
        saveTimer = setTimeout(runPersist, debounceMs);
    }

    return {
        getState: () => state,

        setState(patch) {
            const next = typeof patch === 'function' ? patch(state) : patch;
            if (next) Object.assign(state, next);
            for (const listener of listeners) listener(state);
            schedulePersist();
            return state;
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        flush() {
            if (saveTimer !== null) clearTimeout(saveTimer);
            return runPersist();
        },

        cancelPendingSave() {
            if (saveTimer !== null) clearTimeout(saveTimer);
            saveTimer = null;
        },
    };
}
