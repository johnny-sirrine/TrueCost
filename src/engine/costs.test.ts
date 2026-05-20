import { describe, expect, it } from 'vitest';
import { createDefaultAssumptions } from '../data/defaultAssumptions';
import type { VehicleRow } from '../types/vehicle';
import { computeCosts } from './costs';

function makeVehicle(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: 'test',
    createdAt: '',
    updatedAt: '',
    listing: { source: 'manual' },
    canonical: {
      year: 2016,
      make: 'Jeep',
      model: 'Grand Cherokee',
      vehicleClass: 'midsize_crossover',
      engineType: 'gas',
    },
    user: {
      listingPrice: 10000,
      mileage: 162000,
      titleStatus: 'clean',
      conditionLevel: 'average',
      modificationLevel: 'stock',
      catchUpCost: 0,
      feesCost: 0,
      notes: '',
      tags: [],
      pinned: false,
      archived: false,
      isCurrentCar: false,
      overrides: {},
    },
    fieldMeta: {},
    ...overrides,
  };
}

describe('computeCosts maintenance estimates', () => {
  it('feeds differentiated maintenance estimates into monthly totals', () => {
    const assumptions = createDefaultAssumptions();
    const lowerMileage = computeCosts(
      makeVehicle({ user: { ...makeVehicle().user, mileage: 93000 } }),
      assumptions,
      22,
      100,
    );
    const highMileage = computeCosts(makeVehicle(), assumptions, 22, 100);

    expect(highMileage.expectedRepairsMonthly).toBeGreaterThan(lowerMileage.expectedRepairsMonthly);
    expect(highMileage.majorRepairReserveMonthly).toBeGreaterThan(lowerMileage.majorRepairReserveMonthly);
    expect(highMileage.allInMonthly).toBeGreaterThan(lowerMileage.allInMonthly);
  });

  it('keeps user overrides as the persistence path for cost edits', () => {
    const assumptions = createDefaultAssumptions();
    const costs = computeCosts(
      makeVehicle({
        user: {
          ...makeVehicle().user,
          overrides: {
            routineMonthly: 12,
            expectedRepairsMonthly: 34,
            majorRepairReserveMonthly: 56,
          },
        },
      }),
      assumptions,
      22,
      100,
    );

    expect(costs.routineMonthly).toBe(12);
    expect(costs.expectedRepairsMonthly).toBe(34);
    expect(costs.majorRepairReserveMonthly).toBe(56);
    expect(costs.costFactors.routine).toEqual([{ label: 'User override', multiplier: 1 }]);
    expect(costs.costFactors.expectedRepairs).toEqual([{ label: 'User override', multiplier: 1 }]);
    expect(costs.costFactors.majorRepairReserve).toEqual([{ label: 'User override', multiplier: 1 }]);
  });

  it('includes one-time fees in candidate first-year cost', () => {
    const assumptions = createDefaultAssumptions();
    const withoutFees = computeCosts(makeVehicle(), assumptions, 22, 100);
    const withFees = computeCosts(
      makeVehicle({ user: { ...makeVehicle().user, feesCost: 650 } }),
      assumptions,
      22,
      100,
    );

    expect(withFees.firstYearCost - withoutFees.firstYearCost).toBe(650);
  });

  it('does not apply make or model reliability multipliers', () => {
    const assumptions = createDefaultAssumptions();
    const baseVehicle = makeVehicle({
      canonical: {
        ...makeVehicle().canonical,
        make: 'Honda',
        model: 'Pilot',
      },
    });
    const sameInputsDifferentBadge = makeVehicle({
      canonical: {
        ...makeVehicle().canonical,
        make: 'Jeep',
        model: 'Grand Cherokee',
      },
    });

    const hondaCosts = computeCosts(baseVehicle, assumptions, 22, 100);
    const jeepCosts = computeCosts(sameInputsDifferentBadge, assumptions, 22, 100);

    expect(jeepCosts.routineMonthly).toBe(hondaCosts.routineMonthly);
    expect(jeepCosts.expectedRepairsMonthly).toBe(hondaCosts.expectedRepairsMonthly);
    expect(jeepCosts.majorRepairReserveMonthly).toBe(hondaCosts.majorRepairReserveMonthly);
  });
});
