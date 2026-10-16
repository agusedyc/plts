export const MAX_HISTORY_ITEMS = 50;

export function normalizeInputKey(input) {
  if (!input || typeof input !== 'object') return '';
  const sorted = {};
  for (const k of Object.keys(input).sort()) {
    sorted[k] = input[k];
  }
  return JSON.stringify(sorted);
}

let lastTimestampMs = 0;

function generateMonotonicTimestamp() {
  let now = Date.now();
  if (now <= lastTimestampMs) {
    now = lastTimestampMs + 1;
  }
  lastTimestampMs = now;
  return new Date(now).toISOString();
}

export function createStorage(adapter) {
  return {
    async saveCalculation(entry) {
      const record = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        timestamp: entry.timestamp || generateMonotonicTimestamp(),
        ...entry,
      };

      const newKey = normalizeInputKey(record.input);
      const all = await adapter.getAll('history');
      const list = Array.isArray(all) ? [...all] : [];

      // Deduplicate: delete previous entries with identical input
      const remaining = [];
      for (const item of list) {
        if (newKey && normalizeInputKey(item.input) === newKey) {
          await adapter.delete('history', item.id);
        } else {
          remaining.push(item);
        }
      }

      await adapter.put('history', record);
      remaining.unshift(record);

      // Enforce max 50 items cap: auto delete oldest
      remaining.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (remaining.length > MAX_HISTORY_ITEMS) {
        const excess = remaining.slice(MAX_HISTORY_ITEMS);
        for (const item of excess) {
          await adapter.delete('history', item.id);
        }
      }

      return record;
    },

    async getHistory() {
      const all = await adapter.getAll('history');
      const list = Array.isArray(all) ? [...all] : [];
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Guarantee deduplication & 50-item limit
      const seen = new Set();
      const deduped = [];
      for (const item of list) {
        const key = normalizeInputKey(item.input);
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        deduped.push(item);
        if (deduped.length >= MAX_HISTORY_ITEMS) break;
      }
      return deduped;
    },

    async deleteHistory(id) {
      await adapter.delete('history', id);
    },

    async clearHistory() {
      const list = await adapter.getAll('history');
      for (const item of list) {
        await adapter.delete('history', item.id);
      }
    },

    async savePreferences(prefs) {
      await adapter.put('preferences', prefs);
    },

    async getPreferences() {
      const all = await adapter.getAll('preferences');
      if (Array.isArray(all)) return all[0] ?? {};
      return all ?? {};
    },
  };
}

// Browser adapter: IndexedDB (lazy — never touches globals at module load)
export function createIndexedDbAdapter(dbName = 'plts-kalkulator', version = 1) {
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      let req;
      try {
        req = action(os);
      } catch (e) {
        db.close();
        reject(e);
        return;
      }
      tx.oncomplete = () => { db.close(); resolve(req && req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  return {
    async getAll(store) {
      return withStore(store, 'readonly', (os) => os.getAll());
    },
    async put(store, value) {
      const clean = JSON.parse(JSON.stringify(value));
      return withStore(store, 'readwrite', (os) =>
        store === 'preferences' ? os.put(clean, 'prefs') : os.put(clean));
    },
    async delete(store, id) {
      return withStore(store, 'readwrite', (os) => os.delete(id));
    },
  };
}

// Browser adapter fallback: localStorage (lazy)
export function createLocalStorageAdapter() {
  return {
    async getAll(store) {
      const raw = localStorage.getItem(`plts:${store}`);
      if (store === 'preferences') {
        return raw ? JSON.parse(raw) : {};
      }
      return raw ? JSON.parse(raw) : [];
    },
    async put(store, value) {
      if (store === 'preferences') {
        localStorage.setItem('plts:preferences', JSON.stringify(value));
      } else {
        const list = await this.getAll('history');
        const idx = list.findIndex((h) => h.id === value.id);
        if (idx >= 0) list[idx] = value;
        else list.push(value);
        localStorage.setItem('plts:history', JSON.stringify(list));
      }
    },
    async delete(store, id) {
      if (store !== 'history') return;
      const list = await this.getAll('history');
      localStorage.setItem('plts:history', JSON.stringify(list.filter((h) => h.id !== id)));
    },
  };
}

// Pick the best available browser adapter
export function getDefaultAdapter() {
  if (typeof indexedDB !== 'undefined') {
    return createIndexedDbAdapter();
  }
  return createLocalStorageAdapter();
}
