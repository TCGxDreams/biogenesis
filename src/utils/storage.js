// ============================================
// BioGenesis — IndexedDB Storage Wrapper
// ============================================

const DB_NAME = 'BioGenesisDB';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

/** @type {IDBDatabase|null} */
let db = null;

/**
 * The subset of the app state that survives a reload. The active tool is
 * deliberately left out, so reopening the app does not drop the user into a
 * panel they were not expecting.
 *
 * @typedef {Object} PersistedWorkspace
 * @property {import('../core/types.js').Sequence[]} sequences
 * @property {Object[]} tabs
 * @property {string|number|null} activeTabId
 * @property {number} activeSequenceIdx
 * @property {number} tabCounter
 * @property {number} [lastSaved] Epoch milliseconds, written on save.
 */

/**
 * Open the IndexedDB database, creating the object store on first run.
 * Subsequent calls reuse the open connection.
 *
 * @returns {Promise<IDBDatabase>}
 */
export async function initStorage() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB Error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * Open the database if it is not open yet, and return the connection.
 *
 * @returns {Promise<IDBDatabase>}
 */
async function connection() {
    return db ?? (await initStorage());
}

/**
 * Persist the workspace. Debouncing is the caller's job, not this function's.
 *
 * @param {PersistedWorkspace} state Serialisable workspace state.
 * @returns {Promise<void>}
 */
export async function saveWorkspace(state) {
    const database = await connection();
    return new Promise((resolve, reject) => {
        try {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // We don't save the active tool to avoid confusing state on reload
            const dataToSave = {
                sequences: state.sequences,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                activeSequenceIdx: state.activeSequenceIdx,
                tabCounter: state.tabCounter,
                lastSaved: Date.now(),
            };

            const request = store.put(dataToSave, 'currentState');

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Read the persisted workspace.
 *
 * @returns {Promise<PersistedWorkspace|null>} Null when nothing has been saved.
 */
export async function loadWorkspace() {
    const database = await connection();
    return new Promise((resolve, reject) => {
        try {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('currentState');

            request.onsuccess = () => {
                resolve(request.result || null);
            };
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Delete the persisted workspace.
 *
 * @returns {Promise<void>}
 */
export async function clearWorkspace() {
    const database = await connection();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete('currentState');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
