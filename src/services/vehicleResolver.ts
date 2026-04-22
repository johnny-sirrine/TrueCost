/**
 * Pure vehicle resolver: scores EPA candidates against user-known facts,
 * collapses equivalent configs, and determines resolution confidence.
 *
 * Deterministic, testable, no React dependencies.
 */

import { lookupEpaConfigs, type EpaVehicleConfig } from './epaProvider';
import {
  mapToVehicleClassWithOverride,
  mapEpaClassToBodyStyle,
  mapToDrivetrain,
  mapEpaFuelToEngineType,
  mapEpaTransmission,
  drivetrainFromModelSuffix,
} from './epaMappers';
import { lookupEpaReference, inferVehicleClass, inferBodyStyle } from '../data/vehicleReference';
import type { VehicleClass, BodyStyle, Drivetrain, EngineType, TransmissionType, FieldMeta } from '../types';

// --- Public types ---

export interface ResolvedVehicle {
  combinedMpg: number;
  cityMpg: number;
  hwyMpg: number;
  vehicleClass?: VehicleClass;
  bodyStyle?: BodyStyle;
  drivetrain?: Drivetrain;
  engineType?: EngineType;
  cylinders?: number;
  transmissionType?: TransmissionType;
}

export type ResolutionMethod =
  | 'single_candidate'
  | 'equivalent_candidates'
  | 'weighted_match'
  | 'manual_candidate_selection'
  | 'static_fallback'
  | 'no_data';

export interface ScoredCandidate {
  config: EpaVehicleConfig;
  mapped: ResolvedVehicle;
  score: number;
  /** Human-readable breakdown: "+3 drivetrain match, +2 cylinders match" */
  scoreBreakdown: string;
}

export interface ResolveResult {
  status: 'resolved' | 'ambiguous' | 'no_data';
  resolutionMethod: ResolutionMethod;
  /** Why this resolution was chosen */
  matchReason: string;
  best: ResolvedVehicle | null;
  candidates: ScoredCandidate[];
  isStaticFallback: boolean;
}

export interface UserHints {
  trim?: string;
  drivetrain?: Drivetrain;
  transmission?: TransmissionType;
  engineType?: EngineType;
  cylinders?: number;
}

// --- Internal helpers ---

function mapConfig(config: EpaVehicleConfig, make: string): ResolvedVehicle {
  // Context-aware drive mapping: "4-Wheel or All-Wheel Drive" on a pickup
  // should resolve to 4wd, not awd. Falls back to the model-suffix parser
  // (e.g., "frontier 4wd") when the drive string alone is undefined.
  const drivetrain =
    mapToDrivetrain(config.driveType, {
      vehicleClass: config.vehicleClass,
      modelKey: config.epaModelKey,
    }) ??
    drivetrainFromModelSuffix(config.epaModelKey);

  return {
    combinedMpg: config.combinedMpg,
    cityMpg: config.cityMpg,
    hwyMpg: config.hwyMpg,
    vehicleClass: mapToVehicleClassWithOverride(config.vehicleClass, make, config.epaModelKey),
    bodyStyle: mapEpaClassToBodyStyle(config.vehicleClass),
    drivetrain,
    engineType: mapEpaFuelToEngineType(config.fuelType),
    cylinders: config.cylinders || undefined,
    transmissionType: mapEpaTransmission(config.transmission),
  };
}

/** Composite key for equivalence grouping on high-impact fields.
 *  MPG is bucketed to nearest 2 — configs differing by 1-2 MPG
 *  but matching on everything else are practically equivalent. */
function equivalenceKey(m: ResolvedVehicle): string {
  const mpgBucket = Math.round(m.combinedMpg / 2) * 2;
  return [
    mpgBucket,
    m.drivetrain ?? '_',
    m.engineType ?? '_',
    m.cylinders ?? '_',
    m.transmissionType ?? '_',
  ].join('|');
}

/** AWD and 4WD are often used interchangeably in listings vs. EPA data. */
function drivetrainCompatible(a: Drivetrain, b: Drivetrain): boolean {
  const compatible = new Set(['awd', '4wd']);
  return compatible.has(a) && compatible.has(b);
}

interface ScoreEntry {
  points: number;
  label: string;
}

function scoreCandidate(mapped: ResolvedVehicle, config: EpaVehicleConfig, hints: UserHints): { score: number; breakdown: string } {
  const entries: ScoreEntry[] = [];

  if (hints.drivetrain && mapped.drivetrain) {
    if (mapped.drivetrain === hints.drivetrain) {
      entries.push({ points: 3, label: '+3 drivetrain match' });
    } else if (drivetrainCompatible(hints.drivetrain, mapped.drivetrain)) {
      entries.push({ points: 1, label: '+1 drivetrain compatible (awd/4wd)' });
    } else {
      entries.push({ points: -3, label: '-3 drivetrain mismatch' });
    }
  }

  if (hints.transmission && mapped.transmissionType) {
    if (mapped.transmissionType === hints.transmission) {
      entries.push({ points: 2, label: '+2 transmission match' });
    } else {
      entries.push({ points: -2, label: '-2 transmission mismatch' });
    }
  }

  if (hints.engineType && mapped.engineType) {
    if (mapped.engineType === hints.engineType) {
      entries.push({ points: 2, label: '+2 engine type match' });
    } else {
      entries.push({ points: -2, label: '-2 engine type mismatch' });
    }
  }

  if (hints.cylinders && mapped.cylinders) {
    if (mapped.cylinders === hints.cylinders) {
      entries.push({ points: 2, label: '+2 cylinders match' });
    } else {
      entries.push({ points: -1, label: '-1 cylinders mismatch' });
    }
  }

  if (hints.trim) {
    const trimLower = hints.trim.toLowerCase();
    const optionLower = config.option.toLowerCase();
    if (optionLower.includes(trimLower) || trimLower.includes(optionLower)) {
      entries.push({ points: 1, label: '+1 trim fuzzy match' });
    }
  }

  const score = entries.reduce((sum, e) => sum + e.points, 0);
  const breakdown = entries.map((e) => e.label).join(', ') || 'no hints applied';
  return { score, breakdown };
}

// --- Main resolver ---

export async function resolveVehicle(
  year: number,
  make: string,
  model: string,
  hints: UserHints = {},
): Promise<ResolveResult> {
  // Phase A: Gather candidate pool
  const rawConfigs = await lookupEpaConfigs(year, make, model);

  if (rawConfigs.length === 0) {
    return buildStaticFallback(make, model);
  }

  // Phase B: Map + collapse equivalence groups
  const mapped = rawConfigs.map((config) => ({
    config,
    mapped: mapConfig(config, make),
  }));

  const groups = new Map<string, typeof mapped>();
  for (const entry of mapped) {
    const key = equivalenceKey(entry.mapped);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  // Pick first config as representative of each equivalence group
  const representatives = Array.from(groups.values()).map((group) => group[0]);

  // Phase C: Score against user hints
  const scored: ScoredCandidate[] = representatives.map(({ config, mapped: m }) => {
    const { score, breakdown } = scoreCandidate(m, config, hints);
    return { config, mapped: m, score, scoreBreakdown: breakdown };
  });

  scored.sort((a, b) => b.score - a.score);

  // Phase D: Determine resolution status
  const groupCount = scored.length;
  const rawCount = rawConfigs.length;

  if (groupCount === 1) {
    const method: ResolutionMethod = rawCount === 1 ? 'single_candidate' : 'equivalent_candidates';
    const reason = rawCount === 1
      ? '1 EPA config found'
      : `${rawCount} raw configs collapsed into 1 equivalence group`;

    return {
      status: 'resolved',
      resolutionMethod: method,
      matchReason: reason,
      best: scored[0].mapped,
      candidates: scored,
      isStaticFallback: false,
    };
  }

  // Multiple equivalence groups — check if hints produce a clear winner
  const top = scored[0];
  const second = scored[1];
  const margin = top.score - second.score;

  if (top.score > 0 && margin >= 3) {
    return {
      status: 'resolved',
      resolutionMethod: 'weighted_match',
      matchReason: `${groupCount} groups, top scored ${top.score} (margin +${margin}): ${top.scoreBreakdown}`,
      best: top.mapped,
      candidates: scored,
      isStaticFallback: false,
    };
  }

  // Ambiguous — cannot auto-resolve
  return {
    status: 'ambiguous',
    resolutionMethod: 'ambiguous' as unknown as ResolutionMethod,
    matchReason: `${groupCount} equivalence groups from ${rawCount} configs, no clear winner`,
    best: null,
    candidates: scored,
    isStaticFallback: false,
  };
}

// --- Static fallback ---

function buildStaticFallback(make: string, model: string): ResolveResult {
  const ref = lookupEpaReference(make, model);
  const vehicleClass = inferVehicleClass(make, model);
  const bodyStyle = inferBodyStyle(make, model);

  if (!ref && !vehicleClass && !bodyStyle) {
    return {
      status: 'no_data',
      resolutionMethod: 'no_data',
      matchReason: 'No EPA data and no static reference found',
      best: null,
      candidates: [],
      isStaticFallback: false,
    };
  }

  return {
    status: 'no_data',
    resolutionMethod: 'static_fallback',
    matchReason: 'No EPA data — using static reference table',
    best: {
      combinedMpg: ref?.combinedMpg ?? 0,
      cityMpg: 0,
      hwyMpg: 0,
      vehicleClass,
      bodyStyle,
      drivetrain: undefined,
      engineType: undefined,
      cylinders: ref?.cylinders,
      transmissionType: undefined,
    },
    candidates: [],
    isStaticFallback: true,
  };
}

// --- Provenance helper ---

/**
 * Build fieldMeta entries for EPA-resolved or static-fallback data.
 * Both add dialogs call this — single source of truth for provenance.
 */
export function buildFieldMetaFromLookup(
  data: ResolvedVehicle | null,
  isStaticFallback: boolean,
  epaOptionLabel?: string,
): Record<string, FieldMeta> {
  if (!data) return {};

  const meta: Record<string, FieldMeta> = {};

  if (isStaticFallback) {
    // All static-fallback fields: low-confidence inferred
    const fallbackMeta: FieldMeta = { origin: 'inferred', confidence: 'low', note: 'Static reference — limited data' };
    if (data.combinedMpg) meta.epaCombinedMpg = fallbackMeta;
    if (data.cylinders) meta.cylinders = fallbackMeta;
    if (data.vehicleClass) meta.vehicleClass = fallbackMeta;
    if (data.bodyStyle) meta.bodyStyle = fallbackMeta;
    return meta;
  }

  // EPA direct facts — high confidence external_lookup
  const epaNote = epaOptionLabel
    ? `EPA fueleconomy.gov — ${epaOptionLabel}`
    : 'EPA fueleconomy.gov';

  if (data.combinedMpg) {
    meta.epaCombinedMpg = { origin: 'external_lookup', confidence: 'high', note: epaNote };
  }
  if (data.cylinders) {
    meta.cylinders = { origin: 'external_lookup', confidence: 'high', note: epaNote };
  }
  if (data.engineType) {
    meta.engineType = { origin: 'external_lookup', confidence: 'high', note: epaNote };
  }
  if (data.drivetrain) {
    meta.drivetrain = { origin: 'external_lookup', confidence: 'high', note: epaNote };
  }
  if (data.transmissionType) {
    meta.transmissionType = { origin: 'external_lookup', confidence: 'high', note: epaNote };
  }

  // EPA-derived heuristics — medium confidence inferred
  if (data.vehicleClass) {
    meta.vehicleClass = { origin: 'inferred', confidence: 'medium', note: 'Mapped from EPA vehicle class' };
  }
  if (data.bodyStyle) {
    meta.bodyStyle = { origin: 'inferred', confidence: 'medium', note: 'Mapped from EPA vehicle class' };
  }

  return meta;
}
