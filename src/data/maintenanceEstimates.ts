import type { CostEstimateFactor, CostEstimateFactors } from '../types/evaluation';
import type { VehicleClass, ConditionLevel, TitleStatus } from '../types/vehicle';

type CostComponent = keyof CostEstimateFactors;

interface FactorAnchor {
  at: number;
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
  ownershipYears: number;
  make?: string;
  model?: string;
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

const MILEAGE_FACTOR_ANCHORS: FactorAnchor[] = [
  { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  { at: 80000, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  { at: 120000, routine: 1.08, expectedRepairs: 1.12, majorRepairReserve: 1.10 },
  { at: 160000, routine: 1.18, expectedRepairs: 1.30, majorRepairReserve: 1.25 },
  { at: 220000, routine: 1.25, expectedRepairs: 1.40, majorRepairReserve: 1.35 },
];

const AGE_FACTOR_ANCHORS: FactorAnchor[] = [
  { at: 0, routine: 0.90, expectedRepairs: 0.75, majorRepairReserve: 0.75 },
  { at: 5, routine: 0.95, expectedRepairs: 0.85, majorRepairReserve: 0.85 },
  { at: 10, routine: 1.00, expectedRepairs: 0.95, majorRepairReserve: 0.95 },
  { at: 15, routine: 1.08, expectedRepairs: 1.12, majorRepairReserve: 1.12 },
  { at: 20, routine: 1.15, expectedRepairs: 1.25, majorRepairReserve: 1.25 },
  { at: 25, routine: 1.20, expectedRepairs: 1.35, majorRepairReserve: 1.35 },
];

const CONDITION_MULTIPLIERS: Record<ConditionLevel, FactorAnchor> = {
  excellent: { at: 0, routine: 0.95, expectedRepairs: 0.90, majorRepairReserve: 0.90 },
  average: { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  mild_mods: { at: 0, routine: 1.06, expectedRepairs: 1.12, majorRepairReserve: 1.12 },
  poor: { at: 0, routine: 1.15, expectedRepairs: 1.25, majorRepairReserve: 1.25 },
};

const TITLE_MULTIPLIERS: Record<TitleStatus, FactorAnchor> = {
  clean: { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  unknown: { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
  rebuilt: { at: 0, routine: 1.00, expectedRepairs: 1.08, majorRepairReserve: 1.10 },
  salvage: { at: 0, routine: 1.00, expectedRepairs: 1.15, majorRepairReserve: 1.18 },
  lemon: { at: 0, routine: 1.00, expectedRepairs: 1.15, majorRepairReserve: 1.18 },
};

const EUROPEAN_LUXURY_MAKES = new Set([
  'audi',
  'bmw',
  'jaguar',
  'land rover',
  'mercedes-benz',
  'mercedes',
  'mini',
  'porsche',
  'volvo',
]);

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
  make?: string,
  model?: string,
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    mileage,
    vehicleAge,
    make,
    model,
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
  make?: string,
  model?: string,
  titleStatus: TitleStatus = 'clean',
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    vehicleAge,
    condition,
    mileage,
    make,
    model,
    titleStatus,
    ownershipYears: 5,
  }).expectedRepairsMonthly;
}

export function estimateMajorRepairReserveMonthly(
  vehicleClass: VehicleClass,
  vehicleAge: number,
  ownershipYears: number,
  mileage = 100000,
  make?: string,
  model?: string,
  titleStatus: TitleStatus = 'clean',
  condition: ConditionLevel = 'average',
): number {
  return estimateMaintenanceCostDetails({
    vehicleClass,
    vehicleAge,
    ownershipYears,
    mileage,
    make,
    model,
    titleStatus,
    condition,
  }).majorRepairReserveMonthly;
}

function buildFactors(input: EstimateInput): CostEstimateFactors {
  const mileageFactors = factorForAnchors(input.mileage, MILEAGE_FACTOR_ANCHORS, mileageLabel(input.mileage));
  const ageFactors = factorForAnchors(input.vehicleAge, AGE_FACTOR_ANCHORS, ageLabel(input.vehicleAge));
  const platformFactors = platformAdjustment(input.make, input.model, input.vehicleClass, input.mileage);
  const conditionFactors = namedFactors(CONDITION_MULTIPLIERS[input.condition] ?? CONDITION_MULTIPLIERS.average, `Condition: ${input.condition}`);
  const titleFactors = namedFactors(TITLE_MULTIPLIERS[input.titleStatus] ?? TITLE_MULTIPLIERS.unknown, `Title: ${input.titleStatus}`);
  const horizonFactors = namedFactors(horizonAdjustment(input.ownershipYears), `Ownership horizon: ${input.ownershipYears} yr`);

  return {
    routine: [
      mileageFactors.routine,
      ageFactors.routine,
      platformFactors.routine,
      conditionFactors.routine,
    ],
    expectedRepairs: [
      mileageFactors.expectedRepairs,
      ageFactors.expectedRepairs,
      platformFactors.expectedRepairs,
      conditionFactors.expectedRepairs,
      titleFactors.expectedRepairs,
    ],
    majorRepairReserve: [
      mileageFactors.majorRepairReserve,
      ageFactors.majorRepairReserve,
      platformFactors.majorRepairReserve,
      conditionFactors.majorRepairReserve,
      titleFactors.majorRepairReserve,
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

function factorForAnchors(value: number, anchors: FactorAnchor[], label: string): Record<CostComponent, CostEstimateFactor> {
  const interpolated = interpolateAnchors(value, anchors);
  return namedFactors(interpolated, label);
}

function interpolateAnchors(value: number, anchors: FactorAnchor[]): FactorAnchor {
  if (value <= anchors[0].at) return anchors[0];

  for (let i = 1; i < anchors.length; i += 1) {
    const previous = anchors[i - 1];
    const next = anchors[i];
    if (value <= next.at) {
      const progress = (value - previous.at) / (next.at - previous.at);
      return {
        at: value,
        routine: interpolate(previous.routine, next.routine, progress),
        expectedRepairs: interpolate(previous.expectedRepairs, next.expectedRepairs, progress),
        majorRepairReserve: interpolate(previous.majorRepairReserve, next.majorRepairReserve, progress),
      };
    }
  }

  return anchors[anchors.length - 1];
}

function namedFactors(anchor: FactorAnchor, label: string): Record<CostComponent, CostEstimateFactor> {
  return {
    routine: { label, multiplier: anchor.routine },
    expectedRepairs: { label, multiplier: anchor.expectedRepairs },
    majorRepairReserve: { label, multiplier: anchor.majorRepairReserve },
  };
}

function platformAdjustment(
  make = '',
  model = '',
  vehicleClass: VehicleClass,
  mileage: number,
): Record<CostComponent, CostEstimateFactor> {
  const normalizedMake = make.trim().toLowerCase();
  const normalizedModel = model.trim().toLowerCase();
  const defaultAdjustment = namedFactors(
    { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 },
    'Platform: neutral',
  );

  if (!normalizedMake && !normalizedModel) return defaultAdjustment;

  if (normalizedMake === 'toyota' || normalizedMake === 'honda') {
    const truckish = vehicleClass === 'body_on_frame_suv'
      || vehicleClass === 'compact_truck'
      || vehicleClass === 'fullsize_truck'
      || normalizedModel.includes('4runner')
      || normalizedModel.includes('tacoma');

    return namedFactors(
      {
        at: 0,
        routine: truckish ? 1.02 : 0.98,
        expectedRepairs: 0.92,
        majorRepairReserve: truckish ? 0.90 : 0.92,
      },
      truckish ? `${displayMake(make)} truck/SUV reliability adjustment` : `${displayMake(make)} reliability adjustment`,
    );
  }

  if (normalizedMake === 'subaru') {
    const highMileage = mileage >= 120000;
    return namedFactors(
      {
        at: 0,
        routine: highMileage ? 1.02 : 1.00,
        expectedRepairs: highMileage ? 1.06 : 1.03,
        majorRepairReserve: highMileage ? 1.06 : 1.03,
      },
      highMileage ? 'Subaru high-mileage adjustment' : 'Subaru adjustment',
    );
  }

  if (normalizedMake === 'jeep') {
    const highMileage = mileage >= 120000;
    return namedFactors(
      {
        at: 0,
        routine: 1.03,
        expectedRepairs: highMileage ? 1.14 : 1.08,
        majorRepairReserve: highMileage ? 1.16 : 1.10,
      },
      highMileage ? 'Jeep high-mileage adjustment' : 'Jeep adjustment',
    );
  }

  if (EUROPEAN_LUXURY_MAKES.has(normalizedMake)) {
    return namedFactors(
      { at: 0, routine: 1.08, expectedRepairs: 1.16, majorRepairReserve: 1.18 },
      `${displayMake(make)} luxury/European adjustment`,
    );
  }

  if (
    vehicleClass === 'body_on_frame_suv'
    || vehicleClass === 'compact_truck'
    || vehicleClass === 'fullsize_truck'
    || normalizedModel.includes('4runner')
    || normalizedModel.includes('tacoma')
  ) {
    return namedFactors(
      { at: 0, routine: 1.04, expectedRepairs: 0.98, majorRepairReserve: 0.98 },
      'Truck/SUV platform adjustment',
    );
  }

  return defaultAdjustment;
}

function horizonAdjustment(ownershipYears: number): FactorAnchor {
  // Longer horizons spread lumpy risk more evenly; short horizons need a small buffer.
  if (ownershipYears <= 2) return { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.06 };
  if (ownershipYears <= 5) return { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 1.00 };
  return { at: 0, routine: 1.00, expectedRepairs: 1.00, majorRepairReserve: 0.97 };
}

function mileageLabel(mileage: number): string {
  if (mileage < 80000) return 'Mileage: under 80k baseline';
  if (mileage <= 120000) return 'Mileage: 80k-120k mild increase';
  if (mileage <= 160000) return 'Mileage: 120k-160k meaningful increase';
  return 'Mileage: 160k+ high-mileage exposure';
}

function ageLabel(age: number): string {
  if (age <= 5) return 'Age: 0-5 years';
  if (age <= 10) return 'Age: 6-10 years';
  if (age <= 15) return 'Age: 11-15 years';
  if (age <= 20) return 'Age: 16-20 years';
  return 'Age: 20+ years';
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function displayMake(make: string): string {
  const trimmed = make.trim();
  return trimmed || 'Known make';
}
