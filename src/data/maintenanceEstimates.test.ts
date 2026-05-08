import { describe, expect, it } from 'vitest';
import type { ConditionLevel, TitleStatus, VehicleClass } from '../types/vehicle';
import { estimateMaintenanceCostDetails } from './maintenanceEstimates';

function estimate(overrides: Partial<{
  vehicleClass: VehicleClass;
  mileage: number;
  vehicleAge: number;
  condition: ConditionLevel;
  titleStatus: TitleStatus;
  ownershipYears: number;
  make: string;
  model: string;
}> = {}) {
  return estimateMaintenanceCostDetails({
    vehicleClass: overrides.vehicleClass ?? 'midsize_crossover',
    mileage: overrides.mileage ?? 100000,
    vehicleAge: overrides.vehicleAge ?? 10,
    condition: overrides.condition ?? 'average',
    titleStatus: overrides.titleStatus ?? 'clean',
    ownershipYears: overrides.ownershipYears ?? 5,
    make: overrides.make,
    model: overrides.model,
  });
}

describe('maintenance and repair estimates', () => {
  it('makes high-mileage Grand Cherokee repair exposure higher without exploding', () => {
    const lowerMileage = estimate({
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleAge: 11,
      mileage: 93000,
    });
    const highMileage = estimate({
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleAge: 10,
      mileage: 162000,
    });

    expect(highMileage.expectedRepairsMonthly).toBeGreaterThan(lowerMileage.expectedRepairsMonthly);
    expect(highMileage.majorRepairReserveMonthly).toBeGreaterThan(lowerMileage.majorRepairReserveMonthly);
    expect(highMileage.expectedRepairsMonthly / lowerMileage.expectedRepairsMonthly).toBeLessThanOrEqual(1.35);
    expect(highMileage.majorRepairReserveMonthly / lowerMileage.majorRepairReserveMonthly).toBeLessThanOrEqual(1.35);
  });

  it('smooths the 160k mileage threshold instead of creating a cliff', () => {
    const justUnder = estimate({
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleAge: 10,
      mileage: 159000,
    });
    const justOver = estimate({
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleAge: 10,
      mileage: 160100,
    });

    expect(Math.abs(justOver.expectedRepairsMonthly - justUnder.expectedRepairsMonthly)).toBeLessThanOrEqual(5);
    expect(Math.abs(justOver.majorRepairReserveMonthly - justUnder.majorRepairReserveMonthly)).toBeLessThanOrEqual(5);
  });

  it('keeps unknown make and model neutral rather than pessimistic', () => {
    const neutral = estimate({ make: '', model: '' });
    const unknown = estimate({ make: 'Mystery', model: 'Unknown' });

    expect(unknown.routineMonthly).toBe(neutral.routineMonthly);
    expect(unknown.expectedRepairsMonthly).toBe(neutral.expectedRepairsMonthly);
    expect(unknown.majorRepairReserveMonthly).toBe(neutral.majorRepairReserveMonthly);
  });

  it('keeps similar Subaru Outback mileages close together', () => {
    const outback135k = estimate({
      make: 'Subaru',
      model: 'Outback',
      vehicleAge: 8,
      mileage: 135000,
    });
    const outback142k = estimate({
      make: 'Subaru',
      model: 'Outback',
      vehicleAge: 8,
      mileage: 142000,
    });

    expect(outback142k.expectedRepairsMonthly).toBeGreaterThanOrEqual(outback135k.expectedRepairsMonthly);
    expect(outback142k.majorRepairReserveMonthly).toBeGreaterThanOrEqual(outback135k.majorRepairReserveMonthly);
    expect(outback142k.expectedRepairsMonthly - outback135k.expectedRepairsMonthly).toBeLessThanOrEqual(5);
    expect(outback142k.majorRepairReserveMonthly - outback135k.majorRepairReserveMonthly).toBeLessThanOrEqual(5);
  });

  it('returns explainable factor labels including conservative stack dampening', () => {
    const highRisk = estimate({
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleAge: 16,
      mileage: 180000,
      condition: 'poor',
      titleStatus: 'rebuilt',
    });
    const labels = highRisk.factors.expectedRepairs.map((factor) => factor.label);

    expect(labels.some((label) => label.startsWith('Mileage:'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Age:'))).toBe(true);
    expect(labels.some((label) => label.includes('Jeep'))).toBe(true);
    expect(labels.some((label) => label.includes('Conservative stack dampening/cap'))).toBe(true);
  });
});
