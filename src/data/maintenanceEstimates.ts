import type { CostEstimateFactor, CostEstimateFactors } from '../types/evaluation';
import type { VehicleClass, ConditionLevel, TitleStatus, ModificationLevel } from '../types/vehicle';

type CostComponent = keyof CostEstimateFactors;

interface ComponentMultipliers {
  routine: number;
  expectedRepairs: number;
  majorRepairReserve: number;
}

interface EstimateInput {
  vehicleClass: VehicleClass;
  mileage: number;
  vehicleAge: number;
  condition: ConditionLevel;
  titleStatus: TitleStatus;
  modificationLevel: ModificationLevel;
  ownershipYears: number;
}

interface EstimateResult {
  routineMonthly: number;
  expectedRepairsMonthly: number;
  majorRepairReserveMonthly: number;
  factors: CostEstimateFactors;
}

// Routine maintenance: oil changes, tires, brakes, filters, fluids.
// Bases are the neutral 80k-120k-ish monthly estimate before smooth factors.
const ROUTINE_BASE_BY_CLASS: Record<VehicleClass, number> = {
  compact_car: 75,
  midsize_car: 85,
  fullsize_car: 90,
  compact_crossover: 85,
  midsize_crossover: 95,
  fullsize_suv: 110,
  body_on_frame_suv: 105,
  compact_truck: 95,
  fullsize_truck: 110,
  van: 95,
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

const CONDITION_MULTIPLIERS: Record<ConditionLevel, ComponentMultipliers> = {
  excellent: { routine: 0.95, expectedRepairs: 0.90, majorRepairReserve: 0.90 },
  average: { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  mild_mods: { routine: 1.06, expectedRepairs: 1.12, majorRepairReserve: 1.12 },
  poor: { routine: 1.15, expectedRepairs: 1.25, majorRepairReserve: 1.25 },
};

const TITLE_MULTIPLIERS: Record<TitleStatus, ComponentMultipliers> = {
  clean: { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  unknown: { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  rebuilt: { routine: 1.00, expectedRepairs: 1.08, majorRepairReserve: 1.10 },
  salvage: { routine: 1.00, expectedRepairs: 1.15, majorRepairReserve: 1.18 },
  lemon: { routine: 1.00, expectedRepairs: 1.15, majorRepairReserve: 1.18 },
};

const MODIFICATION_MULTIPLIERS: Record<ModificationLevel, ComponentMultipliers> = {
  stock: { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  low: { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  medium: { routine: 1.00, expectedRepairs: 1.05, majorRepairReserve: 1.08 },
  high: { routine: 1.00, expectedRepairs: 1.12, majorRepairReserve: 1.18 },
};

const STACK_LIMITS: Record<CostComponent, { min: number; max: number; dampening: number }> = {
  routine: { min: 0.85, max: 1.30, dampening: 0.75 },
  expectedRepairs: { min: 0.75, max: 1.45, dampening: 0.70 },
  majorRepairReserve: { min: 0.75, max: 1.50, dampening: 0.65 },
};

export function estimateMaintenanceCostDetails(input: EstimateInput): EstimateResult {
  const routineBase = ROUTINE_BASE_BY_CLASS[input.vehicleClass] ?? ROUTINE_BASE_BY_CLASS.midsize_crossover;
  const expectedRepairBase = BASE_REPAIR_BY_CLASS[input.vehicleClass] ?? BASE_REPAIR_BY_CLASS.midsize_crossover;
  const majorReserveBase = MAJOR_RESERVE_BY_CLASS[input.vehicleClass] ?? MAJOR_RESERVE_BY_CLASS.midsize_crossover;

  const factors = buildFactors(input);
  const routine = estimateComponent(routineBase, factors.routine, 'routine');
  const expectedRepairs = estimateComponent(expectedRepairBase, factors.expectedRepairs, 'expectedRepairs');
  const majorRepairReserve = estimateComponent(majorReserveBase, factors.majorRepairReserve, 'majorRepairReserve');

  return {
    routineMonthly: routine.monthly,
    expectedRepairsMonthly: expectedRepairs.monthly,
    majorRepairReserveMonthly: majorRepairReserve.monthly,
    factors: {
      routine: routine.factors,
      expectedRepairs: expectedRepairs.factors,
      majorRepairReserve: majorRepairReserve.factors,
    },
  };
}

export function estimateRoutineMonthly(
  vehicleClass: VehicleClass,
  mileage: number,
  vehicleAge = 10,
  modificationLevel: ModificationLevel = 'stock',
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    mileage,
    vehicleAge,
    modificationLevel,
    condition: 'average',
    titleStatus: 'clean',
    ownershipYears: 5,
  }).routineMonthly;
}

export function estimateExpectedRepairsMonthly(
  vehicleClass: VehicleClass,
  vehicleAge: number,
  condition: ConditionLevel,
  mileage = 100000,
  titleStatus: TitleStatus = 'clean',
  modificationLevel: ModificationLevel = 'stock',
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    vehicleAge,
    condition,
    mileage,
    titleStatus,
    modificationLevel,
    ownershipYears: 5,
  }).expectedRepairsMonthly;
}

export function estimateMajorRepairReserveMonthly(
  vehicleClass: VehicleClass,
  vehicleAge: number,
  ownershipYears: number,
  mileage = 100000,
  titleStatus: TitleStatus = 'clean',
  condition: ConditionLevel = 'average',
  modificationLevel: ModificationLevel = 'stock',
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    vehicleAge,
    ownershipYears,
    mileage,
    titleStatus,
    condition,
    modificationLevel,
  }).majorRepairReserveMonthly;
}

function buildFactors(input: EstimateInput): CostEstimateFactors {
  const mileageFactors = smoothMileageFactors(input.mileage);
  const ageFactors = smoothAgeFactors(input.vehicleAge);
  const conditionFactors = namedFactors(CONDITION_MULTIPLIERS[input.condition] ?? CONDITION_MULTIPLIERS.average, `Condition: ${input.condition}`);
  const titleFactors = namedFactors(TITLE_MULTIPLIERS[input.titleStatus] ?? TITLE_MULTIPLIERS.unknown, `Title: ${input.titleStatus}`);
  const modificationFactors = namedFactors(
    MODIFICATION_MULTIPLIERS[input.modificationLevel] ?? MODIFICATION_MULTIPLIERS.stock,
    `Modification: ${modificationLabel(input.modificationLevel)}`,
  );
  const horizonFactors = namedFactors(horizonAdjustment(input.ownershipYears), `Ownership horizon: ${input.ownershipYears} yr`);

  return {
    routine: [
      mileageFactors.routine,
      ageFactors.routine,
      conditionFactors.routine,
    ],
    expectedRepairs: [
      mileageFactors.expectedRepairs,
      ageFactors.expectedRepairs,
      conditionFactors.expectedRepairs,
      titleFactors.expectedRepairs,
      modificationFactors.expectedRepairs,
    ],
    majorRepairReserve: [
      mileageFactors.majorRepairReserve,
      ageFactors.majorRepairReserve,
      conditionFactors.majorRepairReserve,
      titleFactors.majorRepairReserve,
      modificationFactors.majorRepairReserve,
      horizonFactors.majorRepairReserve,
    ],
  };
}

function estimateComponent(
  base: number,
  factors: CostEstimateFactor[],
  component: CostComponent,
): { monthly: number; factors: CostEstimateFactor[] } {
  const limited = conservativeStack(factors, component);
  return {
    monthly: roundToFive(base * limited.multiplier),
    factors: limited.factors,
  };
}

function conservativeStack(
  factors: CostEstimateFactor[],
  component: CostComponent,
): { multiplier: number; factors: CostEstimateFactor[] } {
  const raw = factors.reduce((product, factor) => product * factor.multiplier, 1);
  const limits = STACK_LIMITS[component];
  const dampened = raw >= 1
    ? 1 + (raw - 1) * limits.dampening
    : 1 - (1 - raw) * Math.min(limits.dampening + 0.1, 1);
  const multiplier = clamp(dampened, limits.min, limits.max);

  if (Math.abs(multiplier - raw) < 0.01) {
    return { multiplier, factors };
  }

  return {
    multiplier,
    factors: [
      ...factors,
      { label: 'Conservative stack dampening/cap', multiplier: multiplier / raw },
    ],
  };
}

function smoothMileageFactors(mileage: number): Record<CostComponent, CostEstimateFactor> {
  const load = clamp((mileage - 80000) / 120000, 0, 1);
  return namedFactors({
    routine: 1 + 0.10 * load,
    expectedRepairs: 1 + 0.25 * load,
    majorRepairReserve: 1 + 0.40 * load,
  }, mileageLabel(mileage));
}

function smoothAgeFactors(age: number): Record<CostComponent, CostEstimateFactor> {
  const load = clamp((age - 5) / 20, -0.2, 1);
  return namedFactors({
    routine: 1 + 0.08 * load,
    expectedRepairs: 1 + 0.20 * load,
    majorRepairReserve: 1 + 0.30 * load,
  }, ageLabel(age));
}

function namedFactors(anchor: ComponentMultipliers, label: string): Record<CostComponent, CostEstimateFactor> {
  return {
    routine: { label, multiplier: anchor.routine },
    expectedRepairs: { label, multiplier: anchor.expectedRepairs },
    majorRepairReserve: { label, multiplier: anchor.majorRepairReserve },
  };
}

function horizonAdjustment(ownershipYears: number): ComponentMultipliers {
  // Longer horizons spread lumpy risk more evenly; short horizons need a small buffer.
  if (ownershipYears <= 2) return { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.06 };
  if (ownershipYears <= 5) return { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 };
  return { routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 0.97 };
}

function mileageLabel(mileage: number): string {
  return `Mileage: ${Math.round(mileage / 1000)}k mi smooth factor`;
}

function ageLabel(age: number): string {
  return `Age: ${age} yr smooth factor`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function modificationLabel(level: ModificationLevel): string {
  const labels: Record<ModificationLevel, string> = {
    stock: 'stock',
    low: 'low',
    medium: 'medium',
    high: 'high',
  };
  return labels[level] ?? labels.stock;
}
