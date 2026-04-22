import type { CanonicalVehicle, VehicleUserData, Confidence } from './vehicle';

export interface DimensionFactor {
  name: string;
  impact: number; // contribution to score, can be negative
  note?: string;
}

export interface DimensionScore {
  value: number; // 0-10
  confidence: Confidence;
  label: string; // e.g. "Strong", "Moderate", "Limited"
  factors: DimensionFactor[];
}

export interface ComparisonDimension {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  score: (canonical: CanonicalVehicle, user: VehicleUserData) => DimensionScore;
}
