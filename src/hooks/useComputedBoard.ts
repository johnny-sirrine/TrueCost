import { useMemo } from 'react';
import { useVehicles } from './useVehicles';
import { useAssumptions } from './useAssumptions';
import { computeEvaluation } from '../engine';
import type { VehicleRow, ComputedEvaluation } from '../types';

export interface ComputedVehicle {
  vehicle: VehicleRow;
  computed: ComputedEvaluation;
}

export function useComputedBoard(): ComputedVehicle[] {
  const vehicles = useVehicles();
  const assumptions = useAssumptions();

  return useMemo(() => {
    return vehicles.map((vehicle) => ({
      vehicle,
      computed: computeEvaluation(vehicle, assumptions),
    }));
  }, [vehicles, assumptions]);
}
