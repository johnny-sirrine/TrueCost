import type { VehicleClass, BodyStyle, Drivetrain, DepreciationProfileId, TitleStatus, ConditionLevel } from '../types';

// EPA combined MPG lookup by make/model/year (common vehicles)
// This is a reference table for auto-derivation. Not exhaustive.
interface EpaEntry {
  combinedMpg: number;
  vehicleClass: VehicleClass;
  bodyStyle: BodyStyle;
  cylinders?: number;
}

// Key format: "make:model" (lowercase) or "make:model:yearRange"
const EPA_REFERENCE: Record<string, EpaEntry> = {
  'subaru:forester': { combinedMpg: 28, vehicleClass: 'compact_crossover', bodyStyle: 'crossover', cylinders: 4 },
  'mazda:cx-9': { combinedMpg: 23, vehicleClass: 'midsize_crossover', bodyStyle: 'crossover', cylinders: 4 },
  'toyota:4runner': { combinedMpg: 18, vehicleClass: 'body_on_frame_suv', bodyStyle: 'suv', cylinders: 6 },
  'honda:pilot': { combinedMpg: 23, vehicleClass: 'midsize_crossover', bodyStyle: 'crossover', cylinders: 6 },
  'kia:sorento': { combinedMpg: 24, vehicleClass: 'midsize_crossover', bodyStyle: 'crossover', cylinders: 4 },
  'nissan:frontier': { combinedMpg: 19, vehicleClass: 'compact_truck', bodyStyle: 'truck', cylinders: 6 },
  // Common additional vehicles for future reference
  'toyota:tacoma': { combinedMpg: 20, vehicleClass: 'compact_truck', bodyStyle: 'truck', cylinders: 6 },
  'toyota:highlander': { combinedMpg: 24, vehicleClass: 'midsize_crossover', bodyStyle: 'crossover', cylinders: 6 },
  'toyota:rav4': { combinedMpg: 30, vehicleClass: 'compact_crossover', bodyStyle: 'crossover', cylinders: 4 },
  'honda:cr-v': { combinedMpg: 30, vehicleClass: 'compact_crossover', bodyStyle: 'crossover', cylinders: 4 },
  'subaru:outback': { combinedMpg: 29, vehicleClass: 'midsize_crossover', bodyStyle: 'wagon', cylinders: 4 },
  'ford:f-150': { combinedMpg: 21, vehicleClass: 'fullsize_truck', bodyStyle: 'truck', cylinders: 6 },
  'chevrolet:silverado': { combinedMpg: 20, vehicleClass: 'fullsize_truck', bodyStyle: 'truck', cylinders: 6 },
  'jeep:wrangler': { combinedMpg: 20, vehicleClass: 'body_on_frame_suv', bodyStyle: 'suv', cylinders: 6 },
  'jeep:grand cherokee': { combinedMpg: 22, vehicleClass: 'midsize_crossover', bodyStyle: 'suv', cylinders: 6 },
};

export function lookupEpaReference(make: string, model: string): EpaEntry | null {
  const key = `${make.toLowerCase()}:${model.toLowerCase()}`;
  return EPA_REFERENCE[key] ?? null;
}

// --- Multiplier-chain market value estimation ---
// currentMarketValue = baseValue * mileageMultiplier * titleMultiplier * conditionMultiplier
// Each multiplier is bounded and explainable.

interface MarketAnchor {
  msrpApprox: number;
  valueRetention: 'strong' | 'normal' | 'weak';
}

const MARKET_ANCHORS: Record<string, MarketAnchor> = {
  'subaru:forester': { msrpApprox: 28000, valueRetention: 'normal' },
  'mazda:cx-9': { msrpApprox: 38000, valueRetention: 'normal' },
  'toyota:4runner': { msrpApprox: 36000, valueRetention: 'strong' },
  'honda:pilot': { msrpApprox: 36000, valueRetention: 'normal' },
  'kia:sorento': { msrpApprox: 30000, valueRetention: 'normal' },
  'honda:cr-v': { msrpApprox: 28000, valueRetention: 'normal' },
  'nissan:frontier': { msrpApprox: 28000, valueRetention: 'strong' },
  'toyota:tacoma': { msrpApprox: 32000, valueRetention: 'strong' },
  'toyota:highlander': { msrpApprox: 38000, valueRetention: 'normal' },
};

// Year-by-year retained fraction of MSRP. Decelerates over time.
const AGE_CURVES: Record<string, number[]> = {
  //          yr0   yr1   yr2   yr3   yr4   yr5   yr6   yr7   yr8   yr9  yr10  yr11  yr12  yr13  yr14  yr15  yr16  yr17  yr18  yr19  yr20+
  strong: [1.0, 0.88, 0.80, 0.74, 0.69, 0.65, 0.61, 0.58, 0.55, 0.52, 0.50, 0.48, 0.46, 0.44, 0.42, 0.40, 0.39, 0.38, 0.37, 0.36, 0.35],
  normal: [1.0, 0.82, 0.72, 0.64, 0.57, 0.51, 0.46, 0.42, 0.39, 0.36, 0.34, 0.32, 0.30, 0.28, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21, 0.20],
  weak:   [1.0, 0.78, 0.65, 0.55, 0.47, 0.41, 0.36, 0.32, 0.29, 0.26, 0.24, 0.22, 0.20, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12],
};

function ageCurveFraction(age: number, retention: 'strong' | 'normal' | 'weak'): number {
  const curve = AGE_CURVES[retention];
  return curve[Math.min(age, curve.length - 1)];
}

// Mileage multiplier: how actual mileage compares to expected-for-age.
// Asymmetric: penalty for high mileage is stronger than bonus for low mileage.
// Expected miles cap at 180k so old vehicles aren't treated as "low mileage" just for surviving.
export function mileageMultiplier(mileage: number, age: number): number {
  const expectedMiles = Math.min(age * 12000, 180000);
  const deltaK = (mileage - expectedMiles) / 1000;
  // Asymmetric: full penalty above expected, half bonus below
  const sensitivity = deltaK > 0 ? 0.0015 : 0.00075;
  const raw = 1.0 - deltaK * sensitivity;
  return Math.max(0.75, Math.min(1.08, raw));
}

// Title multiplier: clean = 1.0, rebuilt = 0.65, salvage = 0.50
const TITLE_MULTIPLIERS: Record<TitleStatus, number> = {
  clean: 1.0,
  rebuilt: 0.72,
  salvage: 0.55,
  lemon: 0.55,
  unknown: 0.80,
};

export function titleMultiplier(titleStatus: TitleStatus): number {
  return TITLE_MULTIPLIERS[titleStatus] ?? 0.80;
}

// Condition multiplier: excellent = 1.10, average = 1.0, mild_mods = 0.95, poor = 0.80
const CONDITION_MULTIPLIERS: Record<ConditionLevel, number> = {
  excellent: 1.10,
  average: 1.00,
  mild_mods: 0.95,
  poor: 0.80,
};

export function conditionMultiplier(condition: ConditionLevel): number {
  return CONDITION_MULTIPLIERS[condition] ?? 1.0;
}

export function estimateCurrentMarketValue(
  make: string,
  model: string,
  year: number,
  mileage: number,
  titleStatus: TitleStatus,
  condition: ConditionLevel = 'average',
): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const key = `${make.toLowerCase()}:${model.toLowerCase()}`;
  const anchor = MARKET_ANCHORS[key];

  const msrp = anchor?.msrpApprox ?? 30000;
  const retention = anchor?.valueRetention ?? 'normal';

  // baseValue = MSRP * age-curve fraction
  const baseValue = msrp * ageCurveFraction(age, retention);

  // Multiply through the chain
  const value = baseValue
    * mileageMultiplier(mileage, age)
    * titleMultiplier(titleStatus)
    * conditionMultiplier(condition);

  return Math.max(Math.round(value / 100) * 100, 2000);
}

// Auto-assign depreciation profile based on vehicle characteristics
export function inferDepreciationProfile(
  _make: string,
  model: string,
  year: number,
  _titleStatus: TitleStatus,
): DepreciationProfileId {
  // Title status does NOT affect depreciation profile selection.
  // The purchase price already reflects the branded-title discount;
  // forward depreciation is driven by vehicle characteristics, not title.
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Durable value-holders
  const durables = ['4runner', 'tacoma', 'wrangler', 'frontier', 'tundra'];
  if (durables.includes(model.toLowerCase())) {
    return 'value_flattened_durable';
  }

  // Newer vehicles still on steep curve
  if (age <= 5) {
    return 'still_depreciating';
  }

  // Everything else: normal midlife
  return 'normal_midlife';
}

// Auto-derive vehicle class from make/model
export function inferVehicleClass(make: string, model: string): VehicleClass | undefined {
  const ref = lookupEpaReference(make, model);
  return ref?.vehicleClass;
}

// Auto-derive body style from make/model
export function inferBodyStyle(make: string, model: string): BodyStyle | undefined {
  const ref = lookupEpaReference(make, model);
  return ref?.bodyStyle;
}

// Infer drivetrain from model name / trim hints
export function inferDrivetrainFromText(text: string): Drivetrain | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('4wd') || lower.includes('4x4') || lower.includes('four wheel')) return '4wd';
  if (lower.includes('awd') || lower.includes('all wheel') || lower.includes('all-wheel')) return 'awd';
  if (lower.includes('fwd') || lower.includes('front wheel') || lower.includes('front-wheel')) return 'fwd';
  if (lower.includes('rwd') || lower.includes('rear wheel') || lower.includes('rear-wheel')) return 'rwd';
  return undefined;
}
