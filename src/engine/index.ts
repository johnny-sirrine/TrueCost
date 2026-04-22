import type { VehicleRow, GlobalAssumptions, ComputedEvaluation, Confidence } from '../types';
import { computeMpg } from './mpg';
import { computeCosts } from './costs';
import { computeResale } from './resale';
import { computeInsurance } from './insurance';
import { computeDealQuality } from './dealQuality';
import { computeAllDimensions } from './dimensions';

// Compute the full evaluation for a single vehicle.
// Pure function: (VehicleRow, GlobalAssumptions) => ComputedEvaluation
export function computeEvaluation(
  vehicle: VehicleRow,
  assumptions: GlobalAssumptions,
): ComputedEvaluation {
  // 1. MPG
  const mpgResult = computeMpg(vehicle, assumptions);

  // 2. Resale (needed for market value → insurance)
  const resale = computeResale(vehicle, assumptions);

  // 3. Insurance (uses current market value for comp+collision)
  const insurance = computeInsurance(vehicle, assumptions, resale.currentMarketValueEstimate);

  // 4. Costs (includes insurance)
  const costs = computeCosts(vehicle, assumptions, mpgResult.realisticMpg, insurance.insuranceMonthly);

  // 5. Total cost at horizon includes resale loss
  const totalCostAtHorizon = costs.totalCostAtHorizon + resale.resaleLoss;

  // 6. Deal quality
  const deal = computeDealQuality(vehicle, resale.currentMarketValueEstimate);

  // 7. Comparison dimensions
  const dimensions = computeAllDimensions(vehicle.canonical, vehicle.user);

  // 8. Overall confidence: lowest of key field confidences
  const confidence = assessOverallConfidence(vehicle);

  return {
    realisticMpg: mpgResult.realisticMpg,
    mpgFactors: mpgResult.factors,
    fuelMonthly: costs.fuelMonthly,
    routineMonthly: costs.routineMonthly,
    expectedRepairsMonthly: costs.expectedRepairsMonthly,
    registrationMonthly: costs.registrationMonthly,
    parkingAndTollsMonthly: costs.parkingAndTollsMonthly,
    majorRepairReserveMonthly: costs.majorRepairReserveMonthly,
    insuranceMonthly: insurance.insuranceMonthly,
    baselineMonthly: costs.baselineMonthly,
    allInMonthly: costs.allInMonthly,
    firstYearCost: costs.firstYearCost,
    totalCostAtHorizon,
    currentMarketValueEstimate: resale.currentMarketValueEstimate,
    futureResaleValueEstimate: resale.futureResaleValueEstimate,
    resaleLoss: resale.resaleLoss,
    dealQuality: deal.dealQuality,
    dealExplanation: deal.dealExplanation,
    dimensions,
    confidence,
  };
}

// Batch compute for all vehicles. Needed for relative features (deal quality ranking).
export function computeAllEvaluations(
  vehicles: VehicleRow[],
  assumptions: GlobalAssumptions,
): Map<string, ComputedEvaluation> {
  const results = new Map<string, ComputedEvaluation>();
  for (const v of vehicles) {
    results.set(v.id, computeEvaluation(v, assumptions));
  }
  return results;
}

function assessOverallConfidence(vehicle: VehicleRow): Confidence {
  const meta = vehicle.fieldMeta;
  const keyFields = ['year', 'make', 'model', 'listingPrice', 'mileage'];

  let hasLow = false;
  let hasMedium = false;

  for (const field of keyFields) {
    const fm = meta[field];
    if (fm) {
      if (fm.confidence === 'low') hasLow = true;
      if (fm.confidence === 'medium') hasMedium = true;
    }
  }

  // Missing key field metadata = assumed, treat as medium
  const missingMeta = keyFields.some(f => !meta[f]);
  if (missingMeta) hasMedium = true;

  if (hasLow) return 'low';
  if (hasMedium) return 'medium';
  return 'high';
}
