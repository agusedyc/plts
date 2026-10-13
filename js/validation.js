const DEFAULT_WP_PER_PANEL = 550;

function isInvalidNumber(value) {
  return value === '' || value === null || value === undefined || !(Number(value) > 0) || Number.isNaN(Number(value));
}

export function validateInput(input) {
  const errors = {};
  const warnings = {};

  // Required positive numbers
  for (const key of ['peakPower', 'energyKwh', 'sph', 'systemVoltage', 'dod']) {
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
  if (!Number.isNaN(sph) && sph > 10) {
    sph = 10;
    warnings.sph = 'Jam efektif matahari dibatasi hingga 10 jam.';
  }

  // Autonomy days: default 1, clamp to [1,5]
  let autonomyDays = input.autonomyDays === '' || input.autonomyDays === null || input.autonomyDays === undefined
    ? 1
    : Number(input.autonomyDays);
  if (Number.isNaN(autonomyDays) || autonomyDays < 1) autonomyDays = 1;
  if (autonomyDays > 5) autonomyDays = 5;

  const wpPerPanel = Number(input.wpPerPanel) > 0 ? Number(input.wpPerPanel) : DEFAULT_WP_PER_PANEL;

  return {
    errors,
    warnings,
    normalized: {
      peakPower: Number(input.peakPower),
      energyWh: Number(input.energyKwh) * 1000,
      sph,
      systemVoltage: Number(input.systemVoltage),
      dod,
      autonomyDays,
      wpPerPanel,
    },
  };
}
