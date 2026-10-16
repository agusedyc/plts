import {
  calculateSizing,
  inverterWatts,
  panelWp,
  batteryAh,
  sccAmps,
  panelCount,
  vaToWatts,
  dailyEnergyRealistic,
  dailyEnergyFromAppliances,
  batteryModules,
  panelStringConfig,
  wiringSizing,
  alternativeChargingHours,
  getMpptProfileForInverter,
  minPanelsForMppt,
  minBatteryAhForInverter,
  calculateElectricityCost,
  plnMcbAmps,
  inverterAcMcbAmps,
  calculateBracketCost,
  calculateSystemBOM,
  calculateBatteryRuntime,
  calculatePlnCharging,
  calculatePartialPvProduction,
} from '../js/calculation.js';
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

test('vaToWatts converts apparent power using power factor 0.8', () => {
  assert.equal(vaToWatts(1300, 0.8), 1040);
  assert.equal(vaToWatts(2200), 1760);
});

test('dailyEnergyRealistic calculates 24h consumption with 80% load factor', () => {
  assert.equal(dailyEnergyRealistic(1040, 0.8, 24), 19968);
});

test('dailyEnergyFromAppliances sums energy of each appliance', () => {
  const items = [
    { name: 'Kulkas', watts: 150, hours: 24, qty: 1 },
    { name: 'Lampu LED', watts: 20, hours: 10, qty: 5 },
  ];
  assert.equal(dailyEnergyFromAppliances(items), 4600);
});

test('batteryModules calculates units needed based on module capacity', () => {
  assert.equal(batteryModules(520, 200), 3);
  assert.equal(batteryModules(520, 100), 6);
});

test('panelStringConfig splits 12 panels into 4S 3P array with default 60-245V MPPT', () => {
  const cfg = panelStringConfig(12, { vmp: 42, imp: 13 });
  assert.equal(cfg.series, 4);
  assert.equal(cfg.parallel, 3);
  assert.equal(cfg.totalVmp, 168);
  assert.equal(cfg.totalImp, 39);
  assert.equal(cfg.mpptVoltageStatus, 'safe');
});

test('panelStringConfig splits 12 panels into 6S 2P array with high-voltage 500V MPPT', () => {
  const cfg = panelStringConfig(12, { vmp: 42, imp: 13, mpptMaxVoltage: 500 });
  assert.equal(cfg.series, 6);
  assert.equal(cfg.parallel, 2);
  assert.equal(cfg.totalVmp, 252);
  assert.equal(cfg.totalImp, 26);
  assert.equal(cfg.mpptVoltageStatus, 'safe');
});

test('panelStringConfig detects under-voltage and over-voltage MPPT conditions', () => {
  // 2 panels: 2 * 42 = 84V (< 120V startup)
  const under = panelStringConfig(2, { vmp: 42, mpptMinVoltage: 120 });
  assert.equal(under.mpptVoltageStatus, 'under');
  assert.ok(under.warnings.some(w => w.includes('startup')));

  // 12 panels in 1 string: 12 * 49.5 = 594V (> 500V max)
  const over = panelStringConfig(12, { vmp: 42, voc: 49.5, mpptMinVoltage: 120, mpptMaxVoltage: 450 });
  // Should choose 6S 2P (6*49.5=297V) which is safe:
  assert.equal(over.series, 6);
  assert.equal(over.parallel, 2);
  assert.equal(over.mpptVoltageStatus, 'safe');
});

test('wiringSizing calculates safe MCB and cable sizes', () => {
  const wiring = wiringSizing({
    stringImp: 13,
    totalImp: 26,
    batteryPowerWatts: 4000,
    systemVoltage: 48,
    sf: 1.25,
  });
  assert.equal(wiring.pv.stringMcbAmps, 20);
  assert.equal(wiring.pv.stringCableMm2, 6);
  assert.equal(wiring.pv.arrayMcbAmps, 40);
  assert.equal(wiring.pv.arrayCableMm2, 10);
  assert.equal(wiring.battery.mcbAmps, 125);
  assert.equal(wiring.battery.cableMm2, 25);
});

test('alternativeChargingHours calculates duration based on charging watts and efficiency', () => {
  // 20,000 Wh with 1040 W charger at 85% efficiency (884 W effective): 20000 / 884 = 22.6 hours
  assert.equal(alternativeChargingHours(20000, 1040, 0.85), 22.6);
  assert.equal(alternativeChargingHours(0, 1000), 0);
  assert.equal(alternativeChargingHours(20000, 0), 0);
});

test('full 1300 VA system calculation match Jago Listrik benchmark', () => {
  const r = calculateSizing({
    powerVa: 1300,
    peakPower: 1040,
    energyWh: 20000,
    sph: 4.5,
    systemVoltage: 48,
    dod: 0.8,
    autonomyDays: 1,
    wpPerPanel: 550,
    panelVmp: 42,
    panelImp: 13,
    panelVoc: 49.5,
    lossFactor: 1.2,
    moduleAh: 200,
    mpptMinVoltage: 120,
    mpptMaxVoltage: 500,
  });

  assert.equal(r.peakPowerWatts, 1040);
  assert.equal(r.alternativeChargingHours, 22.6);
  assert.equal(r.batteryAhBase, 417);
  assert.equal(r.batteryAh, 521);
  assert.equal(r.batteryModules, 3);
  assert.equal(r.panelWpBase, 4445);
  assert.equal(r.panelWp, 5334);
  assert.equal(r.panelCount, 12); // rounded up to balanced even configuration (6S 2P with 500V MPPT)
  assert.equal(r.stringConfig.series, 6);
  assert.equal(r.stringConfig.parallel, 2);
  assert.equal(r.stringConfig.totalVmp, 252);
  assert.equal(r.stringConfig.totalImp, 26);
  assert.equal(r.wiring.pv.stringMcbAmps, 20);
  assert.equal(r.wiring.pv.stringCableMm2, 6);
  assert.equal(r.wiring.battery.mcbAmps, 125);
  assert.equal(r.wiring.battery.cableMm2, 25);
});

test('getMpptProfileForInverter returns appropriate profile based on rated wattage', () => {
  const p3k = getMpptProfileForInverter(3000);
  assert.equal(p3k.mpptCount, 1);
  assert.equal(p3k.mpptMinVoltage, 60);
  assert.equal(p3k.mpptMaxVoltage, 245);
  assert.equal(p3k.mpptMaxCurrent, 100);

  const p5k = getMpptProfileForInverter(5000);
  assert.equal(p5k.mpptCount, 1);
  assert.equal(p5k.mpptMinVoltage, 60);
  assert.equal(p5k.mpptMaxVoltage, 245);
  assert.equal(p5k.mpptMaxCurrent, 100);

  const p8k = getMpptProfileForInverter(8000);
  assert.equal(p8k.mpptCount, 2);
  assert.equal(p8k.mpptMinVoltage, 120);
  assert.equal(p8k.mpptMaxVoltage, 500);
  assert.equal(p8k.mpptMaxCurrent, 50);
});

test('changing inverterRatedWatts changes panel string configuration', () => {
  // 6 panels with 3000W inverter (1 MPPT, 60-245V, max 100A):
  // 6S Voc = 297V > 245V (unsafe), so it selects 3S 2P (Voc 148.5V, Imp 26A safe)
  const cfg3k = panelStringConfig(6, {
    vmp: 42,
    voc: 49.5,
    imp: 13,
    ...getMpptProfileForInverter(3000),
  });
  assert.equal(cfg3k.series, 3);
  assert.equal(cfg3k.parallel, 2);
  assert.equal(cfg3k.mpptVoltageStatus, 'safe');
  assert.equal(cfg3k.mpptCurrentStatus, 'safe');

  // 6 panels with 5000W inverter default (1 MPPT, 60-245V, max 100A):
  // 2P gives 26A per MPPT <= 100A (safe), preferred 3S 2P
  const cfg5k1Mppt = panelStringConfig(6, {
    vmp: 42,
    voc: 49.5,
    imp: 13,
    ...getMpptProfileForInverter(5000),
  });
  assert.equal(cfg5k1Mppt.series, 3);
  assert.equal(cfg5k1Mppt.parallel, 2);
  assert.equal(cfg5k1Mppt.currentPerMppt, 26);
  assert.equal(cfg5k1Mppt.mpptVoltageStatus, 'safe');
  assert.equal(cfg5k1Mppt.mpptCurrentStatus, 'safe');

  // 6 panels with 8000W inverter (2 MPPT, 120-500V, max 50A):
  // 2P gives 1 string per MPPT (13A per tracker, safe), preferred 3S 2P
  const cfg8k = panelStringConfig(6, {
    vmp: 42,
    voc: 49.5,
    imp: 13,
    ...getMpptProfileForInverter(8000),
  });
  assert.equal(cfg8k.series, 3);
  assert.equal(cfg8k.parallel, 2);
  assert.equal(cfg8k.currentPerMppt, 13);
  assert.equal(cfg8k.mpptVoltageStatus, 'safe');
  assert.equal(cfg8k.mpptCurrentStatus, 'safe');
});

test('calculateSizing uses custom panel specs (vmp, voc, imp) for string sizing and wiring', () => {
  const r = calculateSizing({
    powerVa: 1300,
    peakPower: 1040,
    energyWh: 20000,
    wpPerPanel: 450,
    panelVmp: 35,
    panelVoc: 42,
    panelImp: 11,
    mpptMaxVoltage: 500,
  });
  // 14 panels (450W each), 7S 2P:
  assert.equal(r.panelCount, 14);
  assert.equal(r.stringConfig.series, 7);
  assert.equal(r.stringConfig.parallel, 2);
  assert.equal(r.stringConfig.totalVmp, 245);
  assert.equal(r.stringConfig.totalVoc, 294);
  assert.equal(r.stringConfig.totalImp, 22);
  assert.equal(r.wiring.pv.stringDesignCurrent, 13.8);
});

test('minPanelsForMppt calculates minimum panels required for inverter MPPT startup', () => {
  // 60V MPPT with 42.1V panel -> ceil(60 / 42.1) = 2 panels
  assert.equal(minPanelsForMppt(60, 42.1), 2);
  // 120V MPPT with 42.1V panel -> ceil(120 / 42.1) = 3 panels
  assert.equal(minPanelsForMppt(120, 42.1), 3);
  // 150V MPPT with 41.3V panel -> ceil(150 / 41.3) = 4 panels
  assert.equal(minPanelsForMppt(150, 41.3), 4);
});

test('minBatteryAhForInverter enforces safe hardware capacity for inverter power rating', () => {
  // 3kW inverter at 48V -> min 100 Ah
  assert.equal(minBatteryAhForInverter(3000, 48), 100);
  // 5kW inverter at 48V -> min 200 Ah
  assert.equal(minBatteryAhForInverter(5000, 48), 200);
  // 8kW inverter at 48V -> min 300 Ah
  assert.equal(minBatteryAhForInverter(8000, 48), 300);
  // 10kW inverter at 48V -> min 400 Ah
  assert.equal(minBatteryAhForInverter(10000, 48), 400);
});

test('calculateSizing clamps panelCount and batteryAh to hardware technical minimums for small loads', () => {
  const r = calculateSizing({
    powerVa: 2200,
    energyWh: 1000, // very small energy load
    sph: 4.5,
    systemVoltage: 48,
    wpPerPanel: 550,
    panelVmp: 42.1,
    inverterRatedWatts: 5000, // 5kW inverter
    mpptMinVoltage: 60,
  });

  // Raw panel count would be 1, but minPanelsForMppt(60, 42.1) = 2
  assert.equal(r.minPanelsForMppt, 2);
  assert.ok(r.panelCount >= 2);

  // Raw battery Ah would be 1000 / 48 / 0.8 = 27 Ah, but minBatteryAhForInverter(5000, 48) = 200 Ah
  assert.equal(r.minBatteryAh, 200);
  assert.equal(r.batteryAh, 200);
  assert.equal(r.batteryModules, 1); // 1x 200Ah
});

test('calculateElectricityCost calculates PLN cost with PPN 12%, PPJ 10%, and monthly multiplier (30 and 31 days)', () => {
  // 5.1 kWh daily
  // base = 5.1 * 1444.7 = 7367.97
  // ppn = 7367.97 * 0.12 = 884.1564
  // ppj = 7367.97 * 0.10 = 736.797
  // totalDaily = 7367.97 + 884.1564 + 736.797 = 8988.9234 -> round 8989
  // monthly (30 days) = 8988.9234 * 30 = 269667.702 -> round 269668
  // monthly (31 days) = 8988.9234 * 31 = 278656.6254 -> round 278657

  const cost30 = calculateElectricityCost(5.1, {
    tariffPerKwh: 1444.7,
    ppnPercent: 12,
    ppjPercent: 10,
    billingDays: 30,
  });

  assert.equal(cost30.energyKwh, 5.1);
  assert.equal(cost30.tariff, 1444.7);
  assert.equal(cost30.ppnPercent, 12);
  assert.equal(cost30.ppjPercent, 10);
  assert.equal(cost30.billingDays, 30);
  assert.equal(cost30.baseCostDaily, 7368);
  assert.equal(cost30.ppnDaily, 884);
  assert.equal(cost30.ppjDaily, 737);
  assert.equal(cost30.totalCostDaily, 8989);
  assert.equal(cost30.monthlyKwh, 153);
  assert.equal(cost30.totalCostMonthly, 269668);

  const cost31 = calculateElectricityCost(5.1, {
    tariffPerKwh: 1444.7,
    ppnPercent: 12,
    ppjPercent: 10,
    billingDays: 31,
  });

  assert.equal(cost31.billingDays, 31);
  assert.equal(cost31.monthlyKwh, 158.1);
  assert.equal(cost31.totalCostMonthly, 278657);

  // Custom tariff test
  const custom = calculateElectricityCost(10, {
    tariffPerKwh: 1500,
    ppnPercent: 11,
    ppjPercent: 5,
    billingDays: 30,
  });
  // base = 15000
  // ppn = 1650
  // ppj = 750
  // total = 17400
  // monthly = 522000
  assert.equal(custom.baseCostDaily, 15000);
  assert.equal(custom.ppnDaily, 1650);
  assert.equal(custom.ppjDaily, 750);
  assert.equal(custom.totalCostDaily, 17400);
  assert.equal(custom.totalCostMonthly, 522000);
});

test('plnMcbAmps returns standard PLN MCB rating for VA tier', () => {
  assert.equal(plnMcbAmps(450), 2);
  assert.equal(plnMcbAmps(900), 4);
  assert.equal(plnMcbAmps(1300), 6);
  assert.equal(plnMcbAmps(2200), 10);
  assert.equal(plnMcbAmps(3500), 16);
  assert.equal(plnMcbAmps(4400), 20);
  assert.equal(plnMcbAmps(5500), 25);
});

test('inverterAcMcbAmps returns proper AC output MCB rating based on rated watts', () => {
  assert.equal(inverterAcMcbAmps(1000), 6);
  assert.equal(inverterAcMcbAmps(3000), 20); // 3000/220*1.25 = 17A -> 20A
  assert.equal(inverterAcMcbAmps(5000), 32); // 5000/220*1.25 = 28.4A -> 32A
});

test('calculateBracketCost calculates mounting rail cost based on panel count and physical size (Wp)', () => {
  // Small panel (<400 Wp) -> 150.000 / panel
  const small = calculateBracketCost(4, 300);
  assert.equal(small.unitCost, 150000);
  assert.equal(small.totalCost, 600000);
  assert.equal(small.sizeCategory, 'Kecil/Sedang (<400 Wp)');

  // Standard panel (400 - 590 Wp, e.g. 550Wp) -> 220.000 / panel
  const std = calculateBracketCost(6, 550);
  assert.equal(std.unitCost, 220000);
  assert.equal(std.totalCost, 1320000);
  assert.equal(std.sizeCategory, 'Standar (400–590 Wp)');

  // Jumbo panel (>=600 Wp, e.g. 720Wp) -> 275.000 / panel
  const jumbo = calculateBracketCost(4, 720);
  assert.equal(jumbo.unitCost, 275000);
  assert.equal(jumbo.totalCost, 1100000);
  assert.equal(jumbo.sizeCategory, 'Jumbo (≥600 Wp)');

  // Custom unit cost override
  const custom = calculateBracketCost(5, 550, 180000);
  assert.equal(custom.unitCost, 180000);
  assert.equal(custom.totalCost, 900000);
  assert.equal(custom.sizeCategory, 'Kustom');
});

test('calculateSystemBOM sums all components and computes ROI/BEP against monthly PLN savings', () => {
  const bom = calculateSystemBOM({
    panelCost: 6600000,
    bracketCost: 880000,
    inverterCost: 8800000,
    batteryCost: 23800000,
    bosCost: 2500000,
    installationCost: 1500000,
    monthlyPlnSavings: 270000,
  });

  // Grand total: 6.6M + 880k + 8.8M + 23.8M + 2.5M + 1.5M = 44.080.000
  assert.equal(bom.grandTotal, 44080000);
  // BEP months: 44080000 / 270000 = 163.259... -> 163.3
  assert.equal(bom.bepMonths, 163.3);
  // BEP years: 163.3 / 12 = 13.6
  assert.equal(bom.bepYears, 13.6);
});

test('calculateSystemBOM handles 0 panel / 0 savings in pure UPS backup mode', () => {
  const bom = calculateSystemBOM({
    panelCost: 0,
    bracketCost: 0,
    inverterCost: 8800000,
    batteryCost: 23800000,
    bosCost: 2500000,
    installationCost: 1000000,
    monthlyPlnSavings: 0,
  });

  assert.equal(bom.grandTotal, 36100000);
  assert.equal(bom.panelCost, 0);
  assert.equal(bom.bracketCost, 0);
  assert.equal(bom.monthlySavings, 0);
  assert.equal(bom.bepMonths, 0);
  assert.equal(bom.bepYears, 0);
});

test('calculateBatteryRuntime simulates backup duration with custom battery capacity', () => {
  // 200Ah at 48V, load 1040W, DoD 80%, inv eff 90%
  // usableWh = 200 * 48 * 0.8 * 0.9 = 6912 Wh
  // runtimeHours = 6912 / 1040 = 6.646... -> 6.6 jam
  const res = calculateBatteryRuntime({
    actualBatteryAh: 200,
    systemVoltage: 48,
    dod: 0.8,
    loadWatts: 1040,
    inverterEfficiency: 0.9,
  });

  assert.equal(res.usableWh, 6912);
  assert.equal(res.runtimeHours, 6.6);
  assert.equal(res.targetHours, 24);
  assert.equal(res.deficitHours, 17.4);
  assert.equal(res.percentageOf24h, 28);
  assert.equal(res.status, 'kurang');

  // Edge case: 0 Ah or 0 load
  const zeroAh = calculateBatteryRuntime({ actualBatteryAh: 0, loadWatts: 1000 });
  assert.equal(zeroAh.usableWh, 0);
  assert.equal(zeroAh.runtimeHours, 0);
  assert.equal(zeroAh.deficitHours, 24);

  const zeroLoad = calculateBatteryRuntime({ actualBatteryAh: 200, loadWatts: 0 });
  assert.equal(zeroLoad.runtimeHours, 0);
});

test('calculatePlnCharging calculates grid charging power, duration, and MCB safety', () => {
  // 200Ah at 48V, 30A charging, 80% DoD, 2200 VA PLN (1760W limit)
  // bulkVoltage = 48 * 1.15 = 55.2V
  // chargingWattsDc = 30 * 55.2 = 1656 W
  // plnDrawWatts = 1656 / 0.88 = 1882 W
  // rechargeAh = 200 * 0.8 = 160 Ah
  // chargingHours = (160 / 30) * 1.1 = 5.866... -> 5.9 jam
  // plnCapacityWatts = 2200 * 0.8 = 1760 W
  // 1882W > 1760W -> isMcbSafe = false
  const res = calculatePlnCharging({
    batteryAh: 200,
    systemVoltage: 48,
    chargingCurrentAmps: 30,
    dod: 0.8,
    plnVa: 2200,
    chargerEfficiency: 0.88,
  });

  assert.equal(res.chargingCurrentAmps, 30);
  assert.equal(res.chargingWattsDc, 1656);
  assert.equal(res.plnDrawWatts, 1882);
  assert.equal(res.chargingHours, 5.9);
  assert.equal(res.isMcbSafe, false);
  assert.ok(res.mcbWarningMessage);

  // Safe case: 10A charging on 2200 VA (plnDraw = 627W < 1760W)
  const safe = calculatePlnCharging({
    batteryAh: 200,
    systemVoltage: 48,
    chargingCurrentAmps: 10,
    dod: 0.8,
    plnVa: 2200,
  });
  assert.equal(safe.isMcbSafe, true);
  assert.equal(safe.mcbWarningMessage, null);
  // chargingHours = (160 / 10) * 1.1 = 17.6 jam
  assert.equal(safe.chargingHours, 17.6);

  // Zero charging current edge case
  const zero = calculatePlnCharging({ batteryAh: 200, chargingCurrentAmps: 0 });
  assert.equal(zero.plnDrawWatts, 0);
  assert.equal(zero.chargingHours, 0);
  assert.equal(zero.isMcbSafe, true);
});

test('calculatePartialPvProduction calculates energy and MPPT status for phased/staged panel array', () => {
  // 4 panels of 550Wp, target 20000Wh, sph 4, loss 1.3, Vmp 42.1V, MPPT min 60V
  // installedWp = 4 * 550 = 2200 Wp
  // actualDailyWh = 2200 * 4 / 1.3 = 6769.23 -> 6769 Wh
  // actualDailyKwh = 6.8 kWh
  // coveragePercent = round(6769 / 20000 * 100) = 34%
  // deficitKwh = round((20000 - 6769)/100)/10 = 13.2 kWh
  // string voltage = 4 * 42.1 = 168.4V >= 60V -> isMpptVoltageMet = true
  const res = calculatePartialPvProduction({
    actualPanelCount: 4,
    wpPerPanel: 550,
    targetEnergyWh: 20000,
    sph: 4,
    lossFactor: 1.3,
    panelVmp: 42.1,
    mpptMinVoltage: 60,
  });

  assert.equal(res.actualPanelCount, 4);
  assert.equal(res.actualInstalledWp, 2200);
  assert.equal(res.actualDailyWh, 6769);
  assert.equal(res.actualDailyKwh, 6.8);
  assert.equal(res.coveragePercent, 34);
  assert.equal(res.deficitKwh, 13.2);
  assert.equal(res.isMpptVoltageMet, true);
  assert.equal(res.estimatedStringVoltage, 168.4);

  // Insufficient panels for high-voltage MPPT (e.g. 1 panel of 42.1V on 120V MPPT)
  const underVolt = calculatePartialPvProduction({
    actualPanelCount: 1,
    wpPerPanel: 550,
    targetEnergyWh: 20000,
    panelVmp: 42.1,
    mpptMinVoltage: 120,
  });
  assert.equal(underVolt.isMpptVoltageMet, false);
  assert.equal(underVolt.estimatedStringVoltage, 42.1);

  // Zero panel count
  const zero = calculatePartialPvProduction({ actualPanelCount: 0, targetEnergyWh: 10000 });
  assert.equal(zero.actualInstalledWp, 0);
  assert.equal(zero.actualDailyKwh, 0);
  assert.equal(zero.coveragePercent, 0);
  assert.equal(zero.isMpptVoltageMet, false);
});

test('calculateSizing synchronizes panelCount with symmetrical stringConfig matrix', () => {
  // If theoretical panelCount is 5 but 5S Voc (250.5V) exceeds MPPT max voltage (245V),
  // stringConfig requires 3S 2P (6 panels). panelCount should sync to 6.
  const r = calculateSizing({
    energyWh: 8000,
    sph: 4,
    wpPerPanel: 550,
    panelVoc: 50.1,
    panelVmp: 42.1,
    mpptMaxVoltage: 245,
    mpptMinVoltage: 60,
  });
  // raw theoretical panel count: 8000 / 4 * 1.3 = 2600 Wp / 550 = 4.72 -> ceil is 5
  assert.equal(r.rawPanelCount, 5);
  // Physical balanced array count: 3S 2P = 6
  assert.equal(r.panelCount, 6);
  assert.equal(r.stringConfig.series, 3);
  assert.equal(r.stringConfig.parallel, 2);
  assert.equal(r.panelTotalActualWp, 6 * 550);
});
