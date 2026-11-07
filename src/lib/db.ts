// Local storage layer. Data is kept in IndexedDB in this browser on this device only.
// Falls back to localStorage, then to memory (with a warning) if IndexedDB is unavailable.
import type { AppData } from './types';

declare const __APP_MODE__: 'demo' | 'customer';
export const APP_MODE: 'demo' | 'customer' = typeof __APP_MODE__ !== 'undefined' ? __APP_MODE__ : 'demo';
const DB_NAME = APP_MODE === 'demo' ? 'pixoraagoods-budget-demo' : 'pixoraagoods-budget';
const STORE = 'kv';
const KEY = 'data';

export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';
let kind: StorageKind = 'indexeddb';
let memory: AppData | null = null;
export const storageKind = () => kind;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDB());

export async function loadData(): Promise<AppData | null> {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve((r.result as AppData) ?? null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    try { kind = 'localstorage'; const s = localStorage.getItem(DB_NAME); return s ? JSON.parse(s) : null; }
    catch { kind = 'memory'; return memory; }
  }
}

export async function saveData(data: AppData): Promise<void> {
  if (kind === 'indexeddb') {
    try {
      const d = await db();
      await new Promise<void>((resolve, reject) => {
        const t = d.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(data, KEY);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
      return;
    } catch { kind = 'localstorage'; }
  }
  if (kind === 'localstorage') {
    try { localStorage.setItem(DB_NAME, JSON.stringify(data)); return; } catch { kind = 'memory'; }
  }
  memory = data;
}

export async function clearData(): Promise<void> {
  try { const d = await db(); await new Promise<void>((res) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(KEY); t.oncomplete = () => res(); t.onerror = () => res(); }); } catch { /* ignore */ }
  try { localStorage.removeItem(DB_NAME); } catch { /* ignore */ }
  memory = null;
}

/** Asks the browser not to clear our data automatically when space is low. */
export async function requestPersistence(): Promise<boolean | null> {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return null;
}
export async function isPersisted(): Promise<boolean | null> {
  try { if (navigator.storage?.persisted) return await navigator.storage.persisted(); } catch { /* ignore */ }
  return null;
}
