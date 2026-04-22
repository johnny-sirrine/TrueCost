export type UsagePattern = 'mostly_highway' | 'mixed' | 'city_heavy' | 'aggressive_short_trips';

export type OptimismLevel = 'optimistic' | 'neutral' | 'conservative';

export type InsuranceCoverageMode = 'liability_only' | 'full_coverage';

export type DriverAgeRange = 'under_25' | '25_39' | '40_65' | 'over_65';

export type DrivingRecord = 'clean' | 'minor' | 'major';

export interface GlobalAssumptions {
  id: string; // always 'default'
  annualMiles: number;
  gasPrice: number;
  salesTaxRate: number; // e.g. 0.07 = 7%. Applied to purchase price.
  ownershipYears: number;
  usagePattern: UsagePattern;
  defaultCondition: import('./vehicle').ConditionLevel;
  optimismLevel: OptimismLevel;
  insuranceCoverageDefault: InsuranceCoverageMode;
  driverAgeRange: DriverAgeRange;
  drivingRecord: DrivingRecord;
  annualRegistrationFees: number; // annual reg + emissions, divided by 12 into baseline
  monthlyParkingAndTolls: number; // driver-specific fixed cost, same for any vehicle
  includeMajorRepairReserveInFirstYear: boolean;
  includeMajorRepairReserveInTotalCost: boolean;
}
