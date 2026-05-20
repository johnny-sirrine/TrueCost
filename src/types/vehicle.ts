// === Enums / Literal Types ===

export type ListingSource = 'ksl' | 'facebook' | 'carscom' | 'craigslist' | 'dealer' | 'manual' | 'raw_text';

export type BodyStyle = 'sedan' | 'suv' | 'truck' | 'van' | 'coupe' | 'hatchback' | 'wagon' | 'crossover';

export type Drivetrain = 'fwd' | 'rwd' | 'awd' | '4wd';

export type EngineType = 'gas' | 'diesel' | 'hybrid' | 'phev' | 'ev';

export type TransmissionType = 'automatic' | 'manual' | 'cvt';

export type TitleStatus = 'clean' | 'salvage' | 'rebuilt' | 'lemon' | 'unknown';

export type ConditionLevel = 'excellent' | 'average' | 'mild_mods' | 'poor';

export type ModificationLevel = 'stock' | 'low' | 'medium' | 'high';

export type SellerType = 'dealer' | 'private' | 'unknown';

// Vehicle class for MPG factor lookup and maintenance estimation
export type VehicleClass =
  | 'compact_car'
  | 'midsize_car'
  | 'fullsize_car'
  | 'compact_crossover'
  | 'midsize_crossover'
  | 'fullsize_suv'
  | 'body_on_frame_suv'
  | 'compact_truck'
  | 'fullsize_truck'
  | 'van';

export type DepreciationProfileId =
  | 'value_flattened_durable'
  | 'normal_midlife'
  | 'still_depreciating'
  | 'branded_title_discounted';

// === Field Provenance ===

export type FieldOrigin = 'extracted' | 'external_lookup' | 'inferred' | 'assumed' | 'overridden';
export type Confidence = 'high' | 'medium' | 'low';

export interface FieldMeta {
  origin: FieldOrigin;
  confidence: Confidence;
  originalValue?: string | number;
  note?: string;
}

// === Strongly Typed Overrides ===

export interface VehicleOverrides {
  realisticMpg?: number;
  routineMonthly?: number;
  expectedRepairsMonthly?: number;
  majorRepairReserveMonthly?: number;
  currentMarketValue?: number;
  annualMiles?: number;
  insuranceCoverageMode?: import('./assumptions').InsuranceCoverageMode;
  insuranceMonthly?: number;
}

// === Vehicle Row (persisted) ===

export interface VehicleListing {
  source: ListingSource;
  sourceUrl?: string;
  rawTitle?: string;
  rawDescription?: string;
  rawPrice?: number;
  rawMileage?: number;
  sellerType?: SellerType;
  location?: string;
  titleStatusRaw?: string;
  /** Optional 17-character VIN. Used to query NHTSA vPIC (decoder) and
   *  NHTSA Recalls (VIN-specific campaigns). Stored here rather than in
   *  canonical because it's a listing-level fact that the EPA resolver
   *  should not depend on. */
  vin?: string;
}

export interface CanonicalVehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  bodyStyle?: BodyStyle;
  drivetrain?: Drivetrain;
  engineType?: EngineType;
  cylinders?: number;
  transmissionType?: TransmissionType;
  vehicleClass?: VehicleClass;
  epaCombinedMpg?: number;
}

export interface VehicleUserData {
  listingPrice: number;
  mileage: number;
  titleStatus: TitleStatus;
  conditionLevel: ConditionLevel;
  modificationLevel: ModificationLevel;
  catchUpCost: number;
  feesCost: number;
  notes: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  isCurrentCar: boolean;
  userRating?: number; // 1–5 stars, user-assigned
  depreciationProfileId?: DepreciationProfileId;
  overrides: VehicleOverrides;
}

export interface VehicleRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  listing: VehicleListing;
  canonical: CanonicalVehicle;
  user: VehicleUserData;
  fieldMeta: Record<string, FieldMeta>;
  /** Cached screening-tier history report (NHTSA recalls etc.). Absent
   *  until the user explicitly fetches it. Refreshed on demand or when
   *  older than the resolver's staleness window. */
  historyReport?: import('./history').HistoryReport;
}
