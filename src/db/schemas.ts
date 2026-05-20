import { z } from 'zod';

// Zod schemas for runtime validation on writes

const fieldMetaSchema = z.object({
  origin: z.enum(['extracted', 'external_lookup', 'inferred', 'assumed', 'overridden']),
  confidence: z.enum(['high', 'medium', 'low']),
  originalValue: z.union([z.string(), z.number()]).optional(),
  note: z.string().optional(),
});

const vehicleListingSchema = z.object({
  source: z.enum(['ksl', 'facebook', 'carscom', 'craigslist', 'dealer', 'manual', 'raw_text']),
  sourceUrl: z.string().optional(),
  rawTitle: z.string().optional(),
  rawDescription: z.string().optional(),
  rawPrice: z.number().optional(),
  rawMileage: z.number().optional(),
  sellerType: z.enum(['dealer', 'private', 'unknown']).optional(),
  location: z.string().optional(),
  titleStatusRaw: z.string().optional(),
  vin: z.string().length(17).optional(),
});

const historyFlagSchema = z.object({
  id: z.string(),
  source: z.enum(['nhtsa_recalls', 'nhtsa_vpic', 'user_override']),
  severity: z.enum(['info', 'watch', 'critical']),
  category: z.enum(['open_recall', 'title_brand', 'salvage', 'stolen', 'odometer', 'user_note']),
  title: z.string(),
  detail: z.string(),
  link: z.string().optional(),
  identifier: z.string().optional(),
});

const historyReportSchema = z.object({
  flags: z.array(historyFlagSchema),
  sourcesChecked: z.array(z.enum(['nhtsa_recalls', 'nhtsa_vpic', 'user_override'])),
  completeness: z.literal('screening'),
  lastChecked: z.string(),
  disclaimer: z.string(),
});

const canonicalVehicleSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  bodyStyle: z.enum(['sedan', 'suv', 'truck', 'van', 'coupe', 'hatchback', 'wagon', 'crossover']).optional(),
  drivetrain: z.enum(['fwd', 'rwd', 'awd', '4wd']).optional(),
  engineType: z.enum(['gas', 'diesel', 'hybrid', 'phev', 'ev']).optional(),
  cylinders: z.number().int().optional(),
  transmissionType: z.enum(['automatic', 'manual', 'cvt']).optional(),
  vehicleClass: z.enum([
    'compact_car', 'midsize_car', 'fullsize_car',
    'compact_crossover', 'midsize_crossover', 'fullsize_suv',
    'body_on_frame_suv', 'compact_truck', 'fullsize_truck', 'van',
  ]).optional(),
  epaCombinedMpg: z.number().optional(),
});

const vehicleOverridesSchema = z.object({
  realisticMpg: z.number().optional(),
  routineMonthly: z.number().optional(),
  expectedRepairsMonthly: z.number().optional(),
  majorRepairReserveMonthly: z.number().optional(),
  currentMarketValue: z.number().optional(),
  annualMiles: z.number().optional(),
  insuranceCoverageMode: z.enum(['liability_only', 'full_coverage']).optional(),
  insuranceMonthly: z.number().optional(),
});

const vehicleUserDataSchema = z.object({
  listingPrice: z.number().min(0),
  mileage: z.number().min(0),
  titleStatus: z.enum(['clean', 'salvage', 'rebuilt', 'lemon', 'unknown']),
  conditionLevel: z.enum(['excellent', 'average', 'mild_mods', 'poor']),
  modificationLevel: z.enum(['stock', 'low', 'medium', 'high']).default('stock'),
  catchUpCost: z.number().min(0),
  feesCost: z.number().min(0).default(0),
  notes: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  archived: z.boolean(),
  isCurrentCar: z.boolean(),
  userRating: z.number().int().min(1).max(5).optional(),
  depreciationProfileId: z.enum([
    'value_flattened_durable', 'normal_midlife', 'still_depreciating', 'branded_title_discounted',
  ]).optional(),
  overrides: vehicleOverridesSchema,
});

export const vehicleRowSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  listing: vehicleListingSchema,
  canonical: canonicalVehicleSchema,
  user: vehicleUserDataSchema,
  fieldMeta: z.record(z.string(), fieldMetaSchema),
  historyReport: historyReportSchema.optional(),
});

export const globalAssumptionsSchema = z.object({
  id: z.string(),
  annualMiles: z.number().min(0),
  gasPrice: z.number().min(0),
  salesTaxRate: z.number().min(0).max(0.20),
  ownershipYears: z.number().min(1).max(30),
  usagePattern: z.enum(['mostly_highway', 'mixed', 'city_heavy', 'aggressive_short_trips']),
  defaultCondition: z.enum(['excellent', 'average', 'mild_mods', 'poor']),
  optimismLevel: z.enum(['optimistic', 'neutral', 'conservative']),
  insuranceCoverageDefault: z.enum(['liability_only', 'full_coverage']),
  driverAgeRange: z.enum(['under_25', '25_39', '40_65', 'over_65']),
  drivingRecord: z.enum(['clean', 'minor', 'major']),
  annualRegistrationFees: z.number().min(0),
  monthlyParkingAndTolls: z.number().min(0),
  includeMajorRepairReserveInFirstYear: z.boolean(),
  includeMajorRepairReserveInTotalCost: z.boolean(),
});

export type ValidatedVehicleRow = z.infer<typeof vehicleRowSchema>;
export type ValidatedGlobalAssumptions = z.infer<typeof globalAssumptionsSchema>;
