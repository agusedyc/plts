import { calculateSizing, inverterWatts, panelWp, batteryAh, sccAmps, panelCount } from '../js/calculation.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('worked example from PRD section 10', () => {
  const r = calculateSizing({
    peakPower: 5500, energyWh: 30000, sph: 4, systemVoltage: 48,
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
    peakPower: 5500, energyWh: 30000, sph: 4, systemVoltage: 48, dod: 0.8,
  });
  assert.equal(r.panelCount, 18);        // wpPerPanel defaults to 550
  assert.equal(r.inverterWatts, 6600);   // safetyFactor defaults 1.2
  assert.equal(r.panelWp, 9750);         // lossFactor defaults 1.3
  assert.equal(r.batteryAh, 782);        // autonomyDays defaults 1
});
