import { useEffect, useRef } from 'react';
import { db } from '../db';
import { createSeedVehicles } from '../data/seedVehicles';
import { createDefaultAssumptions } from '../data/defaultAssumptions';

// Seeds the database on first load if empty
export function useSeedData() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function seed() {
      const vehicleCount = await db.vehicles.count();
      if (vehicleCount === 0) {
        const seeds = createSeedVehicles();
        await db.vehicles.bulkAdd(seeds);
      }

      const assumptions = await db.assumptions.get('default');
      if (!assumptions) {
        await db.assumptions.put(createDefaultAssumptions());
      }
    }

    seed();
  }, []);
}
