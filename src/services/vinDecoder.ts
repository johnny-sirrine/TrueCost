/**
 * NHTSA vPIC VIN decoder client.
 *
 * Public, keyless, CORS-friendly government API. Returns canonical-vehicle
 * hints (year, make, model, series/trim, body class, drive, engine).
 *
 * Pure + testable: fetch is injected via parameter so tests don't need to
 * stub globals. Local VIN validation runs before the network call so we
 * never ship obviously malformed input to the API.
 */

import type { Drivetrain, EngineType } from '../types';

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

/** Transliteration table for VIN check-digit math. `I`, `O`, `Q` are
 *  disallowed in VINs; other letters map to digits per ISO 3779. */
const VIN_TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5,           P: 7,           R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export interface VinValidationResult {
  valid: boolean;
  reason?: string;
  normalized?: string;
}

/** Local VIN validation: length, allowed characters, and ISO 3779
 *  check-digit. Rejects obviously malformed input before we hit the
 *  vPIC endpoint. Pre-1981 VINs are not 17 chars; we accept only
 *  modern VINs here since the app's year range is 1990+. */
export function validateVin(raw: string): VinValidationResult {
  if (!raw) return { valid: false, reason: 'VIN is empty' };
  const vin = raw.trim().toUpperCase();
  if (vin.length !== 17) {
    return { valid: false, reason: `VIN must be 17 characters (got ${vin.length})` };
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return { valid: false, reason: 'VIN contains invalid characters (I, O, Q not allowed)' };
  }

  // Check digit validation (position 9, 0-indexed 8). Value is the sum
  // of transliterated chars times the weight vector, mod 11. `10` is
  // represented as `X`.
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value = VIN_TRANSLIT[vin[i]];
    if (value === undefined) {
      return { valid: false, reason: `Invalid character '${vin[i]}' at position ${i + 1}` };
    }
    sum += value * VIN_WEIGHTS[i];
  }
  const expected = sum % 11;
  const expectedChar = expected === 10 ? 'X' : String(expected);
  if (vin[8] !== expectedChar) {
    return {
      valid: false,
      reason: `VIN check digit mismatch (expected ${expectedChar} at position 9, got ${vin[8]})`,
    };
  }

  return { valid: true, normalized: vin };
}

export interface VinDecodeResult {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyClass?: string;
  drivetrain?: Drivetrain;
  engineType?: EngineType;
  cylinders?: number;
  /** Errors or warnings reported by vPIC itself (e.g. "Incomplete VIN"). */
  vpicErrorText?: string;
}

/** Raw shape of a vPIC response. Only fields we actually consume. */
interface VpicResponse {
  Results?: Array<{
    ModelYear?: string;
    Make?: string;
    Model?: string;
    Series?: string;
    Trim?: string;
    BodyClass?: string;
    DriveType?: string;
    FuelTypePrimary?: string;
    EngineCylinders?: string;
    ErrorText?: string;
    ErrorCode?: string;
  }>;
}

/** Map a vPIC DriveType string to our Drivetrain enum. vPIC uses phrases
 *  like "4WD/4-Wheel Drive/4x4" or "AWD/All-Wheel Drive". We normalize
 *  with a simple keyword scan. Unknown strings return undefined so the
 *  resolver can fall back to its own heuristics. */
function mapVpicDrive(raw: string | undefined): Drivetrain | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  // Order matters: check for 4WD/4x4 before AWD so "4-Wheel Drive" doesn't
  // get captured by a broader "wheel drive" match.
  if (/\b4wd\b|4x4|four[\s-]?wheel/.test(s)) return '4wd';
  if (/\bawd\b|all[\s-]?wheel/.test(s)) return 'awd';
  if (/\bfwd\b|front[\s-]?wheel/.test(s)) return 'fwd';
  if (/\brwd\b|rear[\s-]?wheel/.test(s)) return 'rwd';
  return undefined;
}

/** Map vPIC FuelTypePrimary to our EngineType enum. */
function mapVpicFuel(raw: string | undefined): EngineType | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes('electric') && !s.includes('hybrid')) return 'ev';
  if (s.includes('plug-in') || s.includes('phev')) return 'phev';
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('diesel')) return 'diesel';
  if (s.includes('gasoline') || s.includes('gas') || s.includes('ethanol') || s.includes('flex')) return 'gas';
  return undefined;
}

export interface DecodeVinOptions {
  /** Injectable fetch, primarily for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Abort signal for debouncing / cancellation. */
  signal?: AbortSignal;
}

/**
 * Decode a VIN via NHTSA vPIC. Returns `null` if the VIN is locally
 * invalid or the network call fails. Callers should treat this as
 * best-effort hints — the resolver will still score against EPA data.
 */
export async function decodeVin(
  rawVin: string,
  options: DecodeVinOptions = {},
): Promise<VinDecodeResult | null> {
  const validation = validateVin(rawVin);
  if (!validation.valid || !validation.normalized) return null;
  const vin = validation.normalized;

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${VPIC_URL}/${encodeURIComponent(vin)}?format=json`;

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: options.signal });
  } catch {
    // Network failure or aborted — return null, caller decides what to show.
    return null;
  }

  if (!response.ok) return null;

  let body: VpicResponse;
  try {
    body = (await response.json()) as VpicResponse;
  } catch {
    return null;
  }

  const row = body.Results?.[0];
  if (!row) return null;

  // vPIC occasionally returns empty strings instead of omitting fields;
  // normalize to undefined so downstream truthiness checks work.
  const nz = (s: string | undefined): string | undefined =>
    s && s.trim().length > 0 ? s.trim() : undefined;

  const yearStr = nz(row.ModelYear);
  const year = yearStr ? Number(yearStr) : undefined;
  const cylStr = nz(row.EngineCylinders);
  const cylinders = cylStr ? Number(cylStr) : undefined;

  return {
    year: year && Number.isFinite(year) ? year : undefined,
    make: nz(row.Make),
    model: nz(row.Model),
    // Trim can appear in either Trim or Series depending on manufacturer
    // reporting; prefer Trim, fall back to Series.
    trim: nz(row.Trim) ?? nz(row.Series),
    bodyClass: nz(row.BodyClass),
    drivetrain: mapVpicDrive(nz(row.DriveType)),
    engineType: mapVpicFuel(nz(row.FuelTypePrimary)),
    cylinders: cylinders && Number.isFinite(cylinders) ? cylinders : undefined,
    vpicErrorText: nz(row.ErrorText),
  };
}
