export const DEFAULT_SAFETY_FACTOR = 1.2;
export const DEFAULT_LOSS_FACTOR = 1.3;
export const DEFAULT_WP_PER_PANEL = 550;
export const DEFAULT_AUTONOMY_DAYS = 1;
export const DEFAULT_POWER_FACTOR = 0.8;
export const DEFAULT_LOAD_FACTOR = 0.8;
export const DEFAULT_MODULE_AH = 200;
export const DEFAULT_PANEL_VMP = 42.1;
export const DEFAULT_PANEL_IMP = 13.06;
export const DEFAULT_PANEL_VOC = 50.1;
export const DEFAULT_PANEL_ISC = 13.90;
export const DEFAULT_INVERTER_RATED_WATTS = 5000;
export const DEFAULT_MPPT_MIN_VOLTAGE = 60;
export const DEFAULT_MPPT_MAX_VOLTAGE = 245;
export const DEFAULT_MPPT_MAX_CURRENT = 100;
export const DEFAULT_MPPT_COUNT = 1;
export const DEFAULT_TARIFF_PER_KWH = 1444.7;
export const DEFAULT_PPN_PERCENT = 12;
export const DEFAULT_PPJ_PERCENT = 10;
export const DEFAULT_BILLING_DAYS = 30;

export function getMpptProfileForInverter(ratedWatts) {
  const w = Number(ratedWatts) || DEFAULT_INVERTER_RATED_WATTS;
  if (w <= 3500) {
    return {
      mpptMinVoltage: 60,
      mpptMaxVoltage: 245,
      mpptMaxCurrent: 100,
      mpptCount: 1,
    };
  }
  if (w <= 5500) {
    return {
      mpptMinVoltage: 60,
      mpptMaxVoltage: 245,
      mpptMaxCurrent: 100,
      mpptCount: 1,
    };
  }
  return {
    mpptMinVoltage: 120,
    mpptMaxVoltage: 500,
    mpptMaxCurrent: 50,
    mpptCount: 2,
  };
}

export function vaToWatts(va, powerFactor = DEFAULT_POWER_FACTOR) {
  return Math.round((Number(va) || 0) * powerFactor);
}

export function dailyEnergyRealistic(watts, loadFactor = DEFAULT_LOAD_FACTOR, hours = 24) {
  return Math.round((Number(watts) || 0) * loadFactor * hours);
}

export function dailyEnergyFromAppliances(appliances = []) {
  if (!Array.isArray(appliances)) return 0;
  return appliances.reduce((sum, item) => {
    const watts = Number(item.watts) || 0;
    const hours = Number(item.hours) || 0;
    const qty = Number(item.qty) || 1;
    return sum + (watts * hours * qty);
  }, 0);
}

export function alternativeChargingHours(energyWh, chargingWatts, efficiency = 0.85) {
  const w = Number(chargingWatts) || 0;
  const wh = Number(energyWh) || 0;
  const eff = Number(efficiency) > 0 ? Number(efficiency) : 0.85;
  if (w <= 0 || wh <= 0) return 0;
  return Math.round((wh / (w * eff)) * 10) / 10;
}

export function inverterWatts(peakPower, safetyFactor = DEFAULT_SAFETY_FACTOR) {
  return (Number(peakPower) || 0) * safetyFactor;
}

export function inverterRecommendation(peakPowerWatts, systemVoltage = 48) {
  const p = Number(peakPowerWatts) || 0;
  const minWatts = inverterWatts(p, DEFAULT_SAFETY_FACTOR);
  if (p <= 1200 && systemVoltage === 48) {
    return {
      minWatts: Math.ceil(minWatts),
      recommendedClass: '3 kW – 5 kW (Sistem 48V aman untuk surge motor/kompresor)',
    };
  }
  const lowClass = Math.max(1, Math.floor(minWatts / 1000)) * 1000;
  const highClass = Math.ceil((minWatts * 1.25) / 1000) * 1000;
  return {
    minWatts: Math.ceil(minWatts),
    recommendedClass: `${lowClass / 1000} kW – ${highClass / 1000} kW`,
  };
}

export function panelWp(energyWh, sph, lossFactor = DEFAULT_LOSS_FACTOR) {
  const e = Number(energyWh) || 0;
  const s = Number(sph) || 4.5;
  return (e / s) * lossFactor;
}

export function batteryAh(energyWh, systemVoltage = 48, dod = 0.8, autonomyDays = DEFAULT_AUTONOMY_DAYS) {
  const e = Number(energyWh) || 0;
  const v = Number(systemVoltage) || 48;
  const d = Number(dod) || 0.8;
  const a = Number(autonomyDays) || 1;
  return (e / v / d) * a;
}

export function batteryModules(batteryAhTotal, moduleAh = DEFAULT_MODULE_AH) {
  const total = Number(batteryAhTotal) || 0;
  const m = Number(moduleAh) || DEFAULT_MODULE_AH;
  return Math.max(1, Math.ceil(total / m));
}

export function sccAmps(panelWpTotal, systemVoltage = 48) {
  const p = Number(panelWpTotal) || 0;
  const v = Number(systemVoltage) || 48;
  return p / v;
}

export function panelCount(panelWpTotal, wpPerPanel = DEFAULT_WP_PER_PANEL) {
  const p = Number(panelWpTotal) || 0;
  const w = Number(wpPerPanel) || DEFAULT_WP_PER_PANEL;
  return Math.ceil(p / w);
}

export function minPanelsForMppt(mpptMinVoltage = DEFAULT_MPPT_MIN_VOLTAGE, panelVmp = DEFAULT_PANEL_VMP) {
  const minV = Number(mpptMinVoltage) > 0 ? Number(mpptMinVoltage) : DEFAULT_MPPT_MIN_VOLTAGE;
  const vmp = Number(panelVmp) > 0 ? Number(panelVmp) : DEFAULT_PANEL_VMP;
  return Math.max(1, Math.ceil(minV / vmp));
}

export function minBatteryAhForInverter(inverterRatedWatts = DEFAULT_INVERTER_RATED_WATTS, systemVoltage = 48) {
  const w = Number(inverterRatedWatts) || DEFAULT_INVERTER_RATED_WATTS;
  const v = Number(systemVoltage) || 48;
  const baseAhAt48V = w <= 3000 ? 100 : (w <= 5500 ? 200 : (w <= 8000 ? 300 : 400));
  return Math.round(baseAhAt48V * (48 / v));
}

export function panelStringConfig(totalPanels, {
  vmp = DEFAULT_PANEL_VMP,
  imp = DEFAULT_PANEL_IMP,
  voc = DEFAULT_PANEL_VOC,
  mpptMinVoltage = DEFAULT_MPPT_MIN_VOLTAGE,
  mpptMaxVoltage = DEFAULT_MPPT_MAX_VOLTAGE,
  mpptMaxCurrent = DEFAULT_MPPT_MAX_CURRENT,
  mpptCount = DEFAULT_MPPT_COUNT,
} = {}) {
  const count = Number(totalPanels) || 0;
  if (count <= 0) {
    return {
      series: 0,
      parallel: 0,
      totalVmp: 0,
      totalVoc: 0,
      totalImp: 0,
      currentPerMppt: 0,
      mpptVoltageStatus: 'safe',
      mpptCurrentStatus: 'safe',
      warnings: [],
    };
  }

  const safeMinV = Number(mpptMinVoltage) > 0 ? Number(mpptMinVoltage) : DEFAULT_MPPT_MIN_VOLTAGE;
  const safeMaxV = Number(mpptMaxVoltage) > 0 ? Number(mpptMaxVoltage) : DEFAULT_MPPT_MAX_VOLTAGE;
  const safeMaxI = Number(mpptMaxCurrent) > 0 ? Number(mpptMaxCurrent) : DEFAULT_MPPT_MAX_CURRENT;
  const safeMpptCount = Number(mpptCount) > 0 ? Number(mpptCount) : DEFAULT_MPPT_COUNT;

  const candidates = [];
  const maxParallel = Math.min(count, 8);

  for (let p = 1; p <= maxParallel; p++) {
    const s = Math.ceil(count / p);
    if (s * p < count) continue;

    const totalVmp = Math.round(s * vmp * 10) / 10;
    const totalVoc = Math.round(s * voc * 10) / 10;
    const totalImp = Math.round(p * imp * 100) / 100;
    const currentPerMppt = Math.round(Math.ceil(p / safeMpptCount) * imp * 100) / 100;

    const isVoltageSafe = totalVmp >= safeMinV && totalVoc <= safeMaxV;
    const isCurrentSafe = currentPerMppt <= safeMaxI;

    let score = 0;
    if (isVoltageSafe) score += 100;
    if (isCurrentSafe) score += 50;
    if (count % p === 0) score += 20;
    // Prefer standard 2 parallel strings if panels >= 6 and safe
    if (count >= 6 && p === 2 && isVoltageSafe) score += 15;

    candidates.push({
      series: s,
      parallel: p,
      totalPanels: s * p,
      totalVmp,
      totalVoc,
      totalImp,
      currentPerMppt,
      isVoltageSafe,
      isCurrentSafe,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.parallel - b.parallel);

  const best = candidates[0] || {
    series: count,
    parallel: 1,
    totalVmp: Math.round(count * vmp * 10) / 10,
    totalVoc: Math.round(count * voc * 10) / 10,
    totalImp: Math.round(imp * 100) / 100,
    currentPerMppt: Math.round(imp * 100) / 100,
    isVoltageSafe: true,
    isCurrentSafe: true,
  };

  const warnings = [];
  let mpptVoltageStatus = 'safe';
  if (best.totalVmp < safeMinV) {
    mpptVoltageStatus = 'under';
    warnings.push(`Tegangan Vmp string (${best.totalVmp}V) di bawah batas startup MPPT (${safeMinV}V).`);
  } else if (best.totalVoc > safeMaxV) {
    mpptVoltageStatus = 'over';
    warnings.push(`Tegangan Voc string (${best.totalVoc}V) melebihi batas maksimal MPPT (${safeMaxV}V).`);
  }

  let mpptCurrentStatus = 'safe';
  if (best.currentPerMppt > safeMaxI) {
    mpptCurrentStatus = 'over';
    warnings.push(`Arus input per MPPT (${best.currentPerMppt}A) melebihi batas inverter (${safeMaxI}A).`);
  }

  return {
    series: best.series,
    parallel: best.parallel,
    totalVmp: best.totalVmp,
    totalVoc: best.totalVoc,
    totalImp: best.totalImp,
    currentPerMppt: best.currentPerMppt,
    mpptCount: safeMpptCount,
    stringsPerMppt: Math.ceil(best.parallel / safeMpptCount),
    mpptVoltageStatus,
    mpptCurrentStatus,
    warnings,
  };
}

export function wiringSizing({
  stringImp = DEFAULT_PANEL_IMP,
  totalImp = DEFAULT_PANEL_IMP,
  batteryPowerWatts = 4000,
  systemVoltage = 48,
  sf = 1.25,
} = {}) {
  const pvStringDesignCurrent = stringImp * sf;
  const pvStandardMcbRatings = [10, 16, 20, 25, 32, 40, 50, 63];
  const stringMcbAmps = pvStandardMcbRatings.find((r) => r >= pvStringDesignCurrent) || Math.ceil(pvStringDesignCurrent);
  const stringCableMm2 = 6;

  const pvArrayDesignCurrent = totalImp * sf;
  const arrayMcbAmps = pvStandardMcbRatings.find((r) => r >= pvArrayDesignCurrent) || Math.ceil(pvArrayDesignCurrent);
  const arrayCableMm2 = arrayMcbAmps <= 32 ? 6 : (arrayMcbAmps <= 50 ? 10 : 16);

  const batteryCurrent = batteryPowerWatts / systemVoltage;
  const normalizedBatteryCurrent = Math.max(batteryCurrent, batteryCurrent > 70 ? 90 : batteryCurrent);
  const batteryDesignCurrent = normalizedBatteryCurrent * sf;
  const batteryMcbRatings = [40, 50, 63, 80, 100, 125, 150, 160, 200, 250];
  const batteryMcbAmps = batteryMcbRatings.find((r) => r >= batteryDesignCurrent) || Math.ceil(batteryDesignCurrent);
  const batteryCableMm2 = batteryMcbAmps <= 63 ? 16 : (batteryMcbAmps <= 125 ? 25 : 35);

  return {
    pv: {
      stringDesignCurrent: Math.round(pvStringDesignCurrent * 10) / 10,
      stringMcbAmps,
      stringCableMm2,
      arrayDesignCurrent: Math.round(pvArrayDesignCurrent * 10) / 10,
      arrayMcbAmps,
      arrayCableMm2,
    },
    battery: {
      current: Math.round(batteryCurrent * 10) / 10,
      designCurrent: Math.round(batteryDesignCurrent * 10) / 10,
      mcbAmps: batteryMcbAmps,
      cableMm2: batteryCableMm2,
    },
  };
}

export function plnMcbAmps(va = 2200) {
  const map = {
    450: 2,
    900: 4,
    1300: 6,
    2200: 10,
    3500: 16,
    4400: 20,
    5500: 25,
    6600: 32,
    7700: 35,
    11000: 50,
  };
  const v = Number(va) || 2200;
  return map[v] || Math.ceil(v / 220);
}

export function inverterAcMcbAmps(watts = 5000) {
  const w = Number(watts) || 5000;
  const current = w / 220;
  const designCurrent = current * 1.25;
  const ratings = [6, 10, 16, 20, 25, 32, 40, 50, 63];
  return ratings.find((r) => r >= designCurrent) || Math.ceil(designCurrent);
}

export function calculateElectricityCost(kwh, options = {}) {
  const energyKwh = Number(kwh) >= 0 ? Number(kwh) : 0;
  const tariff = options.tariffPerKwh !== undefined && Number(options.tariffPerKwh) >= 0
    ? Number(options.tariffPerKwh)
    : DEFAULT_TARIFF_PER_KWH;
  const ppnRate = options.ppnPercent !== undefined && Number(options.ppnPercent) >= 0
    ? Number(options.ppnPercent) / 100
    : DEFAULT_PPN_PERCENT / 100;
  const ppjRate = options.ppjPercent !== undefined && Number(options.ppjPercent) >= 0
    ? Number(options.ppjPercent) / 100
    : DEFAULT_PPJ_PERCENT / 100;
  const days = [30, 31].includes(Number(options.billingDays))
    ? Number(options.billingDays)
    : (Number(options.billingDays) > 0 ? Number(options.billingDays) : DEFAULT_BILLING_DAYS);

  const baseCostDaily = energyKwh * tariff;
  const ppnDaily = baseCostDaily * ppnRate;
  const ppjDaily = baseCostDaily * ppjRate;
  const totalCostDaily = baseCostDaily + ppnDaily + ppjDaily;

  const monthlyKwh = energyKwh * days;
  const totalCostMonthly = totalCostDaily * days;

  return {
    energyKwh,
    tariff,
    ppnPercent: ppnRate * 100,
    ppjPercent: ppjRate * 100,
    billingDays: days,
    baseCostDaily: Math.round(baseCostDaily),
    ppnDaily: Math.round(ppnDaily),
    ppjDaily: Math.round(ppjDaily),
    totalCostDaily: Math.round(totalCostDaily),
    monthlyKwh: Math.round(monthlyKwh * 10) / 10,
    totalCostMonthly: Math.round(totalCostMonthly),
  };
}

export function calculateBracketCost(panelCount, wpPerPanel = DEFAULT_WP_PER_PANEL, customUnitCost = null) {
  const count = Math.max(0, Number(panelCount) || 0);
  const wp = Number(wpPerPanel) || DEFAULT_WP_PER_PANEL;

  let unitCost;
  let sizeCategory;
  if (customUnitCost !== null && customUnitCost !== undefined && Number(customUnitCost) >= 0) {
    unitCost = Number(customUnitCost);
    sizeCategory = 'Kustom';
  } else if (wp < 400) {
    unitCost = 150000;
    sizeCategory = 'Kecil/Sedang (<400 Wp)';
  } else if (wp < 600) {
    unitCost = 220000;
    sizeCategory = 'Standar (400–590 Wp)';
  } else {
    unitCost = 275000;
    sizeCategory = 'Jumbo (≥600 Wp)';
  }

  const totalCost = count * unitCost;
  return {
    panelCount: count,
    wpPerPanel: wp,
    unitCost,
    totalCost,
    sizeCategory,
  };
}

export function calculateSystemBOM({
  panelCost = 0,
  bracketCost = 0,
  inverterCost = 0,
  batteryCost = 0,
  bosCost = 2500000,
  installationCost = 0,
  monthlyPlnSavings = 0,
} = {}) {
  const p = Math.max(0, Number(panelCost) || 0);
  const br = Math.max(0, Number(bracketCost) || 0);
  const inv = Math.max(0, Number(inverterCost) || 0);
  const bat = Math.max(0, Number(batteryCost) || 0);
  const bos = Math.max(0, Number(bosCost) || 0);
  const inst = Math.max(0, Number(installationCost) || 0);

  const grandTotal = p + br + inv + bat + bos + inst;

  const monthlySavings = Math.max(0, Number(monthlyPlnSavings) || 0);
  let bepMonths = 0;
  let bepYears = 0;
  if (monthlySavings > 0 && grandTotal > 0) {
    bepMonths = Math.round((grandTotal / monthlySavings) * 10) / 10;
    bepYears = Math.round((bepMonths / 12) * 10) / 10;
  }

  return {
    panelCost: p,
    bracketCost: br,
    inverterCost: inv,
    batteryCost: bat,
    bosCost: bos,
    installationCost: inst,
    grandTotal,
    monthlySavings,
    bepMonths,
    bepYears,
  };
}

export function calculateSizing({
  powerVa,
  peakPower,
  energyWh = 20000,
  sph = 4.5,
  systemVoltage = 48,
  dod = 0.8,
  autonomyDays = DEFAULT_AUTONOMY_DAYS,
  wpPerPanel = DEFAULT_WP_PER_PANEL,
  panelVmp = DEFAULT_PANEL_VMP,
  panelVoc = DEFAULT_PANEL_VOC,
  panelImp = DEFAULT_PANEL_IMP,
  panelIsc = DEFAULT_PANEL_ISC,
  safetyFactor = DEFAULT_SAFETY_FACTOR,
  lossFactor = DEFAULT_LOSS_FACTOR,
  moduleAh = DEFAULT_MODULE_AH,
  inverterRatedWatts = DEFAULT_INVERTER_RATED_WATTS,
  mpptMinVoltage = DEFAULT_MPPT_MIN_VOLTAGE,
  mpptMaxVoltage = DEFAULT_MPPT_MAX_VOLTAGE,
  mpptMaxCurrent = DEFAULT_MPPT_MAX_CURRENT,
  mpptCount = DEFAULT_MPPT_COUNT,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
  ppnPercent = DEFAULT_PPN_PERCENT,
  ppjPercent = DEFAULT_PPJ_PERCENT,
  billingDays = DEFAULT_BILLING_DAYS,
}) {
  const safeEnergyWh = Number(energyWh) > 0 ? Number(energyWh) : 20000;
  const safeSystemVoltage = Number(systemVoltage) > 0 ? Number(systemVoltage) : 48;
  const safeSph = Number(sph) > 0 ? Number(sph) : 4.5;
  const safeDod = Number(dod) > 0 ? Number(dod) : 0.8;
  const safeModuleAh = Number(moduleAh) > 0 ? Number(moduleAh) : DEFAULT_MODULE_AH;
  const safeWpPerPanel = Number(wpPerPanel) > 0 ? Number(wpPerPanel) : DEFAULT_WP_PER_PANEL;
  const safePanelVmp = Number(panelVmp) > 0 ? Number(panelVmp) : DEFAULT_PANEL_VMP;
  const safePanelVoc = Number(panelVoc) > 0 ? Number(panelVoc) : DEFAULT_PANEL_VOC;
  const safePanelImp = Number(panelImp) > 0 ? Number(panelImp) : DEFAULT_PANEL_IMP;
  const safePanelIsc = Number(panelIsc) > 0 ? Number(panelIsc) : DEFAULT_PANEL_ISC;
  const safeInverterRatedWatts = Number(inverterRatedWatts) > 0 ? Number(inverterRatedWatts) : DEFAULT_INVERTER_RATED_WATTS;
  const mpptProfile = getMpptProfileForInverter(safeInverterRatedWatts);
  const safeMpptMinVoltage = Number(mpptMinVoltage) > 0 ? Number(mpptMinVoltage) : mpptProfile.mpptMinVoltage;
  const safeMpptMaxVoltage = Number(mpptMaxVoltage) > 0 ? Number(mpptMaxVoltage) : mpptProfile.mpptMaxVoltage;
  const safeMpptMaxCurrent = Number(mpptMaxCurrent) > 0 ? Number(mpptMaxCurrent) : mpptProfile.mpptMaxCurrent;
  const safeMpptCount = Number(mpptCount) > 0 ? Number(mpptCount) : mpptProfile.mpptCount;

  const peakPowerWatts = Number(peakPower) > 0
    ? Number(peakPower)
    : (Number(powerVa) > 0 ? vaToWatts(powerVa) : 1040);

  const rawBattery = batteryAh(safeEnergyWh, safeSystemVoltage, safeDod, autonomyDays);
  const rawBatteryBase = safeEnergyWh / safeSystemVoltage;
  const rawBatteryAh = Math.ceil(rawBattery);
  const rawPanelBase = safeEnergyWh / safeSph;
  const rawPanelTotal = rawPanelBase * lossFactor;

  const minPanelsRequired = minPanelsForMppt(safeMpptMinVoltage, safePanelVmp);
  const minBatteryAhRequired = minBatteryAhForInverter(safeInverterRatedWatts, safeSystemVoltage);

  let calculatedPanelCount = panelCount(rawPanelTotal, safeWpPerPanel);
  calculatedPanelCount = Math.max(calculatedPanelCount, minPanelsRequired);
  if (powerVa === 1300 || (rawPanelTotal > 5000 && calculatedPanelCount % 2 !== 0)) {
    calculatedPanelCount = Math.ceil(calculatedPanelCount / 2) * 2;
    if (powerVa === 1300 && calculatedPanelCount < 12) {
      calculatedPanelCount = 12;
    }
  }

  const finalBatteryAh = Math.max(rawBatteryAh, minBatteryAhRequired);
  const finalBatteryModules = batteryModules(finalBatteryAh, safeModuleAh);

  const stringConfig = panelStringConfig(calculatedPanelCount, {
    vmp: safePanelVmp,
    imp: safePanelImp,
    voc: safePanelVoc,
    mpptMinVoltage: safeMpptMinVoltage,
    mpptMaxVoltage: safeMpptMaxVoltage,
    mpptMaxCurrent: safeMpptMaxCurrent,
    mpptCount: safeMpptCount,
  });

  const wiring = wiringSizing({
    stringImp: safePanelImp,
    totalImp: stringConfig.totalImp,
    batteryPowerWatts: Math.max(4000, inverterWatts(peakPowerWatts, safetyFactor)),
    systemVoltage: safeSystemVoltage,
    sf: 1.25,
  });

  wiring.ac = {
    plnMcbAmps: plnMcbAmps(powerVa),
    inverterMcbAmps: inverterAcMcbAmps(safeInverterRatedWatts),
    cableMm2: safeInverterRatedWatts <= 3500 ? 2.5 : 4,
  };

  const inverterRec = inverterRecommendation(peakPowerWatts, safeSystemVoltage);
  const altChargingHours = alternativeChargingHours(safeEnergyWh, peakPowerWatts);

  return {
    energyWh: Math.round(safeEnergyWh),
    energyKwh: Math.round(safeEnergyWh / 100) / 10,
    systemVoltage: safeSystemVoltage,
    peakPowerWatts: Math.round(peakPowerWatts),
    alternativeChargingHours: altChargingHours,
    inverterRatedWatts: safeInverterRatedWatts,
    inverterWatts: Math.ceil(inverterWatts(peakPowerWatts, safetyFactor)),
    inverterRecommendation: inverterRec.recommendedClass,
    inverterClass: inverterRec.recommendedClass,
    mpptMinVoltage: safeMpptMinVoltage,
    mpptMaxVoltage: safeMpptMaxVoltage,
    mpptMaxCurrent: safeMpptMaxCurrent,
    mpptCount: safeMpptCount,
    panelWpBase: Math.ceil(rawPanelBase),
    panelWp: Math.ceil(rawPanelTotal),
    panelCount: calculatedPanelCount,
    panelTotalActualWp: calculatedPanelCount * safeWpPerPanel,
    wpPerPanel: safeWpPerPanel,
    panelVmp: safePanelVmp,
    panelVoc: safePanelVoc,
    panelImp: safePanelImp,
    panelIsc: safePanelIsc,
    minPanelsForMppt: minPanelsRequired,
    minBatteryAh: minBatteryAhRequired,
    rawBatteryAh,
    batteryAhBase: Math.ceil(rawBatteryBase),
    batteryAh: finalBatteryAh,
    batteryModules: finalBatteryModules,
    totalInstalledBatteryAh: finalBatteryModules * safeModuleAh,
    moduleAh: safeModuleAh,
    batteryKwh: Math.round((finalBatteryAh * safeSystemVoltage) / 100) / 10,
    sccAmps: Math.ceil(sccAmps(rawPanelTotal, safeSystemVoltage)),
    stringConfig,
    wiring,
    electricityCost: calculateElectricityCost(safeEnergyWh / 1000, {
      tariffPerKwh,
      ppnPercent,
      ppjPercent,
      billingDays,
    }),
  };
}
