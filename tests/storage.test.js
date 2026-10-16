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

test('saveCalculation deduplicates matching input keeping only the newest', async () => {
  const s = createStorage(memoryAdapter());
  const inputA = { peakPower: 2200, systemVoltage: 48, wpPerPanel: 550 };
  const inputB = { peakPower: 3500, systemVoltage: 48, wpPerPanel: 550 };

  const first = await s.saveCalculation({ input: inputA, output: { panelCount: 4 } });
  await new Promise(r => setTimeout(r, 10));
  const second = await s.saveCalculation({ input: inputB, output: { panelCount: 6 } });
  await new Promise(r => setTimeout(r, 10));
  const third = await s.saveCalculation({ input: { ...inputA }, output: { panelCount: 5 } });

  const hist = await s.getHistory();
  assert.equal(hist.length, 2);
  assert.equal(hist[0].id, third.id);
  assert.equal(hist[0].output.panelCount, 5);
  assert.equal(hist[1].id, second.id);
  assert.ok(!hist.some(h => h.id === first.id));
});

test('saveCalculation automatically caps history at maximum 50 records', async () => {
  const s = createStorage(memoryAdapter());
  for (let i = 1; i <= 55; i++) {
    await s.saveCalculation({ input: { idKey: i }, output: { step: i } });
  }

  const hist = await s.getHistory();
  assert.equal(hist.length, 50);
  // Newest should be i = 55, oldest should be i = 6 (i=1..5 pruned)
  assert.equal(hist[0].output.step, 55);
  assert.equal(hist[49].output.step, 6);
  assert.ok(!hist.some(h => h.output.step <= 5));
});

test('getHistory deduplicates legacy duplicate records keeping newest', async () => {
  const mem = memoryAdapter();
  // Manually put duplicate records into memory
  await mem.put('history', { id: 'old-1', timestamp: '2026-01-01T10:00:00.000Z', input: { peakPower: 1000 } });
  await mem.put('history', { id: 'new-1', timestamp: '2026-01-02T10:00:00.000Z', input: { peakPower: 1000 } });
  await mem.put('history', { id: 'diff-1', timestamp: '2026-01-01T12:00:00.000Z', input: { peakPower: 2000 } });

  const s = createStorage(mem);
  const hist = await s.getHistory();
  assert.equal(hist.length, 2);
  assert.equal(hist[0].id, 'new-1');
  assert.equal(hist[1].id, 'diff-1');
});
