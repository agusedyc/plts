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

test('SPH below 1 is clamped to 1 with a warning, still valid', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 0.5, systemVoltage: 48, dod: 0.8 });
  assert.equal(r.errors.sph, undefined);
  assert.ok(r.warnings.sph);
  assert.equal(r.normalized.sph, 1);
});

test('empty autonomyDays defaults to 1', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 0.8, autonomyDays: '' });
  assert.equal(r.normalized.autonomyDays, 1);
});

test('DoD 80 (percent) is normalized to 0.8 fraction', () => {
  const r = validateInput({ peakPower: 5500, energyKwh: 30, sph: 4, systemVoltage: 48, dod: 80 });
  assert.equal(r.normalized.dod, 0.8);
});
