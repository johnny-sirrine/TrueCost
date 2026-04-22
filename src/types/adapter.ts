import type { VehicleListing, CanonicalVehicle, FieldMeta } from './vehicle';

export interface ParseResult {
  listing: Partial<VehicleListing>;
  canonical: Partial<CanonicalVehicle>;
  suggestedPrice?: number;
  suggestedMileage?: number;
  suggestedTitleStatus?: string;
  fieldMeta: Record<string, FieldMeta>;
  warnings: string[];
}

export interface ListingAdapter {
  id: string;
  name: string;
  // Returns true if this adapter can attempt to handle the input
  canHandle: (input: string) => boolean;
  // Parse input into structured fields. Always best-effort, never trusted.
  parse: (input: string) => Promise<ParseResult>;
}
