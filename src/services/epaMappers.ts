/**
 * Pure mapping functions from EPA strings to app enums.
 *
 * These are heuristic mappings — EPA classes don't map 1:1 to our types.
 * bodyStyle and vehicleClass mappings are clearly labeled as inferred.
 */

import type { VehicleClass, BodyStyle, Drivetrain, EngineType, TransmissionType } from '../types';

// --- EPA Vehicle Class -> App VehicleClass ---
//
// NOTE: EPA only splits pickups into "Small" vs "Standard". The consumer
// taxonomy has three tiers (compact / midsize / fullsize). Without a
// make+model override, "Standard Pickup Trucks" would misclassify
// midsize trucks (Frontier, Tacoma, Colorado, Ranger, etc.) as fullsize.
// See `mapToVehicleClassWithOverride` below.

const EPA_CLASS_TO_VEHICLE_CLASS: Record<string, VehicleClass> = {
  'Two Seaters': 'compact_car',
  'Minicompact Cars': 'compact_car',
  'Subcompact Cars': 'compact_car',
  'Compact Cars': 'compact_car',
  'Midsize Cars': 'midsize_car',
  'Large Cars': 'fullsize_car',
  'Small Station Wagons': 'midsize_car',
  'Midsize Station Wagons': 'midsize_car',
  'Midsize-Large Station Wagons': 'midsize_car',
  'Small Sport Utility Vehicle 2WD': 'compact_crossover',
  'Small Sport Utility Vehicle 4WD': 'compact_crossover',
  'Sport Utility Vehicle - 2WD': 'midsize_crossover',
  'Sport Utility Vehicle - 4WD': 'midsize_crossover',
  'Standard Sport Utility Vehicle 2WD': 'midsize_crossover',
  'Standard Sport Utility Vehicle 4WD': 'midsize_crossover',
  'Minivan - 2WD': 'van',
  'Minivan - 4WD': 'van',
  'Vans': 'van',
  'Vans, Cargo Type': 'van',
  'Vans, Passenger Type': 'van',
  'Vans Passenger': 'van',
  'Small Pickup Trucks': 'compact_truck',
  'Small Pickup Trucks 2WD': 'compact_truck',
  'Small Pickup Trucks 4WD': 'compact_truck',
  'Standard Pickup Trucks': 'fullsize_truck',
  'Standard Pickup Trucks 2WD': 'fullsize_truck',
  'Standard Pickup Trucks 4WD': 'fullsize_truck',
  'Standard Pickup Trucks/2wd': 'fullsize_truck',
  'Special Purpose Vehicles': 'midsize_crossover',
  'Special Purpose Vehicle': 'midsize_crossover',
  'Special Purpose Vehicle 2WD': 'midsize_crossover',
  'Special Purpose Vehicle 4WD': 'midsize_crossover',
  'Special Purpose Vehicles/2wd': 'midsize_crossover',
  'Special Purpose Vehicles/4wd': 'midsize_crossover',
};

export function mapEpaClassToVehicleClass(epaClass: string): VehicleClass | undefined {
  return EPA_CLASS_TO_VEHICLE_CLASS[epaClass];
}

// --- Make+Model overrides for vehicle class ---
//
// Keys: lowercased "make:model". Matched against the EPA's `epaModelKey`
// with drivetrain suffix stripped (e.g., "frontier 4wd" -> "frontier").
//
// MIDSIZE trucks that EPA calls "Standard Pickup Trucks".
// (Modern EPA data actually reclassified some of these as "Small Pickup
// Trucks" starting around 2008; the override catches the older records.)
const MIDSIZE_TRUCK_MODELS = new Set<string>([
  'nissan:frontier',
  'toyota:tacoma',
  'chevrolet:colorado',
  'gmc:canyon',
  'ford:ranger',
  'dodge:dakota',
  'honda:ridgeline',
  'jeep:gladiator',
  'hyundai:santa cruz',
]);

// Body-on-frame SUVs that EPA lumps into generic "Sport Utility Vehicle"
// classes. These should be body_on_frame_suv, not midsize_crossover.
const BODY_ON_FRAME_SUV_MODELS = new Set<string>([
  'toyota:4runner',
  'toyota:sequoia',
  'toyota:land cruiser',
  'lexus:gx',
  'lexus:lx',
  'nissan:armada',
  'nissan:xterra',
  'nissan:pathfinder',       // older (pre-2013) body-on-frame generations
  'chevrolet:tahoe',
  'chevrolet:suburban',
  'gmc:yukon',
  'gmc:yukon xl',
  'ford:bronco',
  'ford:expedition',
  'jeep:wrangler',
  'jeep:grand wagoneer',
  'jeep:wagoneer',
  'cadillac:escalade',
  'cadillac:escalade esv',
  'lincoln:navigator',
]);

/** Strip the EPA drivetrain suffix (" 4wd", " awd", " 2wd", " fwd", " 4x4")
 *  from a model key so overrides can be keyed on the base model. */
function stripDrivetrainSuffix(modelKey: string): string {
  return modelKey.replace(/\s+(4wd|4x4|awd|2wd|fwd|rwd|ff)$/i, '').trim();
}

/**
 * Vehicle class with make+model overrides layered on top of the EPA class map.
 *
 * Use this in preference to `mapEpaClassToVehicleClass` whenever make+model
 * are available. Falls back to the class map when no override applies.
 */
export function mapToVehicleClassWithOverride(
  epaClass: string,
  make: string | undefined,
  modelKey: string | undefined,
): VehicleClass | undefined {
  if (make && modelKey) {
    const bareModel = stripDrivetrainSuffix(modelKey).toLowerCase();
    const key = `${make.toLowerCase()}:${bareModel}`;
    if (MIDSIZE_TRUCK_MODELS.has(key)) return 'compact_truck'; // app taxonomy: compact_truck ≈ midsize
    if (BODY_ON_FRAME_SUV_MODELS.has(key)) return 'body_on_frame_suv';
  }
  return mapEpaClassToVehicleClass(epaClass);
}

// --- EPA Vehicle Class -> App BodyStyle ---

const EPA_CLASS_TO_BODY_STYLE: Record<string, BodyStyle> = {
  'Two Seaters': 'coupe',
  'Minicompact Cars': 'coupe',
  'Subcompact Cars': 'hatchback',
  'Compact Cars': 'sedan',
  'Midsize Cars': 'sedan',
  'Large Cars': 'sedan',
  'Small Station Wagons': 'wagon',
  'Midsize Station Wagons': 'wagon',
  'Midsize-Large Station Wagons': 'wagon',
  'Small Sport Utility Vehicle 2WD': 'crossover',
  'Small Sport Utility Vehicle 4WD': 'crossover',
  'Sport Utility Vehicle - 2WD': 'suv',
  'Sport Utility Vehicle - 4WD': 'suv',
  'Standard Sport Utility Vehicle 2WD': 'suv',
  'Standard Sport Utility Vehicle 4WD': 'suv',
  'Minivan - 2WD': 'van',
  'Minivan - 4WD': 'van',
  'Vans': 'van',
  'Vans, Cargo Type': 'van',
  'Vans, Passenger Type': 'van',
  'Vans Passenger': 'van',
  'Small Pickup Trucks': 'truck',
  'Small Pickup Trucks 2WD': 'truck',
  'Small Pickup Trucks 4WD': 'truck',
  'Standard Pickup Trucks': 'truck',
  'Standard Pickup Trucks 2WD': 'truck',
  'Standard Pickup Trucks 4WD': 'truck',
  'Standard Pickup Trucks/2wd': 'truck',
};

export function mapEpaClassToBodyStyle(epaClass: string): BodyStyle | undefined {
  return EPA_CLASS_TO_BODY_STYLE[epaClass];
}

// --- EPA Drive -> App Drivetrain ---
//
// The EPA value "4-Wheel or All-Wheel Drive" is truly ambiguous — for
// body-on-frame trucks/SUVs it almost always means transfer-case 4WD,
// but for car-based crossovers it usually means AWD. Use the
// context-aware `mapToDrivetrain` whenever the vehicle class / model key
// is available; fall back to the plain mapper only when they aren't.

const EPA_DRIVE_TO_DRIVETRAIN: Record<string, Drivetrain> = {
  'Front-Wheel Drive': 'fwd',
  'Rear-Wheel Drive': 'rwd',
  'All-Wheel Drive': 'awd',
  '4-Wheel or All-Wheel Drive': 'awd', // overridden by mapToDrivetrain for trucks
  '4-Wheel Drive': '4wd',
  'Part-time 4-Wheel Drive': '4wd',
  '2-Wheel Drive': 'fwd', // ambiguous, but most 2WD are FWD in modern cars
};

export function mapEpaDriveToDrivetrain(epaDrive: string): Drivetrain | undefined {
  return EPA_DRIVE_TO_DRIVETRAIN[epaDrive];
}

/**
 * Context-aware drivetrain mapping.
 *
 * Resolves the ambiguous "4-Wheel or All-Wheel Drive" by consulting:
 *   1. The EPA model-name suffix ("cr-v awd" -> awd, "frontier 4wd" -> 4wd).
 *   2. The EPA vehicle class (pickups and body-on-frame SUVs prefer 4wd).
 *
 * For unambiguous drive strings this just delegates to the static map.
 */
export function mapToDrivetrain(
  epaDrive: string,
  context?: { vehicleClass?: string; modelKey?: string },
): Drivetrain | undefined {
  if (epaDrive === '4-Wheel or All-Wheel Drive' && context) {
    // 1. Model suffix is the strongest signal — EPA often tags it explicitly
    if (context.modelKey) {
      const suffix = drivetrainFromModelSuffix(context.modelKey);
      if (suffix === '4wd' || suffix === 'awd') return suffix;
    }
    // 2. Pickup trucks on this EPA drive value are virtually always 4WD
    if (context.vehicleClass && /pickup trucks/i.test(context.vehicleClass)) {
      return '4wd';
    }
    // 3. Body-on-frame SUVs (via model override allowlist) — also 4WD
    //    We can't check the app class here without a make, but the vehicle-class
    //    string is already narrowed in step 2. Fall through.
  }
  return EPA_DRIVE_TO_DRIVETRAIN[epaDrive];
}

// --- EPA Fuel Type -> App EngineType ---

export function mapEpaFuelToEngineType(epaFuel: string): EngineType {
  const lower = epaFuel.toLowerCase();
  if (lower === 'electricity') return 'ev';
  if (lower === 'diesel') return 'diesel';
  if (lower.includes('electricity') && lower.includes('gasoline')) return 'phev';
  if (lower.includes('hybrid')) return 'hybrid';
  return 'gas';
}

// --- EPA Transmission -> App TransmissionType ---

export function mapEpaTransmission(epaTrans: string): TransmissionType | undefined {
  const lower = epaTrans.toLowerCase();
  if (lower.startsWith('manual')) return 'manual';

  // CVT: "variable gear ratios", explicit "cvt", or AV-S codes (Automatic Variable)
  if (lower.includes('cvt') || lower.includes('variable gear ratios') || /\bav-s\d/.test(lower)) return 'cvt';

  // Known automatic patterns — explicit allowlist, no catch-all
  if (/^automatic \d+-spd/.test(lower)) return 'automatic'; // "Automatic 6-spd, ..."
  if (/\(s\d+\)/.test(lower)) return 'automatic';           // "Automatic (S6), ..." — stepped
  if (/\(l\d+\)/.test(lower)) return 'automatic';           // "Automatic (L3), ..." — lockup
  if (/\(am-?s?\d/.test(lower)) return 'automatic';         // "Automatic (AM-S7), ..." — automated manual / DCT
  if (/\(a[12]\)/.test(lower)) return 'automatic';          // "Automatic (A1), ..." — EV single-speed

  return undefined; // Unrecognized — don't guess
}

// --- Drivetrain from EPA model name suffix ---
// EPA often appends "2wd", "4wd", "awd", "fwd" to the model name

export function drivetrainFromModelSuffix(epaModel: string): Drivetrain | undefined {
  const lower = epaModel.toLowerCase();
  if (lower.endsWith(' 4wd') || lower.endsWith(' 4x4')) return '4wd';
  if (lower.endsWith(' awd')) return 'awd';
  if (lower.endsWith(' fwd') || lower.endsWith(' 2wd') || lower.endsWith(' ff')) return 'fwd';
  if (lower.endsWith(' rwd')) return 'rwd';
  return undefined;
}
