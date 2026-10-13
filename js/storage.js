export function createStorage(adapter) {
  return {
    async saveCalculation(entry) {
      const record = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        timestamp: new Date().toISOString(),
        ...entry,
      };
      await adapter.put('history', record);
      return record;
    },

    async getHistory() {
      const all = await adapter.getAll('history');
      const list = Array.isArray(all) ? all : [];
      return [...list].sort((a, b) => (b.timestamp < a.timestamp ? -1 : 1));
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

  async function withStore(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      const result = fn(os);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  return {
    async getAll(store) {
      return withStore(store, 'readonly', (os) => {
        const req = os.getAll();
        req.onerror = () => {};
        return req;
      });
    },
    async put(store, value) {
      return withStore(store, 'readwrite', (os) => {
        const req = store === 'preferences' ? os.put(value, 'prefs') : os.put(value);
        req.onerror = () => {};
        return req;
      });
    },
    async delete(store, id) {
      return withStore(store, 'readwrite', (os) => {
        const req = os.delete(id);
        req.onerror = () => {};
        return req;
      });
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
