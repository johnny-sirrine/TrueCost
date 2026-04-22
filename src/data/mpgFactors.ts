import type { VehicleClass, Drivetrain, ConditionLevel } from '../types';
import type { UsagePattern } from '../types';

// Base factor by vehicle class + drivetrain combo
// Represents typical real-world vs EPA efficiency for each class
const BASE_FACTORS: Record<string, number> = {
  // Compact
  'compact_car:fwd': 0.94,
  'compact_car:awd': 0.91,
  'compact_crossover:fwd': 0.92,
  'compact_crossover:awd': 0.90,
  // Midsize
  'midsize_car:fwd': 0.93,
  'midsize_car:awd': 0.90,
  'midsize_crossover:fwd': 0.90,
  'midsize_crossover:awd': 0.88,
  // Fullsize
  'fullsize_car:fwd': 0.91,
  'fullsize_car:rwd': 0.90,
  'fullsize_car:awd': 0.88,
  'fullsize_suv:4wd': 0.85,
  'fullsize_suv:awd': 0.86,
  'fullsize_suv:rwd': 0.88,
  // Body-on-frame
  'body_on_frame_suv:4wd': 0.86,
  'body_on_frame_suv:awd': 0.87,
  'body_on_frame_suv:rwd': 0.89,
  // Trucks
  'compact_truck:4wd': 0.87,
  'compact_truck:rwd': 0.90,
  'fullsize_truck:4wd': 0.85,
  'fullsize_truck:rwd': 0.88,
  'fullsize_truck:awd': 0.85,
  // Van
  'van:fwd': 0.89,
  'van:awd': 0.87,
};

export function getBaseFactor(vehicleClass?: VehicleClass, drivetrain?: Drivetrain): number {
  if (!vehicleClass || !drivetrain) return 0.90; // safe default
  return BASE_FACTORS[`${vehicleClass}:${drivetrain}`] ?? 0.90;
}

// Age factor: slight efficiency loss as vehicles age
const AGE_BRACKETS: [number, number][] = [
  [5, 1.00],   // 0-5 years
  [10, 0.99],  // 6-10 years
  [15, 0.98],  // 11-15 years
  [20, 0.96],  // 16-20 years
];

export function getAgeFactor(vehicleAge: number): number {
  for (const [maxAge, factor] of AGE_BRACKETS) {
    if (vehicleAge <= maxAge) return factor;
  }
  return 0.94; // 21+ years
}

// Condition factor
const CONDITION_FACTORS: Record<ConditionLevel, number> = {
  excellent: 1.00,
  average: 0.99,
  mild_mods: 0.96,
  poor: 0.91,
};

export function getConditionFactor(condition: ConditionLevel): number {
  return CONDITION_FACTORS[condition] ?? 0.99;
}

// Usage pattern factor
const USAGE_FACTORS: Record<UsagePattern, number> = {
  mostly_highway: 1.02,
  mixed: 1.00,
  city_heavy: 0.95,
  aggressive_short_trips: 0.90,
};

export function getUsageFactor(pattern: UsagePattern): number {
  return USAGE_FACTORS[pattern] ?? 1.00;
}
