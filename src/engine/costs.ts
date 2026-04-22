import type { VehicleRow, GlobalAssumptions } from '../types';
import { estimateRoutineMonthly, estimateExpectedRepairsMonthly, estimateMajorRepairReserveMonthly } from '../data/maintenanceEstimates';

const CURRENT_YEAR = new Date().getFullYear();

export interface CostBreakdown {
  fuelMonthly: number;
  routineMonthly: number;
  expectedRepairsMonthly: number;
  registrationMonthly: number;
  parkingAndTollsMonthly: number;
  majorRepairReserveMonthly: number;
  insuranceMonthly: number;
  baselineMonthly: number;
  allInMonthly: number;
  firstYearCost: number;
  totalCostAtHorizon: number;
}

export function computeCosts(
  vehicle: VehicleRow,
  assumptions: GlobalAssumptions,
  realisticMpg: number,
  insuranceMonthly: number,
): CostBreakdown {
  const annualMiles = vehicle.user.overrides.annualMiles ?? assumptions.annualMiles;
  const vehicleAge = CURRENT_YEAR - vehicle.canonical.year;
  const vehicleClass = vehicle.canonical.vehicleClass ?? 'midsize_crossover';
  const isCurrentCar = vehicle.user.isCurrentCar;

  // Fuel: deterministic formula
  const fuelMonthly = realisticMpg > 0
    ? Math.round((annualMiles / realisticMpg) * assumptions.gasPrice / 12)
    : 0;

  // Routine maintenance: from lookup, overridable
  const routineMonthly = vehicle.user.overrides.routineMonthly
    ?? estimateRoutineMonthly(vehicleClass, vehicle.user.mileage);

  // Expected repairs: from lookup, overridable
  const expectedRepairsMonthly = vehicle.user.overrides.expectedRepairsMonthly
    ?? estimateExpectedRepairsMonthly(vehicleClass, vehicleAge, vehicle.user.conditionLevel);

  // Major repair reserve: from lookup, overridable
  const majorRepairReserveMonthly = vehicle.user.overrides.majorRepairReserveMonthly
    ?? estimateMajorRepairReserveMonthly(vehicleClass, vehicleAge, assumptions.ownershipYears);

  // Fixed ownership costs
  const registrationMonthly = Math.round(assumptions.annualRegistrationFees / 12);
  const parkingAndTollsMonthly = assumptions.monthlyParkingAndTolls;

  // Cost tiers
  const baselineMonthly = fuelMonthly + routineMonthly + expectedRepairsMonthly + registrationMonthly + parkingAndTollsMonthly;
  const allInMonthly = baselineMonthly + insuranceMonthly + majorRepairReserveMonthly;

  // Monthly basis for aggregated costs: insurance always included, reserve toggled
  const withInsurance = baselineMonthly + insuranceMonthly;

  // First-year cost
  const monthlyBasis1yr = assumptions.includeMajorRepairReserveInFirstYear
    ? withInsurance + majorRepairReserveMonthly : withInsurance;
  const firstYearCost = isCurrentCar
    ? monthlyBasis1yr * 12 + vehicle.user.catchUpCost
    : vehicle.user.listingPrice * (1 + assumptions.salesTaxRate) + monthlyBasis1yr * 12 + vehicle.user.catchUpCost;

  // Total cost at horizon (resaleLoss added by orchestrator)
  const horizonMonthlyBasis = assumptions.includeMajorRepairReserveInTotalCost
    ? withInsurance + majorRepairReserveMonthly : withInsurance;
  const totalCostAtHorizon = horizonMonthlyBasis * 12 * assumptions.ownershipYears;

  return {
    fuelMonthly,
    routineMonthly,
    expectedRepairsMonthly,
    registrationMonthly,
    parkingAndTollsMonthly,
    majorRepairReserveMonthly,
    insuranceMonthly,
    baselineMonthly,
    allInMonthly,
    firstYearCost,
    totalCostAtHorizon,
  };
}
