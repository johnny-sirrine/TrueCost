import type { VehicleRow, GlobalAssumptions, VehicleClass } from '../types';
import type { InsuranceCoverageMode } from '../types/assumptions';

// Rough-estimate insurance model.
// NOT actuarial — a labeled approximation for comparison purposes.
// Every number here is overridable per vehicle.

const BASE_LIABILITY_MONTHLY = 65; // National-average-ish liability baseline

const AGE_FACTORS: Record<string, number> = {
  under_25: 1.60,
  '25_39': 1.00,
  '40_65': 0.92,
  over_65: 1.08,
};

const RECORD_FACTORS: Record<string, number> = {
  clean: 1.00,
  minor: 1.20,
  major: 1.55,
};

function mileageFactor(annualMiles: number): number {
  if (annualMiles < 7500) return 0.90;
  if (annualMiles <= 12000) return 1.00;
  if (annualMiles <= 18000) return 1.08;
  return 1.15;
}

// Comp+collision: ~4% of vehicle market value per year.
// This is a rough average — real rates vary by insurer, deductible, etc.
const COMP_COLLISION_ANNUAL_RATE = 0.04;

// Vehicle class risk modifiers for comp+collision portion
const VEHICLE_RISK: Record<VehicleClass, number> = {
  compact_car: 1.00,
  midsize_car: 1.00,
  fullsize_car: 1.05,
  compact_crossover: 0.95,
  midsize_crossover: 1.00,
  fullsize_suv: 1.05,
  body_on_frame_suv: 0.90,
  compact_truck: 0.85,
  fullsize_truck: 0.95,
  van: 1.00,
};

export interface InsuranceResult {
  insuranceMonthly: number;
  coverageMode: InsuranceCoverageMode;
  liabilityMonthly: number;
  compCollisionMonthly: number;
}

export function computeInsurance(
  vehicle: VehicleRow,
  assumptions: GlobalAssumptions,
  currentMarketValue: number,
): InsuranceResult {
  // Full override: user specified exact monthly amount
  if (vehicle.user.overrides.insuranceMonthly !== undefined) {
    const mode = vehicle.user.overrides.insuranceCoverageMode ?? assumptions.insuranceCoverageDefault;
    return {
      insuranceMonthly: vehicle.user.overrides.insuranceMonthly,
      coverageMode: mode,
      liabilityMonthly: vehicle.user.overrides.insuranceMonthly,
      compCollisionMonthly: 0,
    };
  }

  const coverageMode = vehicle.user.overrides.insuranceCoverageMode ?? assumptions.insuranceCoverageDefault;
  const annualMiles = vehicle.user.overrides.annualMiles ?? assumptions.annualMiles;

  // Liability portion — driven by driver demographics, not vehicle
  const ageFactor = AGE_FACTORS[assumptions.driverAgeRange] ?? 1.0;
  const recordFactor = RECORD_FACTORS[assumptions.drivingRecord] ?? 1.0;
  const milesFactor = mileageFactor(annualMiles);
  const liabilityMonthly = Math.round(BASE_LIABILITY_MONTHLY * ageFactor * recordFactor * milesFactor);

  // Comp+collision portion — driven by vehicle value and class (full coverage only)
  let compCollisionMonthly = 0;
  if (coverageMode === 'full_coverage') {
    const vehicleClass = vehicle.canonical.vehicleClass ?? 'midsize_crossover';
    const riskFactor = VEHICLE_RISK[vehicleClass] ?? 1.0;
    compCollisionMonthly = Math.round(currentMarketValue * COMP_COLLISION_ANNUAL_RATE / 12 * riskFactor);
  }

  return {
    insuranceMonthly: liabilityMonthly + compCollisionMonthly,
    coverageMode,
    liabilityMonthly,
    compCollisionMonthly,
  };
}
