import type { VehicleRow } from '../types';

export interface SimilarityResult {
  vehicleId: string;
  vehicleLabel: string;
  similarity: number; // 0-1
  reason: string;
}

// Simple heuristic: same make+model, similar year, similar class
export function findSimilarVehicles(
  newVehicle: VehicleRow,
  existing: VehicleRow[],
): SimilarityResult[] {
  const results: SimilarityResult[] = [];

  for (const v of existing) {
    if (v.id === newVehicle.id) continue;

    let similarity = 0;
    const reasons: string[] = [];

    // Same make+model is a strong signal
    if (
      v.canonical.make.toLowerCase() === newVehicle.canonical.make.toLowerCase() &&
      v.canonical.model.toLowerCase() === newVehicle.canonical.model.toLowerCase()
    ) {
      similarity += 0.5;
      reasons.push('Same make and model');

      // Same generation (within 3 years)
      if (Math.abs(v.canonical.year - newVehicle.canonical.year) <= 3) {
        similarity += 0.2;
        reasons.push('Same generation');
      }
    }

    // Same vehicle class
    if (v.canonical.vehicleClass && v.canonical.vehicleClass === newVehicle.canonical.vehicleClass) {
      similarity += 0.15;
      reasons.push('Same vehicle class');
    }

    // Same drivetrain
    if (v.canonical.drivetrain && v.canonical.drivetrain === newVehicle.canonical.drivetrain) {
      similarity += 0.1;
    }

    // Similar price range (within 25%)
    const priceDiff = Math.abs(v.user.listingPrice - newVehicle.user.listingPrice);
    const avgPrice = (v.user.listingPrice + newVehicle.user.listingPrice) / 2;
    if (avgPrice > 0 && priceDiff / avgPrice < 0.25) {
      similarity += 0.05;
      reasons.push('Similar price range');
    }

    if (similarity >= 0.4) {
      const label = `${v.canonical.year} ${v.canonical.make} ${v.canonical.model}`;
      results.push({
        vehicleId: v.id,
        vehicleLabel: label,
        similarity: Math.min(1, similarity),
        reason: reasons.join('; '),
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}
