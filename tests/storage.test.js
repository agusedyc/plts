import { createStorage } from '../js/storage.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function memoryAdapter() {
  const mem = { history: [], preferences: {} };
  return {
    async getAll(store) { return mem[store]; },
    async put(store, value) {
      if (store === 'history') { value.id = value.id ?? String(Date.now()); mem.history.push(value); }
      else { mem.preferences = value; }
    },
    async delete(store, id) {
      if (store === 'history') mem.history = mem.history.filter(h => h.id !== id);
    },
  };
}

test('saveCalculation appends and getHistory returns it', async () => {
  const s = createStorage(memoryAdapter());
  await s.saveCalculation({ input: { peakPower: 5500 }, output: { inverterWatts: 6600 } });
  const hist = await s.getHistory();
  assert.equal(hist.length, 1);
  assert.equal(hist[0].output.inverterWatts, 6600);
  assert.ok(hist[0].timestamp);
  assert.ok(hist[0].id);
});

test('deleteHistory removes only matching id', async () => {
  const s = createStorage(memoryAdapter());
  await s.saveCalculation({ input: {}, output: { a: 1 } });
  const hist = await s.getHistory();
  await s.deleteHistory(hist[0].id);
  assert.equal((await s.getHistory()).length, 0);
});

test('clearHistory removes all history records', async () => {
  const s = createStorage(memoryAdapter());
  await s.saveCalculation({ input: { a: 1 } });
  await s.saveCalculation({ input: { a: 2 } });
  assert.equal((await s.getHistory()).length, 2);
  await s.clearHistory();
  assert.equal((await s.getHistory()).length, 0);
});

test('savePreferences and getPreferences round-trip', async () => {
  const s = createStorage(memoryAdapter());
  await s.savePreferences({ peakPower: 5500, sph: 4 });
  const p = await s.getPreferences();
  assert.equal(p.peakPower, 5500);
});
