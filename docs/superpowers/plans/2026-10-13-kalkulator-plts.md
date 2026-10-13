# Kalkulator PLTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web calculator that sizes off-grid PLTS components (Inverter, Panel, Battery, SCC) from daily energy usage, with local IndexedDB history/preferences and Docker+Caddy deployment.

**Architecture:** Pure-client-side static app. Pure calculation and validation logic live in ES modules tested with Node's `node:test`; Alpine.js drives reactive state (input↔results), HTMX v4 renders templates client-side, Bootstrap 5 provides styling. Storage is abstracted behind an injectable DB adapter (IndexedDB in browser, in-memory/localStorage for tests). Caddy serves the static files inside a Docker container on port 8005.

**Tech Stack:** HTML5, Bootstrap 5 (CDN), Alpine.js (CDN), HTMX v4 (CDN), ES modules, Node `node:test` (dev), IndexedDB, Docker + `caddy:alpine`.

**Spec:** `PRD.md` (v1.3.0). The plan argues from the spec; executors read both.

## Global Constraints

- App is **pure client-side**; no backend/logic on the server. All calculation runs in the browser.
- UI language: **Indonesian**.
- Energy input is in **kWh**, converted internally to Wh.
- All output figures are **rounded up (ceiling)** to safe values.
- Defaults from spec: safetyFactor=1.2, lossFactor=1.3, SPH=4–5, DoD=80% (Lithium) / 50% (VRLA), autonomyDays=1, wpPerPanel=550, systemVoltage choices 12/24/48.
- External port: **8005**; container listens internally on **80**.
- Files: `index.html`, `css/style.css`, `js/calculation.js`, `js/validation.js`, `js/storage.js`, `js/app.js`, `tests/*`, `Caddyfile`, `Dockerfile`, `docker-compose.yml`, `package.json`.
- Modules are **ES modules** (`"type": "module"` in package.json) so the same files run in browser and Node tests.

## Review Focus

1. **kWh→Wh conversion** — a user entering `30` kWh must yield the same results as the 30000 Wh worked example; a decimal like `2.5` kWh must work.
2. **DoD as fraction** — DoD is stored/displayed as percent but used as a fraction (0.8); a user entering `80` must not treat it as 0.8% nor as 80 (unitless) in the battery formula.
3. **Zero/empty/negative inputs** — validation must block these with an inline error and prevent calculation.
4. **SPH out of 1–10 range** — value is clamped to the range with a warning, still calculated.
5. **Autonomy days empty** — defaults to 1, not NaN.
6. **Storage unavailable** — IndexedDB failure falls back to localStorage without crashing; history/preferences still work.

---

### Task 1: Project scaffold + calculation module (TDD)

**Files:**
- Create: `package.json`
- Create: `js/calculation.js`
- Test: `tests/calculation.test.js`

**Interfaces:**
- Consumes: nothing (foundation).
- Produces: `calculateSizing(input)` and pure helpers used by later tasks.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "plts-kalkulator",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

- [ ] **Step 2: Write the failing test**

In `tests/calculation.test.js`, pin the exact worked example from PRD Section 10:

```js
import { calculateSizing, inverterWatts, panelWp, batteryAh, sccAmps, panelCount } from '../js/calculation.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('worked example from PRD section 10', () => {
  const r = calculateSizing({
    peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48,
    dod: 0.8, autonomyDays: 1, wpPerPanel: 550,
    safetyFactor: 1.2, lossFactor: 1.3,
  });
  assert.equal(r.inverterWatts, 6600);
  assert.equal(r.panelWp, 9750);
  assert.equal(r.panelCount, 18);
  assert.equal(r.batteryAh, 782);
  assert.equal(r.batteryKwh, 37.5);
  assert.equal(r.sccAmps, 204);
});

test('helpers return raw values', () => {
  assert.equal(inverterWatts(5500, 1.2), 6600);
  assert.equal(panelWp(30000, 4, 1.3), 9750);
  assert.equal(batteryAh(30000, 48, 0.8, 1), 781.25);
  assert.equal(sccAmps(9750, 48), 203.125);
  assert.equal(panelCount(9750, 550), 18);
});

test('defaults are applied when optional params omitted', () => {
  const r = calculateSizing({
    peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 0.8,
  });
  assert.equal(r.panelCount, 18);        // wpPerPanel defaults to 550
  assert.equal(r.inverterWatts, 6600);   // safetyFactor defaults 1.2
  assert.equal(r.panelWp, 9750);         // lossFactor defaults 1.3
  assert.equal(r.batteryAh, 782);        // autonomyDays defaults 1
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/calculation.test.js`
Expected: FAIL — module `../js/calculation.js` not found.

- [ ] **Step 4: Implement `js/calculation.js`**

ES module exporting pure functions. kWh→Wh conversion lives in `calculateSizing` (`energyWh = energyKwh * 1000`). Each output rounded up with `Math.ceil`; `batteryKwh = Math.round(rawBatteryAh * systemVoltage / 100) / 10` computed from the unrounded `batteryAh`.

```js
export const DEFAULT_SAFETY_FACTOR = 1.2;
export const DEFAULT_LOSS_FACTOR = 1.3;
export const DEFAULT_WP_PER_PANEL = 550;
export const DEFAULT_AUTONOMY_DAYS = 1;

export function inverterWatts(peakPower, safetyFactor = DEFAULT_SAFETY_FACTOR) {
  return peakPower * safetyFactor;
}
export function panelWp(energyWh, sph, lossFactor = DEFAULT_LOSS_FACTOR) {
  return (energyWh / sph) * lossFactor;
}
export function batteryAh(energyWh, systemVoltage, dod, autonomyDays = DEFAULT_AUTONOMY_DAYS) {
  return (energyWh / systemVoltage / dod) * autonomyDays;
}
export function sccAmps(panelWpTotal, systemVoltage) {
  return panelWpTotal / systemVoltage;
}
export function panelCount(panelWpTotal, wpPerPanel = DEFAULT_WP_PER_PANEL) {
  return Math.ceil(panelWpTotal / wpPerPanel);
}
export function calculateSizing({ peakPower, energyKwh, sph, systemVoltage, dod, autonomyDays, wpPerPanel, safetyFactor, lossFactor }) {
  const energyWh = energyKwh * 1000;
  const rawBattery = batteryAh(energyWh, systemVoltage, dod, autonomyDays);
  return {
    inverterWatts: Math.ceil(inverterWatts(peakPower, safetyFactor)),
    panelWp: Math.ceil(panelWp(energyWh, sph, lossFactor)),
    panelCount: panelCount(panelWp(energyWh, sph, lossFactor), wpPerPanel),
    batteryAh: Math.ceil(rawBattery),
    batteryKwh: Math.round((rawBattery * systemVoltage) / 100) / 10,
    sccAmps: Math.ceil(sccAmps(panelWp(energyWh, sph, lossFactor), systemVoltage)),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/calculation.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json js/calculation.js tests/calculation.test.js
git commit -m "feat: calculation module with TDD for PLTS sizing"
```

---

### Task 2: Validation module (TDD)

**Files:**
- Create: `js/validation.js`
- Test: `tests/validation.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateInput(input)` → `{ errors, warnings, normalized }` used by `app.js`.

- [ ] **Step 1: Write the failing test**

In `tests/validation.test.js`:

```js
import { validateInput } from '../js/validation.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('valid input passes with no errors', () => {
  const r = validateInput({
    peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 0.8, autonomyDays: 1,
  });
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.warnings, {});
  assert.equal(r.normalized.energyWh, 30000);
});

test('empty/zero/negative required fields produce errors', () => {
  const r = validateInput({ peakPower: 0, energyKwh: '', sph: -2, systemVoltage: 48, dod: 0.8 });
  assert.ok(r.errors.peakPower);
  assert.ok(r.errors.energyKwh);
  assert.ok(r.errors.sph);
});

test('SPH above 10 is clamped with a warning, still valid', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 15, systemVoltage: 48, dod: 0.8 });
  assert.equal(r.errors.sph, undefined);
  assert.ok(r.warnings.sph);
  assert.equal(r.normalized.sph, 10);
});

test('empty autonomyDays defaults to 1', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 0.8, autonomyDays: '' });
  assert.equal(r.normalized.autonomyDays, 1);
});

test('DoD 80 (percent) is normalized to 0.8 fraction', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 80 });
  assert.equal(r.normalized.dod, 0.8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validation.test.js`
Expected: FAIL — module `../js/validation.js` not found.

- [ ] **Step 3: Implement `js/validation.js`**

Pure function `validateInput(input)`. Returns `{ errors, warnings, normalized }`. Rules:
- `peakPower`, `energyKwh`, `sph`, `systemVoltage`, `dod` required; error if empty, `<= 0`, or `NaN`.
- `energyKwh` → normalized `energyWh = energyKwh * 1000`.
- `dod` accepted as fraction (≤1) or percent (>1 up to 90); normalized to fraction (`>1 ? /100 : value`). Error if normalized outside (0,1].
- `sph` clamped to [1,10]; warning when clamped.
- `autonomyDays` empty → `1`; else use value (clamp to [1,5]).
- `wpPerPanel` optional, default 550.
- Return `{ errors, warnings, normalized }` with normalized containing `peakPower, energyWh, sph, systemVoltage, dod, autonomyDays, wpPerPanel`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/validation.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/validation.js tests/validation.test.js
git commit -m "feat: input validation module with TDD"
```

---

### Task 3: Storage module with injectable adapter (TDD)

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createStorage(adapter)` returning `{ saveCalculation, getHistory, deleteHistory, clearHistory, savePreferences, getPreferences }`. A browser adapter is exported as `indexedDbAdapter` and a fallback as `localStorageAdapter`.

- [ ] **Step 1: Write the failing test**

In `tests/storage.test.js`, use an in-memory adapter to verify orchestration:

```js
import { createStorage } from '../js/storage.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function memoryAdapter() {
  const mem = { history: [], prefs: {} };
  return {
    async getAll(store) { return mem[store]; },
    async put(store, value) {
      if (store === 'history') { value.id = value.id ?? String(Date.now()); mem.history.push(value); }
      else { mem.prefs = value; }
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

test('savePreferences and getPreferences round-trip', async () => {
  const s = createStorage(memoryAdapter());
  await s.savePreferences({ peakPower: 5500, sph: 4 });
  const p = await s.getPreferences();
  assert.equal(p.peakPower, 5500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage.test.js`
Expected: FAIL — module `../js/storage.js` not found.

- [ ] **Step 3: Implement `js/storage.js`**

`createStorage(adapter)` returns async functions that delegate to the injected adapter (`getAll`, `put`, `delete`). `saveCalculation(entry)` stamps `timestamp = new Date().toISOString()` and a unique `id`, writes to `history`. `getHistory()` returns newest-first (sort by timestamp desc). Preferences stored as a single object under `preferences`. Export `indexedDbAdapter` (browser IndexedDB wrapper, only touching `indexedDB` global) and `localStorageAdapter` (falls back to `localStorage`). The adapter is the only code that touches browser globals; the orchestration functions stay pure of them.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/storage.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: storage module with injectable adapter (IndexedDB + fallback)"
```

---

### Task 4: HTML shell, Bootstrap, Alpine, HTMX, and CSS

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Consumes: `js/calculation.js`, `js/validation.js`, `js/storage.js`, `js/app.js` (loaded as modules in order).
- Produces: the DOM skeleton and Alpine `x-data="pltsApp"` component that `app.js` defines.

- [ ] **Step 1: Create `index.html`**

Single page with: `<head>` loading Bootstrap 5 CSS (CDN), Alpine.js (CDN), HTMX v4 (CDN), and `css/style.css`; a `<header>` with app title "Kalkulator PLTS 24 Jam"; a form inside `<div x-data="pltsApp()">` with fields bound via `x-model` (peakPower, energyKwh, sph, systemVoltage select, batteryType select that sets dod default, dod, autonomyDays, wpPerPanel); inline error `<div x-show="errors.peakPower">` for each field; a submit button "Hitung Kebutuhan"; a results `<section id="hasil">` rendered reactively with `x-show`/`x-text`; a "Riwayat" section with an Alpine-rendered list and HTMX template element for history items; and `<script type="module" src="js/app.js"></script>` at the end. Include `hx-ext="alpine-morph"` wiring where HTMX v4 swaps templates. Provide Indonesian labels and tooltips (`title`/Bootstrap tooltip) for SPH, DoD, tegangan sistem, and hari otonomi.

- [ ] **Step 2: Create `css/style.css`**

Light custom CSS on top of Bootstrap: mobile-first spacing, result card styling, and a subtle fade-in transition for the results section (used by Alpine `x-transition`).

- [ ] **Step 3: Verify page loads**

Run a static server and load in a headless browser (or `curl` the file to confirm valid structure). Confirm the four CDNs and module script are referenced.
Expected: `index.html` references Bootstrap 5, Alpine.js, HTMX v4, `css/style.css`, and `js/app.js`; all `x-` and `hx-` attributes are balanced.

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: HTML shell and styles with Bootstrap, Alpine, HTMX"
```

---

### Task 5: Alpine app wiring — reactive calculation + validation

**Files:**
- Create: `js/app.js`
- Modify: `index.html` (bind `x-data="pltsApp()"` component methods)

**Interfaces:**
- Consumes: `calculateSizing` (Task 1), `validateInput` (Task 2).
- Produces: Alpine component `pltsApp()` exposing `inputs`, `errors`, `warnings`, `results`, `hitung()`, `hitungLive()`, `loadPreferences()`, `savePreferences()`.

- [ ] **Step 1: Create `js/app.js`**

Define global `window.pltsApp = () => ({ ... })` Alpine data component:
- `inputs`: object with defaults (peakPower 5500, energyKwh 30, sph 4, systemVoltage 48, batteryType 'lithium', dod 0.8, autonomyDays 1, wpPerPanel 550).
- `batteryType` setter updates `dod` default (lithium→0.8, vrla→0.5).
- `hitung()`: calls `validateInput(inputs)`; if `errors` non-empty, render them and stop; else `results = calculateSizing(validated.normalized)`, save history + preferences (via storage from Task 3), reveal results section.
- `hitungLive()`: for convenience, validate non-blocking; used on change.
- `loadPreferences()`: on init, restore saved inputs; `savePreferences()` on hitung.
- Reactive results binding so `x-show="results"` and `x-text` display `results.inverterWatts`, etc.

- [ ] **Step 2: Wire into `index.html`**

Ensure the results section and each field's error message reference the correct Alpine bindings from `app.js`. Ensure `pltsApp()` is attached via `x-data` and `hitung` is called from the submit button (`@click="hitung()"` / form submit).

- [ ] **Step 3: Verify integration**

Run static server; in a browser (or via a headless check) confirm entering the Section 10 inputs and clicking "Hitung Kebutuhan" shows Inverter 6600 W, Panel 9750 WP / 18 lembar, Baterai 782 Ah / 37.5 kWh, SCC 204 A. Confirm no page reload.
Expected: results render and match the worked example.

- [ ] **Step 4: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: Alpine reactive wiring for validation and calculation"
```

---

### Task 6: History & preferences UI

**Files:**
- Modify: `index.html` (history list markup + HTMX template)
- Modify: `js/app.js` (history load/save/delete/restore)

**Interfaces:**
- Consumes: `createStorage` + browser adapter (Task 3), `calculateSizing` (Task 1).
- Produces: Alpine `history` array and methods `loadHistory()`, `restoreHistory(id)`, `removeHistory(id)`.

- [ ] **Step 1: Extend `js/app.js` with history methods**

- `history`: array of saved entries.
- `loadHistory()`: fetch via storage adapter and populate on init.
- `saveHistory()`: on successful `hitung()`, persist current result and refresh list.
- `restoreHistory(id)`: repopulate `inputs` from a history entry and recompute.
- `removeHistory(id)`: delete entry and refresh.
- `savePreferences()`: persist `inputs` on hitung; `loadPreferences()` restore on init.

- [ ] **Step 2: Add history UI to `index.html`**

A "Riwayat" section listing entries (timestamp + short summary) with "Buka" and "Hapus" buttons, rendered by Alpine (`x-for`) and/or HTMX v4 `hx-custom` template for items.

- [ ] **Step 3: Verify**

Load page, perform a calculation, confirm an entry appears in Riwayat; click "Buka" to restore inputs; click "Hapus" to remove it. Reload the page and confirm inputs are restored from preferences.
Expected: history persists across reload (IndexedDB) and preferences auto-fill the form.

- [ ] **Step 4: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: history and preferences UI backed by local storage"
```

---

### Task 7: Docker + Caddy deployment

**Files:**
- Create: `Caddyfile`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Modify: `.gitignore` (already ignores logs; confirm no new artifacts)

**Interfaces:**
- Consumes: all static files (index.html, css/, js/).
- Produces: runnable container exposing port 8005.

- [ ] **Step 1: Create `Caddyfile`**

```
:80 {
    root * /srv
    file_server
    encode gzip
}
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM caddy:alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html css js /srv/
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  plts:
    build: .
    container_name: plts-kalkulator
    ports:
      - "8005:80"
    restart: unless-stopped
```

- [ ] **Step 4: Build and run the container**

Run: `docker build -t plts-kalkulator .`
Run: `docker run -d --rm -p 8005:80 plts-kalkulator`
Expected: container starts and serves.

- [ ] **Step 5: Verify remote access**

Run: `curl -s http://localhost:8005/ | head`
Expected: HTML served; `curl -s http://localhost:8005/js/calculation.js` returns JS; `curl -s -o /dev/null -w "%{http_code}" http://localhost:8005/` returns `200`.

- [ ] **Step 6: Commit**

```bash
git add Caddyfile Dockerfile docker-compose.yml
git commit -m "feat: Docker deployment with Caddy on port 8005"
```

---

### Task 8: Full-suite verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run the full Node test suite**

Run: `npm test`
Expected: all tests in `tests/` pass (calculation, validation, storage).

- [ ] **Step 2: Smoke-test the running container**

Run: `curl -s http://localhost:8005/` and verify the served HTML references the CDNs and `js/app.js`; verify `js/calculation.js`, `js/validation.js`, `js/storage.js`, `js/app.js`, `css/style.css` all return `200`.
Expected: all assets served with `200`.

- [ ] **Step 3: Commit any residual changes**

```bash
git status
git add -A
git commit -m "chore: final verification pass" || echo "no changes"
```
