/**
 * History resolver — orchestrates screening-tier history providers.
 *
 * Responsibilities:
 *  - Run enabled providers in parallel.
 *  - Merge per-provider flag lists (dedupe by id, sort by severity).
 *  - Stamp `lastChecked`, `sourcesChecked`, and the required disclaimer.
 *  - Surface per-provider errors without failing the whole report.
 *
 * Kept deliberately small: provider-specific logic lives in each
 * `historyProviders/*.ts` file; this module only composes them.
 */

import type { HistoryFlag, HistoryReport, HistorySource } from '../types';
import { SCREENING_DISCLAIMER } from '../types';
import { fetchRecalls, type FetchRecallsOptions } from './historyProviders/nhtsaRecalls';

/** 7 days, in milliseconds. The useHistoryReport hook consults this to
 *  decide whether a cached report should be auto-refreshed. */
export const HISTORY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Severity ordering for stable sorts. Higher = more urgent. */
const SEVERITY_RANK: Record<HistoryFlag['severity'], number> = {
  critical: 3,
  watch: 2,
  info: 1,
};

export interface ResolveHistoryInput {
  year: number;
  make: string;
  model: string;
  /** Reserved for future VIN-specific providers. Unused in Phase 1. */
  vin?: string;
}

export interface ResolveHistoryResult {
  report: HistoryReport;
  /** Non-fatal per-provider errors; empty when all providers succeeded. */
  errors: Array<{ source: HistorySource; message: string }>;
}

export interface ResolveHistoryOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Override current time for deterministic tests. */
  now?: () => Date;
}

/**
 * Is the given cached report stale enough to justify a refetch?
 * Returns true if the report is missing or older than the cache window.
 */
export function isReportStale(
  report: HistoryReport | undefined,
  now: Date = new Date(),
  maxAgeMs: number = HISTORY_CACHE_MAX_AGE_MS,
): boolean {
  if (!report) return true;
  const last = Date.parse(report.lastChecked);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last > maxAgeMs;
}

/** Deduplicate flags by id (stable: keeps the first occurrence) and
 *  sort by severity descending, then title ascending. */
function dedupeAndSort(flags: HistoryFlag[]): HistoryFlag[] {
  const seen = new Set<string>();
  const out: HistoryFlag[] = [];
  for (const f of flags) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  out.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });
  return out;
}

/**
 * Resolve a screening-tier history report for the given vehicle. Runs
 * all enabled providers in parallel, aggregates their flags, and stamps
 * the disclaimer + lastChecked. A provider failure is reported in
 * `errors` but does not prevent returning the report.
 */
export async function resolveHistory(
  input: ResolveHistoryInput,
  options: ResolveHistoryOptions = {},
): Promise<ResolveHistoryResult> {
  const now = (options.now ?? (() => new Date()))();
  const errors: Array<{ source: HistorySource; message: string }> = [];
  const sourcesChecked: HistorySource[] = [];
  const allFlags: HistoryFlag[] = [];

  const providerOptions: FetchRecallsOptions = {
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  };

  // Provider: NHTSA Recalls. Add more providers here in later phases
  // (each should contribute to `sourcesChecked` on success and to
  // `errors` on failure).
  try {
    const flags = await fetchRecalls(
      { year: input.year, make: input.make, model: input.model },
      providerOptions,
    );
    sourcesChecked.push('nhtsa_recalls');
    allFlags.push(...flags);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'NHTSA recalls request failed';
    errors.push({ source: 'nhtsa_recalls', message });
  }

  const report: HistoryReport = {
    flags: dedupeAndSort(allFlags),
    sourcesChecked,
    completeness: 'screening',
    lastChecked: now.toISOString(),
    disclaimer: SCREENING_DISCLAIMER,
  };

  return { report, errors };
}
