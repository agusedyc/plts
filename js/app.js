import {
  calculateSizing,
  vaToWatts,
  dailyEnergyFromAppliances,
  alternativeChargingHours,
  getMpptProfileForInverter,
  DEFAULT_TARIFF_PER_KWH,
  DEFAULT_PPN_PERCENT,
  DEFAULT_PPJ_PERCENT,
  DEFAULT_BILLING_DAYS,
  calculateElectricityCost,
} from './calculation.js';
import { validateInput } from './validation.js';
import { createStorage, getDefaultAdapter } from './storage.js';
import { DEFAULT_PANELS, fetchPanelsDatabase, findPanelById } from './panels.js';
import { DEFAULT_INVERTERS, fetchInvertersDatabase, findInverterById, filterInvertersByVoltage } from './inverters.js';

const storage = createStorage(getDefaultAdapter());

const DOD_DEFAULTS = { lithium: 80, vrla: 50 };

export function pltsApp() {
  return {
    inputs: {
      powerMode: 'va',
      powerVa: 2200,
      peakPower: 1760,
      energyMode: 'appliances',
      energyKwh: 5.1,
      appliances: [
        { name: 'Kulkas 1 Pintu', watts: 100, hours: 24, qty: 1 },
        { name: 'TV LED & Wifi', watts: 75, hours: 10, qty: 1 },
        { name: 'Lampu LED Rumah', watts: 15, hours: 12, qty: 6 },
        { name: 'Kipas Angin', watts: 45, hours: 10, qty: 2 },
      ],
      newAppliance: { name: '', watts: 50, hours: 8, qty: 1 },
      sph: 4.5,
      systemVoltage: 48,
      batteryType: 'lithium',
      dod: DOD_DEFAULTS.lithium,
      moduleAh: 200,
      autonomyDays: 1,
      selectedPanelId: 'solana-550',
      wpPerPanel: 550,
      panelVmp: 42.1,
      panelVoc: 50.1,
      panelImp: 13.06,
      panelIsc: 13.90,
      selectedInverterId: 'srne-5k',
      inverterRatedWatts: 5000,
      mpptMinVoltage: 60,
      mpptMaxVoltage: 245,
      mpptMaxCurrent: 100,
      mpptCount: 1,
      tariffPerKwh: DEFAULT_TARIFF_PER_KWH,
      ppnPercent: DEFAULT_PPN_PERCENT,
      ppjPercent: DEFAULT_PPJ_PERCENT,
      billingDays: DEFAULT_BILLING_DAYS,
    },
    errors: {},
    warnings: {},
    results: {
      peakPowerWatts: 1040,
      alternativeChargingHours: 5.8,
      inverterWatts: 1248,
      inverterRecommendation: '3 kW – 5 kW (Sistem 48V aman untuk surge motor/kompresor)',
      panelWpBase: 1140,
      panelWp: 1368,
      panelCount: 4,
      panelTotalActualWp: 2200,
      batteryAhBase: 107,
      batteryAh: 134,
      batteryModules: 1,
      moduleAh: 200,
      batteryKwh: 6.4,
      sccAmps: 29,
      stringConfig: { series: 2, parallel: 2, totalVmp: 84, totalImp: 26 },
      wiring: {
        pv: { stringDesignCurrent: 16.3, stringMcbAmps: 20, stringCableMm2: 6, arrayDesignCurrent: 32.5, arrayMcbAmps: 32 },
        battery: { current: 83.3, designCurrent: 112.5, mcbAmps: 125, cableMm2: 25 },
      },
      systemVoltage: 48,
      energyWh: 5130,
      energyKwh: 5.1,
      electricityCost: calculateElectricityCost(5.1),
    },
    hasResults: true,
    history: [],
    historyPage: 1,
    historyPerPage: 5,
    panels: [...DEFAULT_PANELS],
    inverters: [...DEFAULT_INVERTERS],

    async init() {
      this.panels = await fetchPanelsDatabase();
      this.inverters = await fetchInvertersDatabase();
      await this.loadPreferences();
      await this.loadHistory();
      await this.hitung();
      this.initTooltips();
    },

    initTooltips() {
      if (typeof window === 'undefined' || !window.bootstrap || !window.bootstrap.Tooltip) return;

      document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-bs-toggle="tooltip"]');
        if (target) {
          const tt = window.bootstrap.Tooltip.getOrCreateInstance(target, { trigger: 'manual' });
          tt.show();
        }
      });

      document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-bs-toggle="tooltip"]');
        if (target) {
          const tt = window.bootstrap.Tooltip.getInstance(target);
          if (tt) tt.hide();
        }
      });

      document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-bs-toggle="tooltip"]');
        if (target) {
          const tt = window.bootstrap.Tooltip.getOrCreateInstance(target, { trigger: 'manual' });
          tt.toggle();
        } else {
          document.querySelectorAll('.tooltip.show').forEach((el) => {
            const owner = document.querySelector(`[aria-describedby="${el.id}"]`);
            if (owner) {
              const tt = window.bootstrap.Tooltip.getInstance(owner);
              if (tt) tt.hide();
            }
          });
        }
      });
    },

    setPowerVa(va) {
      this.inputs.powerVa = Number(va) || 2200;
      this.inputs.peakPower = vaToWatts(this.inputs.powerVa);
      this.hitung();
    },

    onVaInput() {
      const va = Number(this.inputs.powerVa) || 2200;
      this.inputs.powerVa = va;
      this.inputs.peakPower = vaToWatts(va);
      this.hitung();
    },

    onBatteryTypeChange() {
      this.inputs.dod = DOD_DEFAULTS[this.inputs.batteryType] ?? this.inputs.dod;
      this.hitung();
    },

    get filteredInverters() {
      const v = Number(this.inputs.systemVoltage) || 48;
      const list = filterInvertersByVoltage(v, this.inverters);
      return list.length > 0 ? list : this.inverters;
    },

    onSystemVoltageChange() {
      const v = Number(this.inputs.systemVoltage) || 48;
      if (this.inputs.selectedInverterId !== 'custom') {
        const currentInv = findInverterById(this.inputs.selectedInverterId, this.inverters);
        if (!currentInv || Number(currentInv.systemVoltage) !== v) {
          const list = this.filteredInverters;
          if (list.length > 0) {
            this.onInverterSelect(list[0].id);
            return;
          }
        }
      }
      this.hitung();
    },

    onInverterSelect(inverterId) {
      this.inputs.selectedInverterId = inverterId;
      if (inverterId === 'custom') {
        return;
      }
      const inv = findInverterById(inverterId, this.inverters);
      if (inv) {
        this.inputs.inverterRatedWatts = inv.ratedWatts;
        this.inputs.mpptMinVoltage = inv.mpptMinVoltage;
        this.inputs.mpptMaxVoltage = inv.mpptMaxVoltage;
        this.inputs.mpptMaxCurrent = inv.mpptMaxCurrent;
        this.inputs.mpptCount = inv.mpptCount;
        if (inv.systemVoltage && Number(this.inputs.systemVoltage) !== Number(inv.systemVoltage)) {
          this.inputs.systemVoltage = inv.systemVoltage;
        }
        this.hitung();
      }
    },

    get selectedInverterName() {
      if (this.inputs.selectedInverterId === 'custom') {
        return 'Inverter Kustom (' + (this.inputs.inverterRatedWatts || 5000) + 'W)';
      }
      const inv = findInverterById(this.inputs.selectedInverterId, this.inverters);
      return inv ? inv.name : ((this.inputs.inverterRatedWatts || 5000) + 'W');
    },

    onManualMpptParamInput() {
      this.inputs.selectedInverterId = 'custom';
      this.hitung();
    },

    setInverterRatedWatts(w) {
      this.inputs.inverterRatedWatts = w;
      this.inputs.selectedInverterId = 'custom';
      const profile = getMpptProfileForInverter(w);
      this.inputs.mpptMinVoltage = profile.mpptMinVoltage;
      this.inputs.mpptMaxVoltage = profile.mpptMaxVoltage;
      this.inputs.mpptMaxCurrent = profile.mpptMaxCurrent;
      this.inputs.mpptCount = profile.mpptCount;
      this.hitung();
    },

    onInverterChange() {
      this.inputs.selectedInverterId = 'custom';
      const w = Number(this.inputs.inverterRatedWatts) || 5000;
      const profile = getMpptProfileForInverter(w);
      this.inputs.mpptMinVoltage = profile.mpptMinVoltage;
      this.inputs.mpptMaxVoltage = profile.mpptMaxVoltage;
      this.inputs.mpptMaxCurrent = profile.mpptMaxCurrent;
      this.inputs.mpptCount = profile.mpptCount;
      this.hitung();
    },

    resetMpptParamsToDefault() {
      if (this.inputs.selectedInverterId && this.inputs.selectedInverterId !== 'custom') {
        this.onInverterSelect(this.inputs.selectedInverterId);
      } else {
        const list = this.filteredInverters;
        if (list.length > 0) {
          this.onInverterSelect(list[0].id);
        }
      }
    },

    onPanelSelect(panelId) {
      this.inputs.selectedPanelId = panelId;
      if (panelId === 'custom') {
        return;
      }
      const p = findPanelById(panelId, this.panels);
      if (p) {
        this.inputs.wpPerPanel = p.wp;
        this.inputs.panelVmp = p.vmp;
        this.inputs.panelVoc = p.voc;
        this.inputs.panelImp = p.imp;
        this.inputs.panelIsc = p.isc || Math.round(p.imp * 1.07 * 100) / 100;
        this.hitung();
      }
    },

    get selectedPanelName() {
      if (this.inputs.selectedPanelId === 'custom') {
        return 'Panel Kustom (' + (this.inputs.wpPerPanel || 550) + ' Wp)';
      }
      const p = findPanelById(this.inputs.selectedPanelId, this.panels);
      return p ? p.name : ((this.inputs.wpPerPanel || 550) + ' Wp');
    },

    onManualPanelSpecInput() {
      this.inputs.selectedPanelId = 'custom';
      this.hitung();
    },

    resetPanelSpecsToDefault() {
      this.onPanelSelect('solana-550');
    },

    formatRupiah(amount) {
      return 'Rp ' + (Math.round(Number(amount)) || 0).toLocaleString('id-ID');
    },

    onTariffChange() {
      this.hitung();
    },

    resetTariffToDefault() {
      this.inputs.tariffPerKwh = DEFAULT_TARIFF_PER_KWH;
      this.inputs.ppnPercent = DEFAULT_PPN_PERCENT;
      this.inputs.ppjPercent = DEFAULT_PPJ_PERCENT;
      this.inputs.billingDays = DEFAULT_BILLING_DAYS;
      this.hitung();
    },

    onEnergyModeChange() {
      if (this.inputs.energyMode === 'manual') {
        const wh = this.totalApplianceWh;
        if (wh > 0 && !this.inputs.energyKwh) {
          this.inputs.energyKwh = Math.round((wh / 100)) / 10;
        }
      } else {
        this.inputs.energyKwh = Math.round((this.totalApplianceWh / 100)) / 10;
      }
      this.hitung();
    },

    addAppliance() {
      if (!this.inputs.newAppliance.name) return;
      this.inputs.appliances.push({ ...this.inputs.newAppliance });
      this.inputs.newAppliance = { name: '', watts: 50, hours: 8, qty: 1 };
      this.inputs.energyKwh = Math.round((this.totalApplianceWh / 100)) / 10;
      this.hitung();
    },

    removeAppliance(index) {
      this.inputs.appliances.splice(index, 1);
      this.inputs.energyKwh = Math.round((this.totalApplianceWh / 100)) / 10;
      this.hitung();
    },

    get totalApplianceWh() {
      return dailyEnergyFromAppliances(this.inputs.appliances);
    },

    get stringParallelArray() {
      const p = Number(this.results?.stringConfig?.parallel) || 0;
      return Array.from({ length: Math.max(0, p) }, (_, i) => i + 1);
    },

    get stringSeriesArray() {
      const s = Number(this.results?.stringConfig?.series) || 0;
      return Array.from({ length: Math.max(0, s) }, (_, i) => i + 1);
    },

    get batteryModulesArray() {
      const n = Number(this.results?.batteryModules) || 1;
      return Array.from({ length: Math.max(1, n) }, (_, i) => i + 1);
    },

    setMpptCount(count) {
      this.inputs.mpptCount = Number(count) || 1;
      this.hitung();
    },

    getMpptTrackerForString(p) {
      const m = Number(this.inputs.mpptCount) || 1;
      return ((p - 1) % m) + 1;
    },

    get mpptDistributionSummary() {
      const p = Number(this.results?.stringConfig?.parallel) || 1;
      const m = Number(this.inputs.mpptCount) || 1;
      const currentPerMppt = Number(this.results?.stringConfig?.currentPerMppt) || (Number(this.inputs.panelImp) || 13);
      if (m === 1) {
        if (p === 1) return '1 String terhubung langsung ke Port MPPT 1 (Arus: ' + currentPerMppt + 'A)';
        return p + ' String diparalel via combiner box ke 1 Port MPPT (Arus total: ' + currentPerMppt + 'A)';
      }
      if (p === 1) {
        return '1 String ke Port MPPT 1 (Arus: ' + currentPerMppt + 'A) · Port MPPT 2 tidak terpakai';
      }
      if (p === 2) {
        return 'Jalur Mandiri: String 1 ke MPPT 1 & String 2 ke MPPT 2 (' + currentPerMppt + 'A per tracker, tanpa combiner paralel)';
      }
      return p + ' String didistribusikan ke ' + m + ' MPPT Tracker (' + currentPerMppt + 'A per tracker)';
    },

    get chargingHoursPreview() {
      const p = this.inputs.powerMode === 'va'
        ? vaToWatts(this.inputs.powerVa || 1300)
        : (Number(this.inputs.peakPower) || 1040);
      const wh = this.inputs.energyMode === 'appliances'
        ? this.totalApplianceWh
        : ((Number(this.inputs.energyKwh) || 0) * 1000);
      return alternativeChargingHours(wh, p);
    },

    async hitung() {
      const validated = validateInput(this.inputs);
      this.errors = validated.errors;
      this.warnings = validated.warnings;

      if (Object.keys(this.errors).length > 0) {
        return;
      }

      const sizing = calculateSizing(validated.normalized);
      this.results = {
        ...sizing,
        systemVoltage: validated.normalized.systemVoltage || 48,
        energyWh: validated.normalized.energyWh || sizing.energyWh,
        energyKwh: validated.normalized.energyKwh || sizing.energyKwh,
      };
      this.hasResults = true;

      // Persist history + preferences
      await this.saveHistory(this.results);
      await this.savePreferences();
    },

    async saveHistory(sizing) {
      await storage.saveCalculation({
        input: JSON.parse(JSON.stringify(this.inputs)),
        output: JSON.parse(JSON.stringify(sizing)),
      });
      await this.loadHistory();
    },

    savePreferences() {
      return storage.savePreferences(JSON.parse(JSON.stringify(this.inputs)));
    },

    hitungLive() {
      const validated = validateInput(this.inputs);
      this.errors = validated.errors;
      this.warnings = validated.warnings;
    },

    async loadPreferences() {
      try {
        const prefs = await storage.getPreferences();
        if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
          const migrated = {
            powerMode: prefs.powerMode || (prefs.powerVa ? 'va' : (prefs.peakPower ? 'watt' : 'va')),
            powerVa: prefs.powerVa || (prefs.peakPower ? Math.round(prefs.peakPower / 0.8) : 1300),
            peakPower: prefs.peakPower || (prefs.powerVa ? vaToWatts(prefs.powerVa) : 1040),
            energyMode: prefs.energyMode === 'manual' ? 'manual' : 'appliances',
            energyKwh: prefs.energyKwh || 5.1,
            moduleAh: prefs.moduleAh || 200,
            ...prefs,
          };
          let minV = migrated.mpptMinVoltage;
          let maxV = migrated.mpptMaxVoltage;
          let maxI = migrated.mpptMaxCurrent;
          let count = migrated.mpptCount;

          if (migrated.selectedInverterId && migrated.selectedInverterId !== 'custom') {
            const inv = findInverterById(migrated.selectedInverterId, this.inverters);
            if (inv) {
              minV = inv.mpptMinVoltage;
              maxV = inv.mpptMaxVoltage;
              maxI = inv.mpptMaxCurrent;
              count = inv.mpptCount;
            }
          }

          if (!minV || !maxV) {
            const profile = getMpptProfileForInverter(migrated.inverterRatedWatts || 5000);
            minV = minV || profile.mpptMinVoltage;
            maxV = maxV || profile.mpptMaxVoltage;
            maxI = maxI || profile.mpptMaxCurrent;
            count = count || profile.mpptCount;
          }

          this.inputs = {
            ...this.inputs,
            ...migrated,
            mpptMinVoltage: minV,
            mpptMaxVoltage: maxV,
            mpptMaxCurrent: maxI,
            mpptCount: count,
          };
        }
      } catch (e) {
        console.warn('Gagal memuat preferensi lokal:', e);
      }
    },

    async loadHistory() {
      try {
        this.history = await storage.getHistory();
      } catch (e) {
        console.warn('Gagal memuat riwayat:', e);
      }
    },

    async restoreHistory(id) {
      const item = this.history.find((h) => h.id === id);
      if (item) {
        await this.restoreInput(item);
      }
    },

    async restoreInput(item) {
      if (!item || !item.input) return;
      const inp = item.input;
      const migrated = {
        powerMode: inp.powerMode || (inp.powerVa ? 'va' : (inp.peakPower ? 'watt' : 'va')),
        powerVa: inp.powerVa || (inp.peakPower ? Math.round(inp.peakPower / 0.8) : 1300),
        peakPower: inp.peakPower || (inp.powerVa ? vaToWatts(inp.powerVa) : 1040),
        energyMode: inp.energyMode === 'manual' ? 'manual' : 'appliances',
        energyKwh: inp.energyKwh || (item.output?.energyKwh || 5.1),
        moduleAh: inp.moduleAh || 200,
        ...inp,
      };
      this.inputs = { ...this.inputs, ...migrated };
      await this.hitung();
    },

    async removeHistory(id) {
      try {
        await storage.deleteHistory(id);
        await this.loadHistory();
        if (this.historyPage > this.totalHistoryPages) {
          this.historyPage = this.totalHistoryPages;
        }
      } catch (e) {
        console.warn('Gagal menghapus riwayat:', e);
      }
    },

    async clearAllHistory() {
      if (typeof window !== 'undefined' && window.confirm && !window.confirm('Hapus seluruh riwayat perhitungan?')) {
        return;
      }
      try {
        await storage.clearHistory();
        await this.loadHistory();
        this.historyPage = 1;
      } catch (e) {
        console.warn('Gagal membersihkan riwayat:', e);
      }
    },

    nextHistoryPage() {
      if (this.historyPage < this.totalHistoryPages) {
        this.historyPage++;
      }
    },

    prevHistoryPage() {
      if (this.historyPage > 1) {
        this.historyPage--;
      }
    },

    goToHistoryPage(page) {
      const p = Number(page) || 1;
      if (p >= 1 && p <= this.totalHistoryPages) {
        this.historyPage = p;
      }
    },

    get totalHistoryPages() {
      const count = Array.isArray(this.history) ? this.history.length : 0;
      return Math.max(1, Math.ceil(count / this.historyPerPage));
    },

    get paginatedHistory() {
      if (!Array.isArray(this.history)) return [];
      const start = (this.historyPage - 1) * this.historyPerPage;
      return this.history.slice(start, start + this.historyPerPage);
    },

    get historyPageNumbers() {
      return Array.from({ length: this.totalHistoryPages }, (_, i) => i + 1);
    },

    resetForm() {
      this.inputs = {
        powerMode: 'va',
        powerVa: 2200,
        peakPower: 1760,
        energyMode: 'appliances',
        energyKwh: 5.1,
        appliances: [
          { name: 'Kulkas 1 Pintu', watts: 100, hours: 24, qty: 1 },
          { name: 'TV LED & Wifi', watts: 75, hours: 10, qty: 1 },
          { name: 'Lampu LED Rumah', watts: 15, hours: 12, qty: 6 },
          { name: 'Kipas Angin', watts: 45, hours: 10, qty: 2 },
        ],
        newAppliance: { name: '', watts: 50, hours: 8, qty: 1 },
        sph: 4.5,
        systemVoltage: 48,
        batteryType: 'lithium',
        dod: DOD_DEFAULTS.lithium,
        moduleAh: 200,
        autonomyDays: 1,
        selectedPanelId: 'solana-550',
        wpPerPanel: 550,
        panelVmp: 42.1,
        panelVoc: 50.1,
        panelImp: 13.06,
        panelIsc: 13.90,
        selectedInverterId: 'srne-5k',
        inverterRatedWatts: 5000,
        mpptMinVoltage: 60,
        mpptMaxVoltage: 245,
        mpptMaxCurrent: 100,
        mpptCount: 1,
        tariffPerKwh: DEFAULT_TARIFF_PER_KWH,
        ppnPercent: DEFAULT_PPN_PERCENT,
        ppjPercent: DEFAULT_PPJ_PERCENT,
        billingDays: DEFAULT_BILLING_DAYS,
      };
      this.errors = {};
      this.warnings = {};
      this.hitung();
    },

    formatDate(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      const dateStr = d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      return `${dateStr}, ${timeStr} WIB`;
    },

    get inverterClass() {
      if (!this.results) return '';
      return this.results.inverterRecommendation || `${this.results.inverterWatts || 0} W`;
    },
  };
}

if (typeof window !== 'undefined') {
  window.pltsApp = pltsApp;
}

if (typeof document !== 'undefined') {
  document.addEventListener('alpine:init', () => {
    if (typeof Alpine !== 'undefined' && Alpine.data) {
      Alpine.data('pltsApp', pltsApp);
    }
  });
}
