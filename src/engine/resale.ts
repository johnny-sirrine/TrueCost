import type { VehicleRow, GlobalAssumptions, DepreciationProfileId } from '../types';
import { estimateCurrentMarketValue, inferDepreciationProfile } from '../data/vehicleReference';
import { getDepreciationProfile } from '../data/depreciationProfiles';

const CURRENT_YEAR = new Date().getFullYear();

// Private-party resale never captures full market value.
// Negotiation, time, hassle, and buyer skepticism create friction.
const REALIZATION_DISCOUNT = 0.92;

export interface ResaleResult {
  currentMarketValueEstimate: number;
  futureResaleValueEstimate: number;
  resaleLoss: number;
  profileUsed: DepreciationProfileId;
}

export function computeResale(
  vehicle: VehicleRow,
  assumptions: GlobalAssumptions,
): ResaleResult {
  const { make, model, year } = vehicle.canonical;
  const { mileage, titleStatus, listingPrice, conditionLevel } = vehicle.user;
  const annualMiles = vehicle.user.overrides.annualMiles ?? assumptions.annualMiles;

  // Step 1: Estimate current market value (user override or multiplier-chain heuristic)
  const currentMarketValueEstimate = vehicle.user.overrides.currentMarketValue
    ?? estimateCurrentMarketValue(make, model, year, mileage, titleStatus, conditionLevel);

  // Step 2: Determine depreciation profile
  const profileId = vehicle.user.depreciationProfileId
    ?? inferDepreciationProfile(make, model, year, titleStatus);
  const profile = getDepreciationProfile(profileId);

  // Step 3: Project forward from current value
  const currentAge = CURRENT_YEAR - year;
  const milesAdded = annualMiles * assumptions.ownershipYears;
  const retainedFraction = profile.projectForward({
    yearsForward: assumptions.ownershipYears,
    milesAdded,
    currentAge,
    currentMiles: mileage,
  });

  // retainedFraction is already clamped to [floor, upsideCap] by the profile.
  // Apply realization discount: you won't capture full market value when selling.
  const futureResaleValueEstimate = Math.round(currentMarketValueEstimate * retainedFraction * REALIZATION_DISCOUNT / 100) * 100;

  // Resale gain/loss depends on whether this is the current car.
  // Current car: depreciation = current value - future value (value lost by keeping it)
  // Candidate: purchase cost (incl. tax) - future value
  let resaleLoss: number;
  if (vehicle.user.isCurrentCar) {
    resaleLoss = currentMarketValueEstimate - futureResaleValueEstimate;
  } else {
    const effectivePurchaseCost = listingPrice * (1 + assumptions.salesTaxRate);
    resaleLoss = effectivePurchaseCost - futureResaleValueEstimate;
  }

  return {
    currentMarketValueEstimate,
    futureResaleValueEstimate,
    resaleLoss,
    profileUsed: profileId,
  };
}
