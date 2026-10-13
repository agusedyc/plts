import { calculateSizing } from './calculation.js';
import { validateInput } from './validation.js';
import { createStorage, getDefaultAdapter } from './storage.js';

const storage = createStorage(getDefaultAdapter());

const DOD_DEFAULTS = { lithium: 0.8, vrla: 0.5 };

export function pltsApp() {
  return {
  inputs: {
    peakPower: 5500,
    energyKwh: 30,
    sph: 4,
    systemVoltage: 48,
    batteryType: 'lithium',
    dod: DOD_DEFAULTS.lithium,
    autonomyDays: 1,
    wpPerPanel: 550,
  },
  errors: {},
  warnings: {},
  results: {
    inverterWatts: 0,
    panelWp: 0,
    panelCount: 0,
    batteryAh: 0,
    batteryKwh: 0,
    sccAmps: 0,
    systemVoltage: 48,
  },
  hasResults: false,
  history: [],

  async init() {
    await this.loadPreferences();
    await this.loadHistory();
  },

  onBatteryTypeChange() {
    this.inputs.dod = DOD_DEFAULTS[this.inputs.batteryType] ?? this.inputs.dod;
  },

  async hitung() {
    const validated = validateInput(this.inputs);
    this.errors = validated.errors;
    this.warnings = validated.warnings;

    if (Object.keys(this.errors).length > 0) {
      this.hasResults = false;
      return;
    }

    const sizing = calculateSizing(validated.normalized);
    this.results = {
      ...sizing,
      systemVoltage: validated.normalized.systemVoltage,
    };
    this.hasResults = true;

    // Persist history + preferences
    await this.saveHistory(sizing);
    await this.savePreferences();
  },

  async saveHistory(sizing) {
    await storage.saveCalculation({
      input: { ...this.inputs },
      output: { ...sizing },
    });
    await this.loadHistory();
  },

  hitungLive() {
    const validated = validateInput(this.inputs);
    this.errors = validated.errors;
    this.warnings = validated.warnings;
  },

  async loadPreferences() {
    const prefs = await storage.getPreferences();
    if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
      this.inputs = { ...this.inputs, ...prefs };
    }
  },

  savePreferences() {
    return storage.savePreferences({ ...this.inputs });
  },

  async loadHistory() {
    this.history = await storage.getHistory();
  },

  async restoreHistory(id) {
    const item = this.history.find((h) => h.id === id);
    if (item) {
      await this.restoreInput(item);
    }
  },

  async restoreInput(item) {
    this.inputs = { ...this.inputs, ...item.input };
    await this.hitung();
  },

  async removeHistory(id) {
    await storage.deleteHistory(id);
    await this.loadHistory();
  },

  resetForm() {
    this.inputs = {
      peakPower: 5500,
      energyKwh: 30,
      sph: 4,
      systemVoltage: 48,
      batteryType: 'lithium',
      dod: DOD_DEFAULTS.lithium,
      autonomyDays: 1,
      wpPerPanel: 550,
    };
    this.errors = {};
    this.warnings = {};
    this.results = {
      inverterWatts: 0,
      panelWp: 0,
      panelCount: 0,
      batteryAh: 0,
      batteryKwh: 0,
      sccAmps: 0,
      systemVoltage: 48,
    };
    this.hasResults = false;
  },

  formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  },

  get inverterClass() {
    if (!this.results) return '';
    const watts = this.results.inverterWatts;
    const classes = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000];
    const chosen = classes.find((c) => c >= watts) ?? Math.ceil(watts / 1000) * 1000;
    return `${chosen} W ke atas`;
  },
  };
}

if (typeof window !== 'undefined') {
  window.pltsApp = pltsApp;
}

document.addEventListener('alpine:init', () => {
  if (typeof Alpine !== 'undefined' && Alpine.data) {
    Alpine.data('pltsApp', pltsApp);
  }
});
