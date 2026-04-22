import type { ComparisonDimension, DimensionScore } from '../../types';
import type { CanonicalVehicle, VehicleUserData } from '../../types';
import { capabilityDimension } from './capability';

// Dimension registry: add new dimensions here
const DIMENSION_REGISTRY: ComparisonDimension[] = [
  capabilityDimension,
];

export function getAllDimensions(): ComparisonDimension[] {
  return DIMENSION_REGISTRY;
}

export function getDimension(id: string): ComparisonDimension | undefined {
  return DIMENSION_REGISTRY.find(d => d.id === id);
}

export function computeAllDimensions(
  canonical: CanonicalVehicle,
  user: VehicleUserData,
): Record<string, DimensionScore> {
  const results: Record<string, DimensionScore> = {};
  for (const dim of DIMENSION_REGISTRY) {
    results[dim.id] = dim.score(canonical, user);
  }
  return results;
}
