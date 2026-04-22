import type { DepreciationProfileId } from '../types';

// Parameter-based depreciation profiles.
// Forward projection: retainedFraction = annualFactor^years * mileagePenalty
// Then clamped to [floorFraction, upsideCapFraction].

export interface DepreciationProfileParams {
  id: DepreciationProfileId;
  label: string;
  description: string;
  annualFactor: number;         // fraction retained per year (e.g., 0.96 = 4%/yr loss)
  floorFraction: number;        // minimum retained fraction of current value
  upsideCapFraction: number;    // maximum retained fraction (caps unrealistic appreciation)
  mileageSensitivityPerK: number; // % value loss per 1000 miles added during ownership
}

export interface DepreciationProfile extends DepreciationProfileParams {
  projectForward: (params: {
    yearsForward: number;
    milesAdded: number;
    currentAge: number;
    currentMiles: number;
  }) => number;
}

// Shared projection logic using profile parameters
function createProfile(params: DepreciationProfileParams): DepreciationProfile {
  return {
    ...params,
    projectForward: ({ yearsForward, milesAdded, currentMiles }) => {
      // Time depreciation: annualFactor^years
      const timeFactor = Math.pow(params.annualFactor, yearsForward);

      // Mileage depreciation: every mile added reduces value.
      // The annualFactor handles time-based aging; this handles physical wear.
      const milesAddedK = milesAdded / 1000;
      const mileageFactor = Math.max(0.60, 1.0 - milesAddedK * params.mileageSensitivityPerK);

      // High-mileage threshold: extra penalty if total future miles > 200k
      const futureTotalMiles = currentMiles + milesAdded;
      const highMileagePenalty = futureTotalMiles > 200000 ? 0.95 : 1.0;

      const raw = timeFactor * mileageFactor * highMileagePenalty;

      // Clamp to [floor, upsideCap]
      return Math.max(params.floorFraction, Math.min(params.upsideCapFraction, raw));
    },
  };
}

// Value-flattened durable: 4Runner, Tacoma, Wrangler, trucks that hold value.
// ~3-4% loss per year, high floor, modest upside cap.
const valueFlattenedDurable = createProfile({
  id: 'value_flattened_durable',
  label: 'Value-Flattened Durable',
  description: 'Trucks and SUVs known for holding value. Slow forward depreciation with a high floor.',
  annualFactor: 0.97,
  floorFraction: 0.45,
  upsideCapFraction: 1.05,
  mileageSensitivityPerK: 0.001,
});

// Normal midlife: typical crossovers/sedans past the steep phase.
// ~5% loss per year.
const normalMidlife = createProfile({
  id: 'normal_midlife',
  label: 'Normal Midlife',
  description: 'Typical depreciation for vehicles in the 5-15 year range.',
  annualFactor: 0.95,
  floorFraction: 0.25,
  upsideCapFraction: 1.0,
  mileageSensitivityPerK: 0.0015,
});

// Still depreciating: newer vehicles on the steep part of the curve.
// ~9% loss per year.
const stillDepreciating = createProfile({
  id: 'still_depreciating',
  label: 'Still Depreciating',
  description: 'Newer vehicles still on the steep part of the depreciation curve.',
  annualFactor: 0.91,
  floorFraction: 0.20,
  upsideCapFraction: 1.0,
  mileageSensitivityPerK: 0.002,
});

// Branded title: rebuilt/salvage. Already heavily discounted.
// Flatter forward curve since the big hit already happened.
const brandedTitleDiscounted = createProfile({
  id: 'branded_title_discounted',
  label: 'Branded Title Discounted',
  description: 'Rebuilt/salvage title vehicles. Already discounted, flatter forward curve.',
  annualFactor: 0.96,
  floorFraction: 0.20,
  upsideCapFraction: 1.0,
  mileageSensitivityPerK: 0.001,
});

export const DEPRECIATION_PROFILES: Record<DepreciationProfileId, DepreciationProfile> = {
  value_flattened_durable: valueFlattenedDurable,
  normal_midlife: normalMidlife,
  still_depreciating: stillDepreciating,
  branded_title_discounted: brandedTitleDiscounted,
};

export function getDepreciationProfile(id: DepreciationProfileId): DepreciationProfile {
  return DEPRECIATION_PROFILES[id];
}
