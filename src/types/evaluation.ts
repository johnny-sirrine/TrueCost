import type { DimensionScore } from './dimensions';
import type { Confidence } from './vehicle';

export type DealQuality = 'Strong' | 'Fair+' | 'Fair' | 'Weak' | 'Terrible' | 'Suspicious';

export interface MpgFactors {
  base: number;
  age: number;
  condition: number;
  usage: number;
}

export interface CostEstimateFactor {
  label: string;
  multiplier: number;
}

export interface CostEstimateFactors {
  routine: CostEstimateFactor[];
  expectedRepairs: CostEstimateFactor[];
  majorRepairReserve: CostEstimateFactor[];
}

export interface ComputedEvaluation {
  // MPG
  realisticMpg: number;
  mpgFactors: MpgFactors;

  // Monthly costs
  fuelMonthly: number;
  routineMonthly: number;
  expectedRepairsMonthly: number;
  registrationMonthly: number;
  parkingAndTollsMonthly: number;
  majorRepairReserveMonthly: number;
  insuranceMonthly: number;
  baselineMonthly: number;  // fuel + routine + expectedRepairs
  allInMonthly: number;     // baseline + insurance + reserve
  costFactors?: CostEstimateFactors;

  // Aggregated
  firstYearCost: number;
  totalCostAtHorizon: number;

  // Resale - anchored to current market value, projected forward
  currentMarketValueEstimate: number;
  futureResaleValueEstimate: number;
  resaleLoss: number; // effectivePurchaseCost (incl. tax) - futureResaleValue; negative = gain

  // Deal
  dealQuality: DealQuality;
  dealExplanation: string[];

  // Comparison dimensions
  dimensions: Record<string, DimensionScore>;

  // Overall confidence
  confidence: Confidence;
}
