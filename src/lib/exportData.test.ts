import { describe, expect, it } from 'vitest';
import type { ComputedVehicle } from '../hooks/useComputedBoard';
import { vehiclesToCsv } from './exportData';

describe('vehiclesToCsv', () => {
  it('includes location as an exported column', () => {
    const computed = [{
      vehicle: {
        id: 'vehicle-1',
        createdAt: '2026-05-08T00:00:00.000Z',
        updatedAt: '2026-05-08T00:00:00.000Z',
        listing: {
          source: 'facebook',
          sourceUrl: 'https://facebook.com/marketplace/item/123',
          location: 'Provo, UT',
        },
        canonical: {
          year: 2018,
          make: 'Subaru',
          model: 'Outback',
          trim: 'Premium',
          drivetrain: 'awd',
          transmissionType: 'automatic',
          engineType: 'gas',
          epaCombinedMpg: 25,
        },
        user: {
          listingPrice: 9251,
          mileage: 130777,
          titleStatus: 'clean',
          conditionLevel: 'average',
          catchUpCost: 0,
          notes: '',
          tags: [],
          pinned: false,
          archived: false,
          isCurrentCar: false,
          overrides: {},
        },
        fieldMeta: {},
      },
      computed: {
        realisticMpg: 24.7,
        fuelMonthly: 100,
        routineMonthly: 50,
        expectedRepairsMonthly: 25,
        insuranceMonthly: 125,
        baselineMonthly: 300,
        allInMonthly: 440,
        firstYearCost: 12483,
        totalCostAtHorizon: 27243,
        currentMarketValueEstimate: 9000,
        futureResaleValueEstimate: 4500,
        resaleLoss: 4500,
        dealQuality: 'Fair+',
        confidence: 'high',
      },
    }] as unknown as ComputedVehicle[];

    const csv = vehiclesToCsv(computed);
    expect(csv.split('\n')[0]).toContain('Location');
    expect(csv).toContain('"Provo, UT"');
  });
});
