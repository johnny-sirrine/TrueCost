import type { GlobalAssumptions } from '../types';

export function createDefaultAssumptions(): GlobalAssumptions {
  return {
    id: 'default',
    annualMiles: 11000,
    gasPrice: 4.00,
    salesTaxRate: 0.0725, // Utah state + typical local
    ownershipYears: 5,
    usagePattern: 'mixed',
    defaultCondition: 'average',
    optimismLevel: 'neutral',
    insuranceCoverageDefault: 'liability_only',
    driverAgeRange: '25_39',
    drivingRecord: 'clean',
    annualRegistrationFees: 200,
    monthlyParkingAndTolls: 0,
    includeMajorRepairReserveInFirstYear: false,
    includeMajorRepairReserveInTotalCost: true,
  };
}
