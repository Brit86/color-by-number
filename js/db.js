/**
 * db.js — IndexedDB wrapper for Color by Number (spec §9).
 *
 * Database: 'color-by-number', version 1. Six stores:
 *   installedContent, progress, settings, achievements, catalog, downloads.
 *
 * Migrations must NEVER wipe user data: upgrades only add stores or indexes.
 * Progress is keyed by stable canvas ID, never by version, so it survives
 * compatible content updates and redownloads (AC-08, AC-09).
 */

export const DB_NAME = "color-by-number";
export const DB_VERSION = 1;

export const STORE_NAMES = [
  "installedContent",
  "progress",
  "settings",
  "achievements",
  "catalog",
  "downloads",
];

let dbPromise = null;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createStores(db) {
  // installedContent: canvas/pack records, keyed by permanent ID.
  if (!db.objectStoreNames.contains("installedContent")) {
    const store = db.createObjectStore("installedContent", { keyPath: "id" });
    store.createIndex("kind", "kind", { unique: false });
    store.createIndex("packId", "manifest.packId", { unique: false });
    store.createIndex("status", "status", { unique: false });
  }
  // progress: one record per canvas, keyed by canvas ID.
  if (!db.objectStoreNames.contains("progress")) {
    const store = db.createObjectStore("progress", { keyPath: "canvasId" });
    store.createIndex("lastPlayed", "lastPlayed", { unique: false });
    store.createIndex("completed", "completed", { unique: false });
  }
  // settings: one record per setting key.
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings", { keyPath: "key" });
  }
  // achievements: one record per achievement ID.
  if (!db.objectStoreNames.contains("achievements")) {
    const store = db.createObjectStore("achievements", { keyPath: "id" });
    store.createIndex("earnedAt", "earnedAt", { unique: false });
  }
  // catalog: two rows at most — 'bundled' and 'remote'.
  if (!db.objectStoreNames.contains("catalog")) {
    db.createObjectStore("catalog", { keyPath: "key" });
  }
  // downloads: one record per queued/in-flight download, keyed by content ID.
  if (!db.objectStoreNames.contains("downloads")) {
    const store = db.createObjectStore("downloads", { keyPath: "id" });
    store.createIndex("status", "status", { unique: false });
    store.createIndex("queuedAt", "queuedAt", { unique: false });
  }
}

/** Open (or create) the database. Safe to call repeatedly — one connection. */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      // Additive only: create missing stores/indexes, never delete user data.
      createStores(event.target.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB open was blocked"));
  });
  return dbPromise;
}

/** Run a function inside a transaction on one store; resolves with its result. */
export async function withStore(storeName, mode, fn) {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
  const result = await fn(store);
  await done;
  return result;
}

export async function dbPut(storeName, value) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.put(value)));
}

export async function dbGet(storeName, key) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.get(key)));
}

export async function dbGetAll(storeName) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.getAll()));
}

export async function dbDelete(storeName, key) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.delete(key)));
}

export async function dbCount(storeName) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.count()));
}

/** List the object store names present in the opened database. */
export async function getStoreNames() {
  const db = await openDB();
  return [...db.objectStoreNames];
}
