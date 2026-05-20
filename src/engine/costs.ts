import type { VehicleRow, GlobalAssumptions } from '../types';
import type { CostEstimateFactors } from '../types/evaluation';
import { estimateMaintenanceCostDetails } from '../data/maintenanceEstimates';

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
  costFactors: CostEstimateFactors;
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
  const maintenanceEstimate = estimateMaintenanceCostDetails({
    vehicleClass,
    mileage: vehicle.user.mileage,
    vehicleAge,
    condition: vehicle.user.conditionLevel,
    titleStatus: vehicle.user.titleStatus,
    modificationLevel: vehicle.user.modificationLevel ?? 'stock',
    ownershipYears: assumptions.ownershipYears,
  });

  // Fuel: deterministic formula
  const fuelMonthly = realisticMpg > 0
    ? Math.round((annualMiles / realisticMpg) * assumptions.gasPrice / 12)
    : 0;

  // Routine maintenance: from lookup, overridable
  const routineMonthly = vehicle.user.overrides.routineMonthly
    ?? maintenanceEstimate.routineMonthly;

  // Expected repairs: from lookup, overridable
  const expectedRepairsMonthly = vehicle.user.overrides.expectedRepairsMonthly
    ?? maintenanceEstimate.expectedRepairsMonthly;

  // Major repair reserve: from lookup, overridable
  const majorRepairReserveMonthly = vehicle.user.overrides.majorRepairReserveMonthly
    ?? maintenanceEstimate.majorRepairReserveMonthly;

  const costFactors: CostEstimateFactors = {
    routine: vehicle.user.overrides.routineMonthly === undefined
      ? maintenanceEstimate.factors.routine
      : [{ label: 'User override', multiplier: 1 }],
    expectedRepairs: vehicle.user.overrides.expectedRepairsMonthly === undefined
      ? maintenanceEstimate.factors.expectedRepairs
      : [{ label: 'User override', multiplier: 1 }],
    majorRepairReserve: vehicle.user.overrides.majorRepairReserveMonthly === undefined
      ? maintenanceEstimate.factors.majorRepairReserve
      : [{ label: 'User override', multiplier: 1 }],
  };

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
  const purchaseFees = isCurrentCar ? 0 : (vehicle.user.feesCost ?? 0);
  const firstYearCost = isCurrentCar
    ? monthlyBasis1yr * 12 + vehicle.user.catchUpCost
    : vehicle.user.listingPrice * (1 + assumptions.salesTaxRate) + purchaseFees + monthlyBasis1yr * 12 + vehicle.user.catchUpCost;

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
    costFactors,
    firstYearCost,
    totalCostAtHorizon,
  };
}
