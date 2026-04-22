import type { VehicleRow } from '../types';
import type { GlobalAssumptions } from '../types';
import type { MpgFactors } from '../types';
import { getBaseFactor, getAgeFactor, getConditionFactor, getUsageFactor } from '../data/mpgFactors';
import { lookupEpaReference } from '../data/vehicleReference';

const CURRENT_YEAR = new Date().getFullYear();

export interface MpgResult {
  realisticMpg: number;
  factors: MpgFactors;
  epaCombined: number;
}

export function computeMpg(vehicle: VehicleRow, assumptions: GlobalAssumptions): MpgResult {
  // If user has overridden MPG, use that directly
  if (vehicle.user.overrides.realisticMpg != null) {
    return {
      realisticMpg: vehicle.user.overrides.realisticMpg,
      factors: { base: 1, age: 1, condition: 1, usage: 1 },
      epaCombined: vehicle.canonical.epaCombinedMpg ?? 0,
    };
  }

  // Resolve EPA combined MPG: from canonical, or look up from reference
  let epaCombined = vehicle.canonical.epaCombinedMpg;
  if (!epaCombined) {
    const ref = lookupEpaReference(vehicle.canonical.make, vehicle.canonical.model);
    epaCombined = ref?.combinedMpg ?? 22; // fallback
  }

  // Compute factors
  const vehicleAge = CURRENT_YEAR - vehicle.canonical.year;
  const baseFactor = getBaseFactor(vehicle.canonical.vehicleClass, vehicle.canonical.drivetrain);
  const ageFactor = getAgeFactor(vehicleAge);
  const conditionFactor = getConditionFactor(vehicle.user.conditionLevel);
  const usageFactor = getUsageFactor(assumptions.usagePattern);

  const factors: MpgFactors = {
    base: baseFactor,
    age: ageFactor,
    condition: conditionFactor,
    usage: usageFactor,
  };

  const realisticMpg = Math.round(
    epaCombined * baseFactor * ageFactor * conditionFactor * usageFactor * 10
  ) / 10;

  return { realisticMpg, factors, epaCombined };
}
