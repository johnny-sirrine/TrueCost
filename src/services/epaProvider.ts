/**
 * Local EPA data provider.
 *
 * Loads preprocessed EPA vehicle data from a static JSON asset and provides
 * lookup by year/make/model. The data is lazy-loaded on first access.
 *
 * This is a local-only, production-safe data path — no network calls.
 */

export interface EpaVehicleConfig {
  option: string;
  combinedMpg: number;
  cityMpg: number;
  hwyMpg: number;
  cylinders: number;
  fuelType: string;
  transmission: string;
  vehicleClass: string;
  driveType: string;
  /** The EPA model key (may include drivetrain suffix like "cr-v awd") */
  epaModelKey: string;
}

interface EpaDataset {
  pools: {
    options: string[];
    fuels: string[];
    transmissions: string[];
    classes: string[];
    drives: string[];
  };
  vehicles: Record<string, Record<string, Record<string, number[][]>>>;
}

let dataset: EpaDataset | null = null;
let loadPromise: Promise<EpaDataset> | null = null;

async function loadDataset(): Promise<EpaDataset> {
  if (dataset) return dataset;
  if (loadPromise) return loadPromise;

  loadPromise = import('../data/epa/epa-vehicles.json').then((mod) => {
    dataset = mod.default as EpaDataset;
    return dataset;
  });
  return loadPromise;
}

/**
 * Decode a config tuple from the compact format into a typed object.
 */
function decodeConfig(tuple: number[], pools: EpaDataset['pools'], epaModelKey: string): EpaVehicleConfig {
  return {
    option: pools.options[tuple[0]] ?? '',
    combinedMpg: tuple[1],
    cityMpg: tuple[2],
    hwyMpg: tuple[3],
    cylinders: tuple[4],
    fuelType: pools.fuels[tuple[5]] ?? '',
    transmission: pools.transmissions[tuple[6]] ?? '',
    vehicleClass: pools.classes[tuple[7]] ?? '',
    driveType: pools.drives[tuple[8]] ?? '',
    epaModelKey,
  };
}

/**
 * Look up all EPA configurations for a given year/make/model.
 *
 * The EPA often splits models by drivetrain (e.g., "cr-v 2wd", "cr-v awd").
 * This function matches all model keys that start with the base model name,
 * returning all drivetrain/trim variants.
 */
export async function lookupEpaConfigs(
  year: number,
  make: string,
  model: string,
): Promise<EpaVehicleConfig[]> {
  const data = await loadDataset();
  const makeKey = make.trim().toLowerCase();
  const modelKey = model.trim().toLowerCase();
  const yearKey = String(year);

  const makeData = data.vehicles[makeKey];
  if (!makeData) return [];

  const results: EpaVehicleConfig[] = [];

  // Collect from exact match and prefix matches (e.g., "cr-v" matches "cr-v awd", "cr-v fwd")
  for (const [epaModel, yearMap] of Object.entries(makeData)) {
    if (epaModel !== modelKey && !epaModel.startsWith(modelKey + ' ')) continue;
    const configs = yearMap[yearKey];
    if (!configs) continue;
    for (const tuple of configs) {
      results.push(decodeConfig(tuple, data.pools, epaModel));
    }
  }

  return results;
}

/**
 * Check if the EPA dataset is loaded (for synchronous availability checks).
 */
export function isEpaDataLoaded(): boolean {
  return dataset !== null;
}

/**
 * Preload the EPA dataset. Call early (e.g., on dialog open) to avoid
 * latency when the user starts typing.
 */
export async function preloadEpaData(): Promise<void> {
  await loadDataset();
}
