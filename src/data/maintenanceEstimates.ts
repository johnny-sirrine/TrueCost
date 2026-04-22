import type { VehicleClass, ConditionLevel } from '../types';

// Routine maintenance: oil changes, tires, brakes, filters, fluids
// Estimated monthly cost by vehicle class and mileage band
interface MaintenanceBand {
  maxMiles: number;
  baseMonthly: number;
}

const ROUTINE_BY_CLASS: Record<VehicleClass, MaintenanceBand[]> = {
  compact_car:          [{ maxMiles: 60000, baseMonthly: 55 }, { maxMiles: 120000, baseMonthly: 70 }, { maxMiles: Infinity, baseMonthly: 90 }],
  midsize_car:          [{ maxMiles: 60000, baseMonthly: 60 }, { maxMiles: 120000, baseMonthly: 80 }, { maxMiles: Infinity, baseMonthly: 100 }],
  fullsize_car:         [{ maxMiles: 60000, baseMonthly: 65 }, { maxMiles: 120000, baseMonthly: 85 }, { maxMiles: Infinity, baseMonthly: 110 }],
  compact_crossover:    [{ maxMiles: 60000, baseMonthly: 60 }, { maxMiles: 120000, baseMonthly: 80 }, { maxMiles: Infinity, baseMonthly: 100 }],
  midsize_crossover:    [{ maxMiles: 60000, baseMonthly: 70 }, { maxMiles: 120000, baseMonthly: 90 }, { maxMiles: Infinity, baseMonthly: 115 }],
  fullsize_suv:         [{ maxMiles: 60000, baseMonthly: 80 }, { maxMiles: 120000, baseMonthly: 105 }, { maxMiles: Infinity, baseMonthly: 135 }],
  body_on_frame_suv:    [{ maxMiles: 60000, baseMonthly: 80 }, { maxMiles: 120000, baseMonthly: 100 }, { maxMiles: Infinity, baseMonthly: 130 }],
  compact_truck:        [{ maxMiles: 60000, baseMonthly: 70 }, { maxMiles: 120000, baseMonthly: 90 }, { maxMiles: Infinity, baseMonthly: 115 }],
  fullsize_truck:       [{ maxMiles: 60000, baseMonthly: 80 }, { maxMiles: 120000, baseMonthly: 105 }, { maxMiles: Infinity, baseMonthly: 135 }],
  van:                  [{ maxMiles: 60000, baseMonthly: 70 }, { maxMiles: 120000, baseMonthly: 90 }, { maxMiles: Infinity, baseMonthly: 115 }],
};

// Expected non-routine repairs: things that break and need fixing beyond scheduled maintenance.
// Higher for older vehicles and those in worse condition.
const REPAIR_AGE_MULTIPLIERS: [number, number][] = [
  [5, 0.5],    // 0-5 years: minimal unexpected repairs
  [10, 0.8],   // 6-10 years: some age-related repairs
  [15, 1.0],   // 11-15 years: baseline repair rate
  [20, 1.3],   // 16-20 years: increasing repair frequency
];

const REPAIR_CONDITION_MULTIPLIERS: Record<ConditionLevel, number> = {
  excellent: 0.7,
  average: 1.0,
  mild_mods: 1.2,
  poor: 1.6,
};

const BASE_REPAIR_BY_CLASS: Record<VehicleClass, number> = {
  compact_car: 40,
  midsize_car: 50,
  fullsize_car: 60,
  compact_crossover: 50,
  midsize_crossover: 60,
  fullsize_suv: 80,
  body_on_frame_suv: 70,
  compact_truck: 55,
  fullsize_truck: 75,
  van: 65,
};

// Major repair reserve: prudent set-aside for larger, less frequent events.
// Engine/transmission work, major suspension, AC compressor, etc.
// Scales with ownership horizon because longer ownership = more exposure.
const MAJOR_RESERVE_BY_CLASS: Record<VehicleClass, number> = {
  compact_car: 60,
  midsize_car: 70,
  fullsize_car: 85,
  compact_crossover: 70,
  midsize_crossover: 80,
  fullsize_suv: 110,
  body_on_frame_suv: 95,
  compact_truck: 80,
  fullsize_truck: 100,
  van: 85,
};

export function estimateRoutineMonthly(
  vehicleClass: VehicleClass,
  mileage: number,
): number {
  const bands = ROUTINE_BY_CLASS[vehicleClass] ?? ROUTINE_BY_CLASS.midsize_crossover;
  for (const band of bands) {
    if (mileage <= band.maxMiles) return band.baseMonthly;
  }
  return bands[bands.length - 1].baseMonthly;
}

export function estimateExpectedRepairsMonthly(
  vehicleClass: VehicleClass,
  vehicleAge: number,
  condition: ConditionLevel,
): number {
  const baseRepair = BASE_REPAIR_BY_CLASS[vehicleClass] ?? 60;

  let ageMult = 1.0;
  for (const [maxAge, mult] of REPAIR_AGE_MULTIPLIERS) {
    if (vehicleAge <= maxAge) { ageMult = mult; break; }
  }
  if (vehicleAge > 20) ageMult = 1.6;

  const condMult = REPAIR_CONDITION_MULTIPLIERS[condition] ?? 1.0;
  return Math.round(baseRepair * ageMult * condMult);
}

export function estimateMajorRepairReserveMonthly(
  vehicleClass: VehicleClass,
  vehicleAge: number,
  ownershipYears: number,
): number {
  const base = MAJOR_RESERVE_BY_CLASS[vehicleClass] ?? 80;

  // Scale with vehicle age: older vehicles need larger reserve
  let ageMult = 1.0;
  if (vehicleAge > 15) ageMult = 1.4;
  else if (vehicleAge > 10) ageMult = 1.2;
  else if (vehicleAge > 5) ageMult = 1.0;
  else ageMult = 0.6;

  // Longer ownership horizon spreads exposure more evenly
  // but also increases total expected exposure
  const horizonFactor = ownershipYears <= 2 ? 1.1 : ownershipYears <= 5 ? 1.0 : 0.95;

  return Math.round(base * ageMult * horizonFactor);
}
