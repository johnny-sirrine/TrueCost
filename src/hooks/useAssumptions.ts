import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { createDefaultAssumptions } from '../data/defaultAssumptions';
import type { GlobalAssumptions } from '../types';

export function useAssumptions(): GlobalAssumptions {
  const stored = useLiveQuery(() => db.assumptions.get('default'), []);
  return stored ?? createDefaultAssumptions();
}
