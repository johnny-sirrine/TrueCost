import type { ListingAdapter } from '../types';
import { kslAdapter } from './kslAdapter';
import { facebookAdapter } from './facebookAdapter';
import { carsComAdapter } from './carsComAdapter';
import { rawTextAdapter } from './rawTextAdapter';

// Adapter registry. Order matters: URL-specific adapters first, raw text as fallback.
const ADAPTERS: ListingAdapter[] = [
  kslAdapter,
  facebookAdapter,
  carsComAdapter,
  rawTextAdapter, // fallback for any non-URL input
];

export function resolveAdapter(input: string): ListingAdapter | null {
  return ADAPTERS.find((a) => a.canHandle(input)) ?? null;
}

export function getAllAdapters(): ListingAdapter[] {
  return ADAPTERS;
}
