import { describe, expect, it } from 'vitest';
import type { ConditionLevel, ModificationLevel, TitleStatus, VehicleClass } from '../types/vehicle';
import { estimateMaintenanceCostDetails } from './maintenanceEstimates';

function estimate(overrides: Partial<{
  vehicleClass: VehicleClass;
  mileage: number;
  vehicleAge: number;
  condition: ConditionLevel;
  titleStatus: TitleStatus;
  modificationLevel: ModificationLevel;
  ownershipYears: number;
}> = {}) {
  return estimateMaintenanceCostDetails({
    vehicleClass: overrides.vehicleClass ?? 'midsize_crossover',
    mileage: overrides.mileage ?? 100000,
    vehicleAge: overrides.vehicleAge ?? 10,
    condition: overrides.condition ?? 'average',
    titleStatus: overrides.titleStatus ?? 'clean',
    modificationLevel: overrides.modificationLevel ?? 'stock',
    ownershipYears: overrides.ownershipYears ?? 5,
  });
}

function modificationFactor(
  result: ReturnType<typeof estimate>,
  component: 'expectedRepairs' | 'majorRepairReserve',
) {
  return result.factors[component].find((factor) => factor.label.startsWith('Modification:'))?.multiplier;
}

describe('maintenance and repair estimates', () => {
  it('nudges high-mileage repair exposure higher without making mileage overconfident', () => {
    const lowerMileage = estimate({
      vehicleAge: 10,
      mileage: 93000,
    });
    const highMileage = estimate({
      vehicleAge: 10,
      mileage: 162000,
    });

    expect(highMileage.expectedRepairsMonthly).toBeGreaterThan(lowerMileage.expectedRepairsMonthly);
    expect(highMileage.majorRepairReserveMonthly).toBeGreaterThan(lowerMileage.majorRepairReserveMonthly);
    expect(highMileage.expectedRepairsMonthly / lowerMileage.expectedRepairsMonthly).toBeLessThanOrEqual(1.20);
    expect(highMileage.majorRepairReserveMonthly / lowerMileage.majorRepairReserveMonthly).toBeLessThanOrEqual(1.25);
  });

  it('smooths mileage differences instead of creating a cliff near 160k', () => {
    const justUnder = estimate({
      vehicleAge: 10,
      mileage: 159000,
    });
    const justOver = estimate({
      vehicleAge: 10,
      mileage: 160100,
    });

    expect(Math.abs(justOver.expectedRepairsMonthly - justUnder.expectedRepairsMonthly)).toBeLessThanOrEqual(5);
    expect(Math.abs(justOver.majorRepairReserveMonthly - justUnder.majorRepairReserveMonthly)).toBeLessThanOrEqual(5);
  });

  it('keeps routine smoothest and major reserve most sensitive to mileage', () => {
    const lowMileage = estimate({
      vehicleAge: 10,
      mileage: 80000,
    });
    const highMileage = estimate({
      vehicleAge: 10,
      mileage: 200000,
    });

    const routineDelta = highMileage.routineMonthly - lowMileage.routineMonthly;
    const repairsDelta = highMileage.expectedRepairsMonthly - lowMileage.expectedRepairsMonthly;
    const reserveDelta = highMileage.majorRepairReserveMonthly - lowMileage.majorRepairReserveMonthly;

    expect(routineDelta).toBeGreaterThan(0);
    expect(repairsDelta).toBeGreaterThanOrEqual(routineDelta);
    expect(reserveDelta).toBeGreaterThanOrEqual(repairsDelta);
  });

  it('treats low modification level the same as stock', () => {
    const stock = estimate({ modificationLevel: 'stock' });
    const low = estimate({ modificationLevel: 'low' });

    expect(low.routineMonthly).toBe(stock.routineMonthly);
    expect(low.expectedRepairsMonthly).toBe(stock.expectedRepairsMonthly);
    expect(low.majorRepairReserveMonthly).toBe(stock.majorRepairReserveMonthly);
    expect(modificationFactor(low, 'expectedRepairs')).toBe(1);
    expect(modificationFactor(low, 'majorRepairReserve')).toBe(1);
  });

  it('uses modest modification multipliers for medium and high builds', () => {
    const medium = estimate({ vehicleClass: 'fullsize_suv', mileage: 162000, modificationLevel: 'medium' });
    const high = estimate({ vehicleClass: 'fullsize_suv', mileage: 162000, modificationLevel: 'high' });

    expect(modificationFactor(medium, 'expectedRepairs')).toBe(1.05);
    expect(modificationFactor(medium, 'majorRepairReserve')).toBe(1.08);
    expect(modificationFactor(high, 'expectedRepairs')).toBe(1.12);
    expect(modificationFactor(high, 'majorRepairReserve')).toBe(1.18);
    expect(high.expectedRepairsMonthly).toBeGreaterThanOrEqual(medium.expectedRepairsMonthly);
    expect(high.majorRepairReserveMonthly).toBeGreaterThan(medium.majorRepairReserveMonthly);
  });

  it('returns explainable factor labels including conservative stack dampening', () => {
    const highRisk = estimate({
      vehicleAge: 30,
      mileage: 250000,
      condition: 'poor',
      titleStatus: 'salvage',
      modificationLevel: 'high',
    });
    const labels = highRisk.factors.expectedRepairs.map((factor) => factor.label);

    expect(labels.some((label) => label.startsWith('Mileage:'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Age:'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Condition:'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Title:'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Modification:'))).toBe(true);
    expect(labels.some((label) => label.includes('Conservative stack dampening/cap'))).toBe(true);
  });
});
