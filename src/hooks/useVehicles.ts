import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { VehicleRow } from '../types';

export function useVehicles(): VehicleRow[] {
  return useLiveQuery(() => db.vehicles.toArray(), []) ?? [];
}

export function useVehicleById(id: string | null): VehicleRow | undefined {
  return useLiveQuery(
    () => (id ? db.vehicles.get(id) : undefined),
    [id],
  );
}
