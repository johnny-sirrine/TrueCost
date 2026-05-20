import { describe, it, expect } from 'vitest';
import { estimateCurrentMarketValue, mileageMultiplier, titleMultiplier, conditionMultiplier } from '../data/vehicleReference';
import { getDepreciationProfile } from '../data/depreciationProfiles';
import { computeResale } from './resale';
import type { VehicleRow, GlobalAssumptions } from '../types';

// --- Multiplier chain unit tests ---

describe('mileageMultiplier', () => {
  it('returns ~1.0 for average mileage', () => {
    const m = mileageMultiplier(120000, 10);
    expect(m).toBeCloseTo(1.0, 1);
  });

  it('penalizes high mileage (full sensitivity)', () => {
    const m = mileageMultiplier(100000, 5);
    expect(m).toBeLessThan(1.0);
    expect(m).toBeGreaterThanOrEqual(0.75);
  });

  it('rewards low mileage with HALF sensitivity', () => {
    const m = mileageMultiplier(80000, 10);
    expect(m).toBeGreaterThan(1.0);
    expect(m).toBeLessThanOrEqual(1.04);
  });

  it('caps expected miles at 180k for old vehicles', () => {
    const m = mileageMultiplier(163000, 20);
    expect(m).toBeCloseTo(1.013, 2);
  });

  it('never exceeds 1.08', () => {
    expect(mileageMultiplier(10000, 20)).toBeLessThanOrEqual(1.08);
  });

  it('never goes below 0.75', () => {
    expect(mileageMultiplier(300000, 5)).toBeGreaterThanOrEqual(0.75);
  });
});

describe('titleMultiplier', () => {
  it('clean = 1.0', () => expect(titleMultiplier('clean')).toBe(1.0));
  it('rebuilt = 0.72', () => expect(titleMultiplier('rebuilt')).toBe(0.72));
  it('salvage = 0.55', () => expect(titleMultiplier('salvage')).toBe(0.55));
});

describe('conditionMultiplier', () => {
  it('excellent > average > poor', () => {
    expect(conditionMultiplier('excellent')).toBeGreaterThan(conditionMultiplier('average'));
    expect(conditionMultiplier('average')).toBeGreaterThan(conditionMultiplier('poor'));
  });
});

// --- Market value estimation ---

describe('estimateCurrentMarketValue', () => {
  it('2006 4Runner clean 163k: bounded', () => {
    const v = estimateCurrentMarketValue('Toyota', '4Runner', 2006, 162900, 'clean');
    expect(v).toBeGreaterThanOrEqual(8000);
    expect(v).toBeLessThanOrEqual(18000);
  });

  it('2018 Sorento clean 127k: bounded', () => {
    const v = estimateCurrentMarketValue('Kia', 'Sorento', 2018, 127000, 'clean');
    expect(v).toBeGreaterThanOrEqual(8000);
    expect(v).toBeLessThanOrEqual(18000);
  });

  it('rebuilt title discounts ~25-30% vs clean', () => {
    const clean = estimateCurrentMarketValue('Honda', 'Pilot', 2016, 138000, 'clean');
    const rebuilt = estimateCurrentMarketValue('Honda', 'Pilot', 2016, 138000, 'rebuilt');
    const ratio = rebuilt / clean;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.80);
  });

  it('unknown vehicle falls back to generic base', () => {
    const v = estimateCurrentMarketValue('Saab', '9-3', 2008, 120000, 'clean');
    expect(v).toBeGreaterThanOrEqual(2000);
    expect(v).toBeLessThanOrEqual(15000);
  });

  it('never returns below $2,000', () => {
    const v = estimateCurrentMarketValue('Ford', 'Pinto', 1975, 400000, 'salvage', 'poor');
    expect(v).toBeGreaterThanOrEqual(2000);
  });

  it('condition affects value', () => {
    const excellent = estimateCurrentMarketValue('Toyota', '4Runner', 2010, 130000, 'clean', 'excellent');
    const poor = estimateCurrentMarketValue('Toyota', '4Runner', 2010, 130000, 'clean', 'poor');
    expect(excellent).toBeGreaterThan(poor);
  });
});

// --- Forward projection ---

describe('depreciation profiles', () => {
  it('durable retains more than normal over 3yr', () => {
    const durable = getDepreciationProfile('value_flattened_durable');
    const normal = getDepreciationProfile('normal_midlife');
    const params = { yearsForward: 3, milesAdded: 33000, currentAge: 10, currentMiles: 120000 };
    expect(durable.projectForward(params)).toBeGreaterThan(normal.projectForward(params));
  });

  it('branded profile is flatter than normal (available as manual override)', () => {
    const branded = getDepreciationProfile('branded_title_discounted');
    const normal = getDepreciationProfile('normal_midlife');
    const params = { yearsForward: 3, milesAdded: 33000, currentAge: 8, currentMiles: 100000 };
    expect(branded.projectForward(params)).toBeGreaterThan(normal.projectForward(params));
  });

  it('steep is steeper than normal', () => {
    const steep = getDepreciationProfile('still_depreciating');
    const normal = getDepreciationProfile('normal_midlife');
    const params = { yearsForward: 3, milesAdded: 36000, currentAge: 3, currentMiles: 30000 };
    expect(steep.projectForward(params)).toBeLessThan(normal.projectForward(params));
  });

  it('higher miles produce worse resale', () => {
    const profile = getDepreciationProfile('value_flattened_durable');
    const low = profile.projectForward({ yearsForward: 5, milesAdded: 40000, currentAge: 15, currentMiles: 130000 });
    const high = profile.projectForward({ yearsForward: 5, milesAdded: 75000, currentAge: 15, currentMiles: 130000 });
    expect(high).toBeLessThan(low);
  });

  it('durable floor is 0.45', () => {
    const profile = getDepreciationProfile('value_flattened_durable');
    const retained = profile.projectForward({ yearsForward: 30, milesAdded: 300000, currentAge: 10, currentMiles: 200000 });
    expect(retained).toBeGreaterThanOrEqual(0.45);
  });

  it('durable upside cap is 1.05', () => {
    const profile = getDepreciationProfile('value_flattened_durable');
    const retained = profile.projectForward({ yearsForward: 1, milesAdded: 5000, currentAge: 20, currentMiles: 80000 });
    expect(retained).toBeLessThanOrEqual(1.05);
  });

  it('uses actual currentMiles for 200k threshold', () => {
    const profile = getDepreciationProfile('value_flattened_durable');
    const over = profile.projectForward({ yearsForward: 3, milesAdded: 33000, currentAge: 10, currentMiles: 190000 });
    const under = profile.projectForward({ yearsForward: 3, milesAdded: 33000, currentAge: 10, currentMiles: 150000 });
    expect(over).toBeLessThan(under);
  });
});

// --- Resale gain/loss with sales tax ---

describe('resale gain/loss with sales tax', () => {
  const makeVehicle = (overrides: Partial<{ listingPrice: number; feesCost: number; mileage: number; titleStatus: 'clean' | 'rebuilt'; depreciationProfileId: string; isCurrentCar: boolean }>): VehicleRow => ({
    id: 'test',
    createdAt: '',
    updatedAt: '',
    listing: { source: 'manual', rawTitle: '' },
    canonical: { year: 2006, make: 'Toyota', model: '4Runner', engineType: 'gas' },
    user: {
      listingPrice: overrides.listingPrice ?? 8500,
      mileage: overrides.mileage ?? 162900,
      titleStatus: overrides.titleStatus ?? 'clean',
      conditionLevel: 'average',
      modificationLevel: 'stock',
      catchUpCost: 0,
      feesCost: overrides.feesCost ?? 0,
      notes: '',
      tags: [],
      pinned: false,
      archived: false,
      isCurrentCar: overrides.isCurrentCar ?? false,
      depreciationProfileId: (overrides.depreciationProfileId ?? 'value_flattened_durable') as any,
      overrides: {},
    },
    fieldMeta: {},
  }) as VehicleRow;

  const assumptions: GlobalAssumptions = {
    id: 'test',
    annualMiles: 11000,
    gasPrice: 4.0,
    salesTaxRate: 0.0725,
    ownershipYears: 3,
    usagePattern: 'mixed',
    optimismLevel: 'neutral',
    defaultCondition: 'average',
    insuranceCoverageDefault: 'liability_only',
    driverAgeRange: '25_39',
    drivingRecord: 'clean',
    annualRegistrationFees: 200,
    monthlyParkingAndTolls: 0,
    includeMajorRepairReserveInFirstYear: true,
    includeMajorRepairReserveInTotalCost: true,
  };

  it('good deal can show negative resale loss (gain)', () => {
    // 4Runner bought at $8,500 with market value ~$12,800
    const result = computeResale(makeVehicle({ listingPrice: 8500 }), assumptions);
    // Future resale should exceed purchase + tax for a durable vehicle bought below market
    expect(result.futureResaleValueEstimate).toBeGreaterThan(8500);
    // resaleLoss can be negative (= projected gain)
    expect(result.resaleLoss).toBeLessThan(result.futureResaleValueEstimate);
  });

  it('sales tax increases effective cost', () => {
    const noTax = computeResale(makeVehicle({}), { ...assumptions, salesTaxRate: 0 });
    const withTax = computeResale(makeVehicle({}), { ...assumptions, salesTaxRate: 0.10 });
    // Same future resale, but higher effective cost with tax → worse resale loss
    expect(withTax.resaleLoss).toBeGreaterThan(noTax.resaleLoss);
    expect(noTax.futureResaleValueEstimate).toBe(withTax.futureResaleValueEstimate);
  });

  it('fees increase candidate resale loss', () => {
    const noFees = computeResale(makeVehicle({ feesCost: 0 }), assumptions);
    const withFees = computeResale(makeVehicle({ feesCost: 650 }), assumptions);

    expect(withFees.resaleLoss - noFees.resaleLoss).toBe(650);
  });

  it('overpaying shows actual loss', () => {
    // Pay $15,000 for a vehicle worth ~$12,800
    const result = computeResale(makeVehicle({ listingPrice: 15000 }), assumptions);
    expect(result.resaleLoss).toBeGreaterThan(0);
  });

  it('current car resale loss = depreciation (currentValue - futureValue)', () => {
    const result = computeResale(makeVehicle({ isCurrentCar: true }), assumptions);
    // Current car: loss = currentMarket - futureResale (no purchase cost involved)
    expect(result.resaleLoss).toBe(result.currentMarketValueEstimate - result.futureResaleValueEstimate);
    expect(result.resaleLoss).toBeGreaterThanOrEqual(0);
  });
});

// --- Seed vehicle sanity checks ---

describe('seed vehicle market values', () => {
  const seeds = [
    { make: 'Subaru', model: 'Forester', year: 2015, miles: 107000, title: 'rebuilt' as const },
    { make: 'Mazda', model: 'CX-9', year: 2017, miles: 101000, title: 'rebuilt' as const },
    { make: 'Toyota', model: '4Runner', year: 2006, miles: 162900, title: 'clean' as const },
    { make: 'Honda', model: 'Pilot', year: 2016, miles: 138000, title: 'clean' as const },
    { make: 'Honda', model: 'Pilot', year: 2014, miles: 131000, title: 'clean' as const },
    { make: 'Kia', model: 'Sorento', year: 2018, miles: 127000, title: 'clean' as const },
    { make: 'Nissan', model: 'Frontier', year: 2012, miles: 132438, title: 'clean' as const },
  ];

  for (const s of seeds) {
    it(`${s.year} ${s.make} ${s.model}: bounded and rounded`, () => {
      const v = estimateCurrentMarketValue(s.make, s.model, s.year, s.miles, s.title);
      expect(v).toBeGreaterThanOrEqual(2000);
      expect(v).toBeLessThanOrEqual(25000);
      expect(v % 100).toBe(0);
    });
  }
});
