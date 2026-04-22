import type { VehicleRow, DealQuality } from '../types';

const CURRENT_YEAR = new Date().getFullYear();

export interface DealResult {
  dealQuality: DealQuality;
  dealExplanation: string[];
}

export function computeDealQuality(
  vehicle: VehicleRow,
  currentMarketValue: number,
): DealResult {
  // Current car: deal quality is not applicable
  if (vehicle.user.isCurrentCar) {
    return { dealQuality: 'Fair', dealExplanation: ['Current car — deal quality not applicable'] };
  }

  const { listingPrice, titleStatus, mileage } = vehicle.user;
  const { year, make, model } = vehicle.canonical;
  const explanations: string[] = [];
  let score = 50; // start at neutral

  // Factor 1: Price vs estimated market value (dominant factor)
  const priceDiff = listingPrice - currentMarketValue;
  const priceDiffPct = currentMarketValue > 0 ? priceDiff / currentMarketValue : 0;

  if (priceDiffPct < -0.15) {
    score += 25;
    explanations.push(`Priced ${Math.abs(Math.round(priceDiffPct * 100))}% below estimated market value ($${currentMarketValue.toLocaleString()})`);
  } else if (priceDiffPct < -0.05) {
    score += 15;
    explanations.push(`Priced ${Math.abs(Math.round(priceDiffPct * 100))}% below estimated market value`);
  } else if (priceDiffPct < 0.05) {
    score += 5;
    explanations.push('Priced near estimated market value');
  } else if (priceDiffPct < 0.15) {
    score -= 10;
    explanations.push(`Priced ${Math.round(priceDiffPct * 100)}% above estimated market value`);
  } else {
    score -= 20;
    explanations.push(`Priced ${Math.round(priceDiffPct * 100)}% above estimated market value`);
  }

  // Factor 2: Mileage relative to age
  const age = CURRENT_YEAR - year;
  const expectedMiles = age * 12000;
  const mileageDiffPct = expectedMiles > 0 ? (mileage - expectedMiles) / expectedMiles : 0;

  if (mileageDiffPct < -0.2) {
    score += 10;
    explanations.push('Low mileage for age');
  } else if (mileageDiffPct > 0.3) {
    score -= 10;
    explanations.push('High mileage for age');
  } else {
    explanations.push('Average mileage for age');
  }

  // Factor 3: Title status
  if (titleStatus === 'rebuilt') {
    score -= 10;
    explanations.push('Rebuilt title reduces resale and financing options');
  } else if (titleStatus === 'salvage') {
    score -= 20;
    explanations.push('Salvage title significantly limits value and options');
  } else if (titleStatus === 'clean') {
    score += 5;
    explanations.push('Clean title');
  }

  // Factor 4: Known value retention
  const durables = ['4runner', 'tacoma', 'wrangler', 'frontier', 'tundra'];
  if (durables.includes(model.toLowerCase())) {
    score += 5;
    explanations.push(`${make} ${model} is known for strong value retention`);
  }

  // Clamp and map to rating
  score = Math.max(0, Math.min(100, score));
  let dealQuality = scoreToDealQuality(score);

  // Override: suspiciously good deal (too good to be true)
  if (listingPrice < currentMarketValue * 0.55) {
    dealQuality = 'Suspicious';
    explanations.push('Price seems too good to be true — verify condition, history, and title carefully');
  }

  return { dealQuality, dealExplanation: explanations };
}

function scoreToDealQuality(score: number): DealQuality {
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Fair+';
  if (score >= 45) return 'Fair';
  if (score >= 30) return 'Weak';
  return 'Terrible';
}
