import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PANELS, findPanelById } from '../js/panels.js';
import { calculateSizing } from '../js/calculation.js';

test('data/panels.json contains valid specs for all requested panels', () => {
  const jsonPath = path.resolve(process.cwd(), 'data/panels.json');
  assert.ok(fs.existsSync(jsonPath), 'data/panels.json must exist');

  const panels = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(panels.length, 8);

  // Every panel must have priceIdr > 0
  panels.forEach(p => {
    assert.ok(Number(p.priceIdr) > 0, `Panel ${p.id} must have priceIdr`);
  });

  const solana = panels.find(p => p.id === 'solana-550');
  assert.ok(solana);
  assert.equal(solana.wp, 550);
  assert.equal(solana.vmp, 42.1);
  assert.equal(solana.imp, 13.06);
  assert.equal(solana.voc, 50.1);
  assert.equal(solana.isc, 13.90);

  const lesso550 = panels.find(p => p.id === 'lesso-550');
  assert.ok(lesso550);
  assert.equal(lesso550.wp, 550);
  assert.equal(lesso550.vmp, 42.0);
  assert.equal(lesso550.imp, 13.10);
  assert.equal(lesso550.voc, 49.82);
  assert.equal(lesso550.isc, 13.97);

  const lesso580 = panels.find(p => p.id === 'lesso-580');
  assert.ok(lesso580);
  assert.equal(lesso580.wp, 580);
  assert.equal(lesso580.vmp, 42.75);
  assert.equal(lesso580.imp, 13.57);
  assert.equal(lesso580.voc, 51.43);
  assert.equal(lesso580.isc, 14.33);

  const trina620 = panels.find(p => p.id === 'trina-620');
  assert.ok(trina620);
  assert.equal(trina620.wp, 620);
  assert.equal(trina620.vmp, 41.4);
  assert.equal(trina620.imp, 14.99);
  assert.equal(trina620.voc, 49.6);
  assert.equal(trina620.isc, 15.91);

  const trina630 = panels.find(p => p.id === 'trina-630');
  assert.ok(trina630);
  assert.equal(trina630.wp, 630);
  assert.equal(trina630.vmp, 40.68);
  assert.equal(trina630.imp, 15.49);
  assert.equal(trina630.voc, 48.9);
  assert.equal(trina630.isc, 16.38);

  const trina720 = panels.find(p => p.id === 'trina-720');
  assert.ok(trina720);
  assert.equal(trina720.wp, 720);
  assert.equal(trina720.vmp, 41.3);
  assert.equal(trina720.imp, 17.44);
  assert.equal(trina720.voc, 49.4);
  assert.equal(trina720.isc, 18.49);
});

test('findPanelById retrieves panel specs from DEFAULT_PANELS', () => {
  const p = findPanelById('trina-720');
  assert.ok(p);
  assert.equal(p.wp, 720);
  assert.equal(p.vmp, 41.3);
});

test('calculateSizing works with Trina 720Wp panel specs', () => {
  const trina = findPanelById('trina-720');
  const r = calculateSizing({
    powerVa: 2200,
    energyWh: 10000,
    sph: 4.5,
    wpPerPanel: trina.wp,
    panelVmp: trina.vmp,
    panelVoc: trina.voc,
    panelImp: trina.imp,
    panelIsc: trina.isc,
    mpptMinVoltage: 60,
    mpptMaxVoltage: 245,
    mpptMaxCurrent: 100,
  });

  assert.equal(r.wpPerPanel, 720);
  assert.equal(r.panelVmp, 41.3);
  assert.equal(r.panelVoc, 49.4);
  assert.equal(r.panelImp, 17.44);
  assert.equal(r.panelIsc, 18.49);
  assert.ok(r.panelCount >= 4);
  assert.equal(r.stringConfig.mpptVoltageStatus, 'safe');
  assert.equal(r.stringConfig.mpptCurrentStatus, 'safe');
});
