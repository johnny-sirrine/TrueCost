import type { ListingAdapter, ParseResult, FieldMeta } from '../types';
import { detectSourceFromText, extractFirstUrlFromText } from './detectSource';

// ---------- Make / Model / Trim vocabularies ----------
//
// We keep these as explicit allowlists so the parser never promotes
// garbage tokens ("for", "on", "sale") to model or trim. Unknown
// makes/models simply return undefined — the UI then surfaces the
// warning instead of fabricating a value.
//
// Aliases normalize colloquial forms to their canonical make name.

const MAKE_ALIASES: Record<string, string> = {
  chevy: 'Chevrolet',
  vw: 'Volkswagen',
  benz: 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
};

const MAKES: string[] = [
  'Toyota', 'Honda', 'Subaru', 'Mazda', 'Kia', 'Nissan', 'Ford',
  'Chevrolet', 'Chevy', 'Jeep', 'Hyundai', 'BMW', 'Volkswagen', 'VW',
  'Acura', 'Audi', 'Buick', 'Cadillac', 'Chrysler', 'Dodge', 'GMC',
  'Infiniti', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mercedes', 'Benz',
  'Mini', 'Mitsubishi', 'Porsche', 'Ram', 'Tesla', 'Volvo',
];

// Model allowlist per canonical make (lowercase for matching).
// Multi-word models MUST appear here for the longest-match logic to work.
const MAKE_MODELS: Record<string, string[]> = {
  Toyota: ['4Runner', 'Avalon', 'C-HR', 'Camry', 'Corolla', 'Corolla Cross', 'Highlander', 'Land Cruiser', 'Matrix', 'Prius', 'Prius Prime', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Venza', 'Yaris', 'GR86', 'GR Corolla', 'GR Supra'],
  Honda: ['Accord', 'Civic', 'CR-V', 'CR-Z', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline', 'Fit', 'Element', 'Clarity'],
  Subaru: ['Ascent', 'Baja', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Tribeca', 'WRX', 'STI'],
  Mazda: ['CX-3', 'CX-30', 'CX-5', 'CX-7', 'CX-9', 'CX-50', 'CX-90', 'Mazda2', 'Mazda3', 'Mazda5', 'Mazda6', 'MX-5', 'MX-5 Miata', 'Miata', 'Tribute', 'Protege'],
  Kia: ['Carnival', 'Forte', 'K5', 'Niro', 'Optima', 'Rio', 'Rondo', 'Seltos', 'Sedona', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride', 'EV6'],
  Nissan: ['Altima', 'Armada', 'Frontier', 'Juke', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'NV200', 'Pathfinder', 'Rogue', 'Rogue Sport', 'Sentra', 'Titan', 'Titan XD', 'Versa', 'Xterra', '370Z', '350Z', 'GT-R', 'Ariya'],
  Ford: ['Bronco', 'Bronco Sport', 'C-Max', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-150 Lightning', 'F-250', 'F-350', 'Fiesta', 'Flex', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Taurus', 'Transit', 'Transit Connect'],
  Chevrolet: ['Blazer', 'Bolt', 'Bolt EUV', 'Camaro', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'Impala', 'Malibu', 'Silverado', 'Silverado 1500', 'Silverado 2500', 'Silverado 2500HD', 'Silverado 3500', 'Silverado 3500HD', 'Sonic', 'Spark', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax', 'Volt'],
  Jeep: ['Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Cherokee L', 'Grand Wagoneer', 'Liberty', 'Patriot', 'Renegade', 'Wagoneer', 'Wrangler', 'Wrangler 4xe', 'Wrangler Unlimited'],
  Hyundai: ['Accent', 'Azera', 'Elantra', 'Elantra N', 'Genesis', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Kona N', 'Nexo', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster', 'Venue'],
  BMW: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X3 M', 'X4', 'X4 M', 'X5', 'X5 M', 'X6', 'X7', 'Z3', 'Z4', 'i3', 'i4', 'i7', 'i8', 'iX', 'iX3', 'M2', 'M3', 'M4', 'M5', 'M6', 'M8'],
  Volkswagen: ['Arteon', 'Atlas', 'Atlas Cross Sport', 'Beetle', 'CC', 'Eos', 'Golf', 'Golf GTI', 'Golf R', 'GTI', 'ID.4', 'Jetta', 'Passat', 'Rabbit', 'Taos', 'Tiguan', 'Touareg'],
  Acura: ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TLX', 'TSX', 'ZDX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS 3', 'RS 5', 'RS 7', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'TT', 'e-tron', 'e-tron GT'],
  Buick: ['Enclave', 'Encore', 'Encore GX', 'Envision', 'LaCrosse', 'Lucerne', 'Regal', 'Verano'],
  Cadillac: ['ATS', 'CT4', 'CT5', 'CT6', 'CTS', 'Escalade', 'Escalade ESV', 'Lyriq', 'SRX', 'XT4', 'XT5', 'XT6', 'XTS'],
  Chrysler: ['200', '300', 'Pacifica', 'Sebring', 'Town & Country', 'Voyager'],
  Dodge: ['Avenger', 'Caliber', 'Challenger', 'Charger', 'Dart', 'Durango', 'Grand Caravan', 'Journey', 'Magnum', 'Nitro', 'Ram 1500', 'Ram 2500', 'Ram 3500'],
  GMC: ['Acadia', 'Canyon', 'Envoy', 'Hummer EV', 'Savana', 'Sierra', 'Sierra 1500', 'Sierra 2500', 'Sierra 2500HD', 'Sierra 3500', 'Terrain', 'Yukon', 'Yukon XL'],
  Infiniti: ['EX35', 'FX35', 'FX45', 'FX50', 'G35', 'G37', 'JX35', 'Q40', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX70', 'QX80'],
  Lexus: ['ES', 'GS', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'UX'],
  Lincoln: ['Aviator', 'Continental', 'Corsair', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Nautilus', 'Navigator'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQB', 'EQE', 'EQS', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'S-Class', 'SL', 'SLC', 'SLK'],
  Mini: ['Clubman', 'Convertible', 'Cooper', 'Countryman', 'Hardtop', 'Paceman'],
  Mitsubishi: ['Eclipse', 'Eclipse Cross', 'Galant', 'Lancer', 'Mirage', 'Outlander', 'Outlander Sport'],
  Porsche: ['911', '718 Boxster', '718 Cayman', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  Ram: ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck', 'Roadster'],
  Volvo: ['C30', 'C40', 'C70', 'S40', 'S60', 'S80', 'S90', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'],
};

// Per-make trim vocabulary. Order doesn't matter — matcher prefers longest match.
// Trims are matched as whole words after the model, case-insensitive.
const MAKE_TRIMS: Record<string, string[]> = {
  Toyota: ['L', 'LE', 'SE', 'XLE', 'XSE', 'XLE Premium', 'Limited', 'Platinum', '1794 Edition', 'TRD', 'TRD Off-Road', 'TRD Pro', 'TRD Sport', 'SR5', 'SR', 'Hybrid', 'LE Hybrid', 'XLE Hybrid', 'Limited Hybrid'],
  Honda: ['DX', 'LX', 'EX', 'EX-L', 'EXL', 'Sport', 'Sport Touring', 'Touring', 'Elite', 'Black Edition', 'Si', 'Type R', 'Trailsport'],
  Subaru: ['Base', 'Premium', 'Sport', 'Limited', 'Touring', 'Wilderness', 'Onyx', 'Onyx Edition', 'Onyx Edition XT', 'Limited XT', 'Touring XT'],
  Nissan: ['S', 'SV', 'SL', 'SR', 'SE', 'SE-R', 'Platinum', 'Platinum Reserve', 'PRO-4X', 'PRO-X', 'Midnight Edition', 'Rock Creek', 'SR Midnight Edition', 'Pro-4X'],
  Ford: ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Raptor', 'Raptor R', 'Tremor', 'ST', 'ST Line', 'Titanium', 'SE', 'SEL', 'Wildtrak', 'Big Bend', 'Black Diamond', 'Outer Banks', 'Badlands', 'Heritage', 'Heritage Edition', 'First Edition'],
  Chevrolet: ['LS', 'LT', '1LT', '2LT', 'RS', '1RS', '2RS', 'LTZ', '1LZ', '2LZ', '3LT', 'Premier', 'Z71', 'ZR2', 'Trail Boss', 'Custom Trail Boss', 'LT Trail Boss', 'High Country', 'WT', 'Work Truck', 'Custom', 'Activ'],
  Jeep: ['Sport', 'Sport S', 'Sport Altitude', 'Sahara', 'Sahara Altitude', 'Rubicon', 'Rubicon 392', 'Rubicon X', 'Willys', 'Willys Sport', 'Mojave', 'Overland', 'Summit', 'Summit Reserve', 'Trailhawk', 'High Altitude', 'Latitude', 'Latitude Lux', '80th Anniversary', 'Freedom', 'Unlimited'],
  Kia: ['LX', 'EX', 'S', 'SX', 'SX Prestige', 'GT', 'GT-Line', 'X-Line', 'X-Pro', 'EX Premium'],
  Hyundai: ['SE', 'SEL', 'SEL Premium', 'SEL Plus', 'Limited', 'Calligraphy', 'N Line', 'N', 'Value', 'Sport', 'Ultimate', 'Blue'],
  Mazda: ['Sport', 'Touring', 'Grand Touring', 'Grand Touring Reserve', 'Signature', 'Club', 'GT', 'GS', 'GS-L', 'Select', 'Preferred', 'Carbon Edition', 'Turbo'],
  BMW: ['xDrive', 'sDrive', 'M Sport', 'Competition', 'xDrive28i', 'xDrive30i', 'xDrive40i', 'xDrive50i', 'M40i', 'M50i'],
  Volkswagen: ['S', 'SE', 'SEL', 'SEL Premium', 'SEL R-Line', 'R-Line', 'R', 'GLI', 'Alltrack', 'Comfortline', 'Highline'],
  Acura: ['Base', 'Technology', 'Advance', 'A-Spec', 'Type S', 'PMC Edition'],
  Audi: ['Premium', 'Premium Plus', 'Prestige', 'Komfort', 'Progressiv', 'Technik'],
  Buick: ['Preferred', 'Essence', 'Premium', 'Avenir', 'ST'],
  Cadillac: ['Luxury', 'Premium Luxury', 'Sport', 'V-Series', 'Blackwing', 'Platinum'],
  Chrysler: ['Touring', 'Touring L', 'Touring L Plus', 'Limited', 'Pinnacle', 'S', '300S', '300C'],
  Dodge: ['SE', 'SXT', 'GT', 'R/T', 'Scat Pack', 'SRT', 'SRT Hellcat', 'Hellcat', 'Demon', 'TRX', 'Citadel', 'Crew'],
  GMC: ['Base', 'SLE', 'SLT', 'AT4', 'AT4X', 'Denali', 'Denali Ultimate', 'Elevation', 'Pro'],
  Infiniti: ['Pure', 'Luxe', 'Sport', 'Premium Select', 'Sensory', 'Autograph', 'Red Sport', 'Red Sport 400'],
  Lexus: ['Base', 'Premium', 'Luxury', 'F Sport', 'F Sport Handling', 'F Sport Performance', 'F'],
  Lincoln: ['Standard', 'Reserve', 'Black Label', 'Grand Touring'],
  'Mercedes-Benz': ['Base', 'Sport', 'Luxury', 'AMG Line', 'AMG', '4MATIC'],
  Mini: ['Cooper', 'Cooper S', 'John Cooper Works', 'JCW', 'Signature', 'Iconic'],
  Mitsubishi: ['ES', 'SE', 'SEL', 'LE', 'GT'],
  Porsche: ['Base', 'S', '4S', 'GTS', 'GT3', 'GT3 RS', 'GT4', 'GT4 RS', 'Turbo', 'Turbo S', 'Carrera', 'Carrera S', 'Carrera 4', 'Carrera 4S', 'Targa'],
  Ram: ['Tradesman', 'Big Horn', 'Lone Star', 'Laramie', 'Laramie Longhorn', 'Limited', 'Rebel', 'TRX', 'Power Wagon'],
  Tesla: ['Standard Range', 'Long Range', 'Performance', 'Plaid'],
  Volvo: ['Momentum', 'R-Design', 'Inscription', 'Cross Country', 'Polestar Engineered', 'Ultimate', 'Core', 'Plus', 'Recharge'],
};

function normalizeMake(rawMake: string): string {
  const alias = MAKE_ALIASES[rawMake.toLowerCase()];
  if (alias) return alias;
  return rawMake;
}

/** Build a word-boundary regex for a multi-word token, case-insensitive.
 *  Escapes regex metachars and treats internal whitespace as flexible (1+ spaces). */
function tokenRegex(token: string, flags = 'i'): RegExp {
  const escaped = token
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, flags);
}

/** Find the first make in text. Returns canonical make name + the match index + length. */
function findMake(text: string): { make: string; start: number; end: number } | null {
  // Longer aliases first so "Mercedes-Benz" beats "Mercedes"
  const sorted = [...MAKES].sort((a, b) => b.length - a.length);
  for (const raw of sorted) {
    const m = text.match(tokenRegex(raw));
    if (m && m.index !== undefined) {
      return { make: normalizeMake(raw), start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

/** Find the longest-matching model from the allowlist for a given make.
 *  Searches anywhere in text (listings rarely put make and model adjacent). */
function findModel(text: string, make: string): { model: string; start: number; end: number } | null {
  const models = MAKE_MODELS[make];
  if (!models) return null;
  // Longer models first so "Grand Cherokee" beats "Grand"
  const sorted = [...models].sort((a, b) => b.length - a.length);
  for (const model of sorted) {
    const m = text.match(tokenRegex(model));
    if (m && m.index !== undefined) {
      return { model, start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

/** Find the longest-matching trim from the allowlist for a given make.
 *  Only searches text AFTER the model match (to avoid matching "LT" inside "Liberty" or similar). */
function findTrim(text: string, make: string, searchFrom: number): string | undefined {
  const trims = MAKE_TRIMS[make];
  if (!trims) return undefined;
  const hay = text.slice(searchFrom);
  // Longer trims first so "TRD Off-Road" beats "TRD"
  const sorted = [...trims].sort((a, b) => b.length - a.length);
  for (const trim of sorted) {
    if (tokenRegex(trim).test(hay)) {
      return trim;
    }
  }
  return undefined;
}

function parseMileage(text: string): number | undefined {
  const mileageMatch = text.match(
    /\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\s*(?:miles?|mi)\b/i,
  );
  if (!mileageMatch) return undefined;

  const numeric = Number(mileageMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return undefined;

  return mileageMatch[2]
    ? Math.round(numeric * 1000)
    : Math.round(numeric);
}

// Regex-based extraction from pasted listing text.
// This is the primary "smart" ingestion path in v1.
export const rawTextAdapter: ListingAdapter = {
  id: 'raw_text',
  name: 'Raw Text',
  canHandle: (input: string) => {
    // Handle anything that isn't clearly a URL
    return !input.startsWith('http');
  },
  parse: async (input: string): Promise<ParseResult> => {
    const text = input.trim();
    const fieldMeta: Record<string, FieldMeta> = {};
    const warnings: string[] = [];

    // If the pasted text contains a recognizable listing URL, use the
    // URL's origin as the canonical source so the board labels it
    // correctly (e.g. "Facebook" instead of "Pasted Text").
    const embeddedUrl = extractFirstUrlFromText(text);
    const embedded = detectSourceFromText(text);
    const hasUnrecognizedEmbeddedUrl = embeddedUrl !== null && embedded === null;

    // Extract year (4 digits, 1990-2030)
    const yearMatch = text.match(/\b(19\d{2}|20[0-3]\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
    if (year) fieldMeta['year'] = { origin: 'extracted', confidence: 'high' };

    // Extract price ($X,XXX or $XX,XXX patterns)
    const priceMatch = text.match(/\$\s*([\d,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined;
    if (price) fieldMeta['listingPrice'] = { origin: 'extracted', confidence: 'high' };

    // Extract mileage (XXX,XXX mi/miles or shorthand like 120k mi)
    const mileage = parseMileage(text);
    if (mileage) fieldMeta['mileage'] = { origin: 'extracted', confidence: 'medium', note: 'Extracted from text pattern' };

    // Extract make, model, trim — allowlist-driven so bad tokens never leak through
    let make: string | undefined;
    let model: string | undefined;
    let trim: string | undefined;
    let modelEnd = 0;

    const makeMatch = findMake(text);
    if (makeMatch) {
      make = makeMatch.make;
      fieldMeta['make'] = { origin: 'extracted', confidence: 'high' };

      const modelMatch = findModel(text, make);
      if (modelMatch) {
        model = modelMatch.model;
        modelEnd = modelMatch.end;
        fieldMeta['model'] = { origin: 'extracted', confidence: 'high', note: 'Matched allowlisted model' };

        // Look for trim after the model in the text
        const found = findTrim(text, make, modelMatch.end);
        if (found) {
          trim = found;
          fieldMeta['trim'] = { origin: 'extracted', confidence: 'medium', note: 'Matched trim vocabulary' };
        } else {
          // Fall back: search full text for trim (covers cases where trim appears before model in text)
          const fallback = findTrim(text, make, 0);
          if (fallback) {
            trim = fallback;
            fieldMeta['trim'] = { origin: 'extracted', confidence: 'low', note: 'Matched trim vocabulary (position-unverified)' };
          }
        }
      }
    }
    // silence unused-var lint if modelEnd ever becomes unused
    void modelEnd;

    // Drivetrain hints
    let drivetrain: 'awd' | '4wd' | 'fwd' | 'rwd' | undefined;
    const lower = text.toLowerCase();
    if (/\b4wd\b/.test(lower) || /\b4x4\b/.test(lower) || /\bfour[\s-]?wheel\b/.test(lower)) {
      drivetrain = '4wd';
      fieldMeta['drivetrain'] = { origin: 'extracted', confidence: 'high' };
    } else if (/\bawd\b/.test(lower) || /\ball[\s-]?wheel\b/.test(lower)) {
      drivetrain = 'awd';
      fieldMeta['drivetrain'] = { origin: 'extracted', confidence: 'high' };
    } else if (/\brwd\b/.test(lower) || /\brear[\s-]?wheel\b/.test(lower)) {
      drivetrain = 'rwd';
      fieldMeta['drivetrain'] = { origin: 'extracted', confidence: 'high' };
    } else if (/\bfwd\b/.test(lower) || /\bfront[\s-]?wheel\b/.test(lower)) {
      drivetrain = 'fwd';
      fieldMeta['drivetrain'] = { origin: 'extracted', confidence: 'high' };
    }

    // Title status hints
    let titleHint: string | undefined;
    if (lower.includes('rebuilt') || lower.includes('rebuild')) titleHint = 'rebuilt';
    else if (lower.includes('salvage')) titleHint = 'salvage';
    else if (lower.includes('clean title')) titleHint = 'clean';

    // Transmission hints
    let transmission: 'manual' | 'automatic' | undefined;
    if (lower.includes('manual') || lower.includes('stick') || lower.includes('6-speed') || lower.includes('5-speed')) {
      transmission = 'manual';
      fieldMeta['transmissionType'] = { origin: 'extracted', confidence: 'medium' };
    } else if (lower.includes('automatic') || lower.includes('auto trans')) {
      transmission = 'automatic';
      fieldMeta['transmissionType'] = { origin: 'extracted', confidence: 'medium' };
    }

    if (!year) warnings.push('Could not extract year');
    if (!make) warnings.push('Could not identify make');
    if (make && !model) warnings.push(`Could not identify model for ${make}`);
    if (!price) warnings.push('Could not extract price');
    if (hasUnrecognizedEmbeddedUrl) {
      warnings.push('An embedded URL doesn’t match a supported source we can identify confidently.');
      warnings.push('We kept the URL, but did not infer the source.');
      warnings.push('The listing will stay labeled as Pasted Text unless you enter a recognized source URL.');
    }

    return {
      listing: {
        source: embedded?.source ?? 'raw_text',
        sourceUrl: embedded?.url,
        rawTitle: text.slice(0, 100),
        rawDescription: text,
        rawPrice: price,
        rawMileage: mileage,
        titleStatusRaw: titleHint,
      },
      canonical: {
        // Leave year/make/model undefined when unknown; the UI keeps its default
        // and the warning surfaces the gap to the user.
        ...(year !== undefined ? { year } : {}),
        ...(make !== undefined ? { make } : {}),
        ...(model !== undefined ? { model } : {}),
        ...(trim !== undefined ? { trim } : {}),
        drivetrain,
        transmissionType: transmission,
      },
      suggestedPrice: price,
      suggestedMileage: mileage,
      suggestedTitleStatus: titleHint,
      fieldMeta,
      warnings,
    };
  },
};
