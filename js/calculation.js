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
export function calculateSizing({ peakPower, energyWh, sph, systemVoltage, dod, autonomyDays, wpPerPanel, safetyFactor, lossFactor }) {
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
