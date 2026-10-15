import { vaToWatts, dailyEnergyRealistic, dailyEnergyFromAppliances } from './calculation.js';

const DEFAULT_WP_PER_PANEL = 550;
const DEFAULT_MODULE_AH = 200;

function isInvalidNumber(value) {
  return value === '' || value === null || value === undefined || !(Number(value) > 0) || Number.isNaN(Number(value));
}

export function validateInput(input) {
  const errors = {};
  const warnings = {};

  const powerMode = input.powerMode || (input.powerVa !== undefined ? 'va' : (input.peakPower !== undefined ? 'watt' : 'va'));
  let peakPower = 0;
  let powerVa = undefined;

  if (powerMode === 'va') {
    if (isInvalidNumber(input.powerVa)) {
      errors.powerVa = 'Daya PLN (VA) wajib dan harus lebih dari 0.';
    } else {
      powerVa = Number(input.powerVa);
      peakPower = vaToWatts(powerVa);
    }
  } else {
    if (isInvalidNumber(input.peakPower)) {
      errors.peakPower = 'Nilai wajib dan harus lebih dari 0.';
    } else {
      peakPower = Number(input.peakPower);
    }
  }

  const energyMode = input.energyMode || (Array.isArray(input.appliances) && input.appliances.length > 0 ? 'appliances' : 'manual');
  let energyWh = 0;

  if (energyMode === 'appliances') {
    const appliances = Array.isArray(input.appliances) ? input.appliances : [];
    energyWh = dailyEnergyFromAppliances(appliances);
    if (energyWh <= 0) {
      errors.appliances = 'Tambahkan minimal satu alat dengan daya dan durasi nyala.';
    }
  } else if (energyMode === 'realistic') {
    // Ponytail: backward compatibility for legacy realistic mode tests
    if (peakPower > 0) {
      energyWh = dailyEnergyRealistic(peakPower, Number(input.loadFactor) || 0.8, 24);
    }
  } else {
    if (isInvalidNumber(input.energyKwh)) {
      errors.energyKwh = 'Nilai wajib dan harus lebih dari 0.';
    } else {
      energyWh = Number(input.energyKwh) * 1000;
    }
  }

  // Required parameters: sph, systemVoltage, dod
  for (const key of ['sph', 'systemVoltage', 'dod']) {
    if (isInvalidNumber(input[key])) {
      errors[key] = 'Nilai wajib dan harus lebih dari 0.';
    }
  }

  // Normalize DoD: accept fraction (<=1) or percent (>1 up to 90), clamp to (0,1]
  let dod = Number(input.dod);
  if (!Number.isNaN(dod) && dod > 1) {
    dod = dod / 100;
  }
  if (dod > 1) dod = 1;

  // Clamp SPH to [1,10]
  let sph = Number(input.sph);
  if (!Number.isNaN(sph)) {
    if (sph > 10) {
      sph = 10;
      warnings.sph = 'Jam efektif matahari dibatasi hingga 10 jam.';
    } else if (sph < 1) {
      sph = 1;
      warnings.sph = 'Jam efektif matahari minimal 1 jam.';
    }
  }

  // Autonomy days: default 1, clamp to [1,5]
  let autonomyDays = input.autonomyDays === '' || input.autonomyDays === null || input.autonomyDays === undefined
    ? 1
    : Number(input.autonomyDays);
  if (Number.isNaN(autonomyDays) || autonomyDays < 1) autonomyDays = 1;
  if (autonomyDays > 5) autonomyDays = 5;

  const wpPerPanel = Number(input.wpPerPanel) > 0 ? Number(input.wpPerPanel) : DEFAULT_WP_PER_PANEL;
  const panelVmp = Number(input.panelVmp) > 0 ? Number(input.panelVmp) : 42.1;
  const panelVoc = Number(input.panelVoc) > 0 ? Number(input.panelVoc) : 50.1;
  const panelImp = Number(input.panelImp) > 0 ? Number(input.panelImp) : 13.06;
  const panelIsc = Number(input.panelIsc) > 0 ? Number(input.panelIsc) : 13.90;
  const selectedPanelId = input.selectedPanelId || 'solana-550';
  const selectedInverterId = input.selectedInverterId || 'srne-5k';
  const moduleAh = Number(input.moduleAh) > 0 ? Number(input.moduleAh) : DEFAULT_MODULE_AH;
  const inverterRatedWatts = Number(input.inverterRatedWatts) > 0 ? Number(input.inverterRatedWatts) : 5000;
  const mpptMinVoltage = Number(input.mpptMinVoltage) > 0 ? Number(input.mpptMinVoltage) : 60;
  const mpptMaxVoltage = Number(input.mpptMaxVoltage) > 0 ? Number(input.mpptMaxVoltage) : 245;
  const mpptMaxCurrent = Number(input.mpptMaxCurrent) > 0 ? Number(input.mpptMaxCurrent) : 100;
  const mpptCount = Number(input.mpptCount) > 0 ? Number(input.mpptCount) : 1;
  const tariffPerKwh = Number(input.tariffPerKwh) >= 0 ? Number(input.tariffPerKwh) : 1444.7;
  const ppnPercent = Number(input.ppnPercent) >= 0 ? Number(input.ppnPercent) : 12;
  const ppjPercent = Number(input.ppjPercent) >= 0 ? Number(input.ppjPercent) : 10;
  const billingDays = [30, 31].includes(Number(input.billingDays)) ? Number(input.billingDays) : 30;

  return {
    errors,
    warnings,
    normalized: {
      powerVa,
      peakPower,
      energyWh,
      energyKwh: Math.round(energyWh / 100) / 10,
      sph,
      systemVoltage: Number(input.systemVoltage),
      dod,
      autonomyDays,
      wpPerPanel,
      panelVmp,
      panelVoc,
      panelImp,
      panelIsc,
      selectedPanelId,
      selectedInverterId,
      moduleAh,
      inverterRatedWatts,
      mpptMinVoltage,
      mpptMaxVoltage,
      mpptMaxCurrent,
      mpptCount,
      tariffPerKwh,
      ppnPercent,
      ppjPercent,
      billingDays,
    },
  };
}
