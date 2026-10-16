import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BATTERIES, findBatteryById, filterBatteriesByVoltage } from '../js/batteries.js';

test('data/batteries.json contains valid configurations for all batteries with prices', () => {
  const jsonPath = path.resolve(process.cwd(), 'data/batteries.json');
  assert.ok(fs.existsSync(jsonPath), 'data/batteries.json must exist');

  const batteries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(batteries.length >= 14);

  batteries.forEach((bat) => {
    assert.ok([12, 24, 48].includes(bat.systemVoltage), `Battery ${bat.id} must have valid systemVoltage`);
    assert.ok(bat.ah > 0, `Battery ${bat.id} must have ah > 0`);
    assert.ok(bat.priceIdr > 0, `Battery ${bat.id} must have priceIdr > 0`);
  });

  const shoto = batteries.find((b) => b.id === 'shoto-48v-100ah');
  assert.ok(shoto);
  assert.equal(shoto.systemVoltage, 48);
  assert.equal(shoto.ah, 100);
  assert.equal(shoto.priceIdr, 12500000);

  const deye = batteries.find((b) => b.id === 'deye-se-g51');
  assert.ok(deye);
  assert.equal(deye.voltage, 51.2);
  assert.equal(deye.systemVoltage, 48);
  assert.equal(deye.priceIdr, 17800000);

  const eve314 = batteries.find((b) => b.id === 'eve-51v2-314ah');
  assert.ok(eve314);
  assert.equal(eve314.voltage, 51.2);
  assert.equal(eve314.systemVoltage, 48);
  assert.equal(eve314.ah, 314);
});

test('filterBatteriesByVoltage groups 51.2V models under 48V system', () => {
  const bat48 = filterBatteriesByVoltage(48);
  assert.ok(bat48.length >= 8);
  // All must be part of 48V system
  assert.ok(bat48.every((b) => b.systemVoltage === 48 || b.voltage === 48 || b.voltage === 51.2));
  assert.ok(bat48.some((b) => b.id === 'deye-se-g51' && b.voltage === 51.2));
  assert.ok(bat48.some((b) => b.id === 'eve-51v2-280ah' && b.voltage === 51.2));
  assert.ok(bat48.some((b) => b.id === 'shoto-48v-100ah'));

  const bat24 = filterBatteriesByVoltage(24);
  assert.ok(bat24.length >= 3);
  assert.ok(bat24.every((b) => b.systemVoltage === 24 || b.voltage === 24 || b.voltage === 25.6));

  const bat12 = filterBatteriesByVoltage(12);
  assert.ok(bat12.length >= 3);
  assert.ok(bat12.every((b) => b.systemVoltage === 12 || b.voltage === 12 || b.voltage === 12.8));
});

test('findBatteryById returns matching battery or null', () => {
  const b = findBatteryById('shoto-48v-100ah');
  assert.ok(b);
  assert.equal(b.brand, 'Shoto');

  assert.equal(findBatteryById('non-existent'), null);
});
