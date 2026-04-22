/**
 * One-time backfill: resolves existing vehicles against EPA data.
 *
 * Runs on app startup. Only updates vehicles that haven't been resolved
 * against EPA yet (no 'external_lookup' in their fieldMeta).
 * Skips fields the user has manually overridden.
 */

import { useEffect, useRef } from 'react';
import { db } from '../db';
import { resolveVehicle, buildFieldMetaFromLookup } from '../services/vehicleResolver';
import { preloadEpaData } from '../services/epaProvider';
import type { VehicleRow } from '../types';

function needsBackfill(vehicle: VehicleRow): boolean {
  // Already resolved via EPA — skip
  const meta = vehicle.fieldMeta;
  if (meta.epaCombinedMpg?.origin === 'external_lookup') return false;
  if (meta.cylinders?.origin === 'external_lookup') return false;
  return true;
}

async function backfillVehicle(vehicle: VehicleRow): Promise<void> {
  const { year, make, model } = vehicle.canonical;
  if (!make || !model) return;

  const result = await resolveVehicle(year, make, model, {
    drivetrain: vehicle.canonical.drivetrain,
    transmission: vehicle.canonical.transmissionType,
    cylinders: vehicle.canonical.cylinders,
  });

  if (!result.best) return;

  const data = result.best;
  const epaOptionLabel = result.candidates[0]?.config.option;
  const newMeta = buildFieldMetaFromLookup(data, result.isStaticFallback, epaOptionLabel);

  // Build canonical updates — only fill in missing or upgrade from static fallback
  const canonical: Record<string, unknown> = {};
  const fieldMeta: Record<string, unknown> = {};

  // EPA direct facts: only update if currently missing or was inferred/assumed
  if (data.combinedMpg && !vehicle.canonical.epaCombinedMpg) {
    canonical['canonical.epaCombinedMpg'] = data.combinedMpg;
  }
  if (data.cylinders && !vehicle.canonical.cylinders) {
    canonical['canonical.cylinders'] = data.cylinders;
  }
  if (data.engineType && vehicle.canonical.engineType === 'gas') {
    // Only update if it was the hardcoded default 'gas'
    canonical['canonical.engineType'] = data.engineType;
  }
  if (data.transmissionType && !vehicle.canonical.transmissionType) {
    canonical['canonical.transmissionType'] = data.transmissionType;
  }

  // Derived fields: update if missing
  if (data.vehicleClass && !vehicle.canonical.vehicleClass) {
    canonical['canonical.vehicleClass'] = data.vehicleClass;
  }
  if (data.bodyStyle && !vehicle.canonical.bodyStyle) {
    canonical['canonical.bodyStyle'] = data.bodyStyle;
  }

  // Even if canonical values existed (from static), upgrade the fieldMeta provenance
  for (const [key, meta] of Object.entries(newMeta)) {
    const existing = vehicle.fieldMeta[key];
    // Don't overwrite user overrides
    if (existing?.origin === 'overridden') continue;
    // Upgrade from assumed/inferred to external_lookup
    fieldMeta[`fieldMeta.${key}`] = meta;
  }

  // Also backfill canonical values that existed from static but now have better EPA data
  if (data.combinedMpg && vehicle.canonical.epaCombinedMpg && !result.isStaticFallback) {
    canonical['canonical.epaCombinedMpg'] = data.combinedMpg;
  }
  if (data.cylinders && vehicle.canonical.cylinders && !result.isStaticFallback) {
    canonical['canonical.cylinders'] = data.cylinders;
  }
  if (data.vehicleClass && vehicle.canonical.vehicleClass && !result.isStaticFallback) {
    canonical['canonical.vehicleClass'] = data.vehicleClass;
  }
  if (data.bodyStyle && vehicle.canonical.bodyStyle && !result.isStaticFallback) {
    canonical['canonical.bodyStyle'] = data.bodyStyle;
  }

  const updates = {
    ...canonical,
    ...fieldMeta,
    updatedAt: new Date().toISOString(),
  };

  if (Object.keys(canonical).length > 0 || Object.keys(fieldMeta).length > 0) {
    await db.vehicles.update(vehicle.id, updates);
  }
}

export function useEpaBackfill() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      await preloadEpaData();
      const vehicles = await db.vehicles.toArray();
      const needsWork = vehicles.filter(needsBackfill);

      if (needsWork.length === 0) return;

      for (const vehicle of needsWork) {
        try {
          await backfillVehicle(vehicle);
        } catch {
          // Non-critical — don't block app startup
        }
      }
    }

    run();
  }, []);
}
