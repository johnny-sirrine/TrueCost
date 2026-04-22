import { useCallback } from 'react';
import { db } from '../db';
import { createDefaultAssumptions } from '../data/defaultAssumptions';
import { globalAssumptionsSchema } from '../db/schemas';
import type { GlobalAssumptions } from '../types';

export function useAssumptionActions() {
  const updateAssumption = useCallback(async <K extends keyof GlobalAssumptions>(
    key: K,
    value: GlobalAssumptions[K],
  ) => {
    const current = await db.assumptions.get('default') ?? createDefaultAssumptions();
    const updated = { ...current, [key]: value };
    const validated = globalAssumptionsSchema.parse(updated);
    await db.assumptions.put(validated);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const defaults = createDefaultAssumptions();
    await db.assumptions.put(defaults);
  }, []);

  return { updateAssumption, resetToDefaults };
}
