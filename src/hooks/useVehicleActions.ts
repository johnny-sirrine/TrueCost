import { useCallback } from 'react';
import { db } from '../db';
import { vehicleRowSchema } from '../db/schemas';
import type { VehicleRow } from '../types';

export function useVehicleActions() {
  const addVehicle = useCallback(async (vehicle: VehicleRow) => {
    const validated = vehicleRowSchema.parse(vehicle);
    if (validated.user.isCurrentCar) {
      // Enforce single-current-car constraint — unmark any existing current car atomically
      await db.transaction('rw', db.vehicles, async () => {
        const now = new Date().toISOString();
        const existingCurrent = await db.vehicles
          .filter((v) => v.user.isCurrentCar === true)
          .toArray();
        for (const other of existingCurrent) {
          await db.vehicles.update(other.id, {
            'user.isCurrentCar': false,
            updatedAt: now,
          });
        }
        await db.vehicles.add(validated);
      });
    } else {
      await db.vehicles.add(validated);
    }
  }, []);

  const updateVehicle = useCallback(async (id: string, changes: Partial<VehicleRow>) => {
    await db.vehicles.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const removeVehicle = useCallback(async (id: string) => {
    await db.vehicles.delete(id);
  }, []);

  const duplicateVehicle = useCallback(async (vehicle: VehicleRow) => {
    const now = new Date().toISOString();
    const duplicate: VehicleRow = {
      ...structuredClone(vehicle),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      // Duplicates are never the current car — avoid creating a duplicate current-car state
      user: {
        ...structuredClone(vehicle.user),
        isCurrentCar: false,
      },
    };
    const validated = vehicleRowSchema.parse(duplicate);
    await db.vehicles.add(validated);
    return duplicate.id;
  }, []);

  const togglePin = useCallback(async (id: string, currentPinned: boolean) => {
    await db.vehicles.update(id, {
      'user.pinned': !currentPinned,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const toggleArchive = useCallback(async (id: string, currentArchived: boolean) => {
    await db.vehicles.update(id, {
      'user.archived': !currentArchived,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  /**
   * Mark (or unmark) a vehicle as the user's current car.
   * Enforces the single-current-car constraint: when marking, any other vehicle
   * currently marked as the current car is atomically unmarked first.
   * When marking, the listing price is reset to 0 (current cars have no purchase cost).
   */
  const setCurrentCar = useCallback(async (id: string, isCurrentCar: boolean) => {
    await db.transaction('rw', db.vehicles, async () => {
      const now = new Date().toISOString();
      if (isCurrentCar) {
        const otherCurrent = await db.vehicles
          .filter((v) => v.id !== id && v.user.isCurrentCar === true)
          .toArray();
        for (const other of otherCurrent) {
          await db.vehicles.update(other.id, {
            'user.isCurrentCar': false,
            updatedAt: now,
          });
        }
      }
      const updates: Record<string, unknown> = {
        'user.isCurrentCar': isCurrentCar,
        updatedAt: now,
      };
      if (isCurrentCar) {
        updates['user.listingPrice'] = 0;
      }
      await db.vehicles.update(id, updates);
    });
  }, []);

  return { addVehicle, updateVehicle, removeVehicle, duplicateVehicle, togglePin, toggleArchive, setCurrentCar };
}
