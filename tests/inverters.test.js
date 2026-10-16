import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_INVERTERS, findInverterById, filterInvertersByVoltage } from '../js/inverters.js';
import { panelStringConfig } from '../js/calculation.js';

test('data/inverters.json contains valid configurations for all popular inverters', () => {
  const jsonPath = path.resolve(process.cwd(), 'data/inverters.json');
  assert.ok(fs.existsSync(jsonPath), 'data/inverters.json must exist');

  const inverters = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(inverters.length, 20);

  // Every inverter must specify systemVoltage 12, 24, or 48 and have priceIdr > 0
  inverters.forEach(inv => {
    assert.ok([12, 24, 48].includes(inv.systemVoltage), `Inverter ${inv.id} must have valid systemVoltage`);
    assert.ok(Number(inv.priceIdr) > 0, `Inverter ${inv.id} must have priceIdr`);
  });

  const ils3800 = inverters.find(i => i.id === 'ils-3800');
  assert.ok(ils3800);
  assert.equal(ils3800.ratedWatts, 3000);
  assert.equal(ils3800.systemVoltage, 24);
  assert.equal(ils3800.mpptMinVoltage, 30);
  assert.equal(ils3800.mpptMaxVoltage, 245);
  assert.equal(ils3800.mpptMaxCurrent, 100);
  assert.equal(ils3800.mpptCount, 1);

  const ils6300 = inverters.find(i => i.id === 'ils-6300');
  assert.ok(ils6300);
  assert.equal(ils6300.ratedWatts, 5000);
  assert.equal(ils6300.systemVoltage, 48);
  assert.equal(ils6300.mpptMinVoltage, 60);
  assert.equal(ils6300.mpptMaxVoltage, 245);
  assert.equal(ils6300.mpptMaxCurrent, 100);
  assert.equal(ils6300.mpptCount, 1);

  const srne = inverters.find(i => i.id === 'srne-5k');
  assert.ok(srne);
  assert.equal(srne.ratedWatts, 5000);
  assert.equal(srne.mpptMinVoltage, 60);
  assert.equal(srne.mpptMaxVoltage, 245);
  assert.equal(srne.mpptMaxCurrent, 100);
  assert.equal(srne.mpptCount, 1);

  const growatt = inverters.find(i => i.id === 'growatt-spf5000es');
  assert.ok(growatt);
  assert.equal(growatt.mpptMinVoltage, 120);
  assert.equal(growatt.mpptMaxVoltage, 450);
  assert.equal(growatt.mpptMaxCurrent, 22);

  const deye = inverters.find(i => i.id === 'deye-sun-5k');
  assert.ok(deye);
  assert.equal(deye.mpptCount, 2);
  assert.equal(deye.mpptMinVoltage, 125);
  assert.equal(deye.mpptMaxVoltage, 500);

  const zamdon = inverters.find(i => i.id === 'zamdon-5k5-48v');
  assert.ok(zamdon);
  assert.equal(zamdon.brand, 'Zamdon');
  assert.equal(zamdon.ratedWatts, 5500);
  assert.equal(zamdon.systemVoltage, 48);
  assert.equal(zamdon.mpptMaxCurrent, 100);

  const prime = inverters.find(i => i.id === 'prime-3k-24v');
  assert.ok(prime);
  assert.equal(prime.brand, 'Prime');
  assert.equal(prime.ratedWatts, 3000);
  assert.equal(prime.systemVoltage, 24);
});

test('Growatt HV selects 6S 1P for 6 panels, whereas SRNE LV selects 3S 2P', () => {
  const growatt = findInverterById('growatt-spf5000es');
  const srne = findInverterById('srne-5k');

  // 6 panels Solana 550Wp (Vmp 42.1V, Voc 50.1V, Imp 13.06A)
  const cfgGrowatt = panelStringConfig(6, {
    vmp: 42.1,
    voc: 50.1,
    imp: 13.06,
    mpptMinVoltage: growatt.mpptMinVoltage,
    mpptMaxVoltage: growatt.mpptMaxVoltage,
    mpptMaxCurrent: growatt.mpptMaxCurrent,
    mpptCount: growatt.mpptCount,
  });

  // Growatt 450V max can safely handle 6S (Voc 300.6V < 450V, Imp 13.06A <= 22A)
  assert.equal(cfgGrowatt.series, 6);
  assert.equal(cfgGrowatt.parallel, 1);
  assert.equal(cfgGrowatt.mpptVoltageStatus, 'safe');
  assert.equal(cfgGrowatt.mpptCurrentStatus, 'safe');

  // SRNE 245V max cannot take 6S (Voc 300.6V > 245V), must split to 3S 2P
  const cfgSrne = panelStringConfig(6, {
    vmp: 42.1,
    voc: 50.1,
    imp: 13.06,
    mpptMinVoltage: srne.mpptMinVoltage,
    mpptMaxVoltage: srne.mpptMaxVoltage,
    mpptMaxCurrent: srne.mpptMaxCurrent,
    mpptCount: srne.mpptCount,
  });

  assert.equal(cfgSrne.series, 3);
  assert.equal(cfgSrne.parallel, 2);
  assert.equal(cfgSrne.mpptVoltageStatus, 'safe');
  assert.equal(cfgSrne.mpptCurrentStatus, 'safe');
});

test('ILS3800 24V and ILS6300 48V findInverterById work as expected', () => {
  const ils3800 = findInverterById('ils-3800');
  assert.ok(ils3800);
  assert.equal(ils3800.ratedWatts, 3000);
  assert.equal(ils3800.systemVoltage, 24);
  assert.equal(ils3800.mpptMinVoltage, 30);
  assert.equal(ils3800.mpptMaxVoltage, 245);
  assert.equal(ils3800.mpptMaxCurrent, 100);

  const ils6300 = findInverterById('ils-6300');
  assert.ok(ils6300);
  assert.equal(ils6300.ratedWatts, 5000);
  assert.equal(ils6300.systemVoltage, 48);
  assert.equal(ils6300.mpptMinVoltage, 60);
  assert.equal(ils6300.mpptMaxVoltage, 245);
  assert.equal(ils6300.mpptMaxCurrent, 100);
});

test('filterInvertersByVoltage correctly groups inverters by 12V, 24V, and 48V', () => {
  const inv12 = filterInvertersByVoltage(12);
  assert.equal(inv12.length, 4);
  assert.ok(inv12.every(i => i.systemVoltage === 12));
  assert.ok(inv12.some(i => i.id === 'must-pv18-1k-12v'));
  assert.ok(inv12.some(i => i.id === 'powmr-1k5-12v'));
  assert.ok(inv12.some(i => i.id === 'prime-1k2-12v'));
  assert.ok(inv12.some(i => i.id === 'zamdon-1k2-12v'));

  const inv24 = filterInvertersByVoltage(24);
  assert.equal(inv24.length, 6);
  assert.ok(inv24.every(i => i.systemVoltage === 24));
  assert.ok(inv24.some(i => i.id === 'ils-3800'));
  assert.ok(inv24.some(i => i.id === 'must-pv18-3k-24v'));
  assert.ok(inv24.some(i => i.id === 'growatt-spf3500es'));
  assert.ok(inv24.some(i => i.id === 'prime-3k-24v'));
  assert.ok(inv24.some(i => i.id === 'zamdon-3k2-24v'));

  const inv48 = filterInvertersByVoltage(48);
  assert.equal(inv48.length, 10);
  assert.ok(inv48.every(i => i.systemVoltage === 48));
  assert.ok(inv48.some(i => i.id === 'srne-5k'));
  assert.ok(inv48.some(i => i.id === 'ils-6300'));
  assert.ok(inv48.some(i => i.id === 'growatt-spf5000es'));
  assert.ok(inv48.some(i => i.id === 'prime-5k-48v'));
  assert.ok(inv48.some(i => i.id === 'zamdon-5k5-48v'));
});
