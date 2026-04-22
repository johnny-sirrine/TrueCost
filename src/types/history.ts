/**
 * Vehicle history screening types.
 *
 * Phase 1 scope: screening-level checks only (NHTSA recalls + vPIC decoder).
 * The `disclaimer` field is baked into `HistoryReport` to force the UI to
 * always explain what is NOT covered — so users cannot mistake "no flags
 * found" for "clean vehicle history". Title brands, accidents, odometer
 * rollback, and theft require paid providers and are deferred.
 */

/** Visual priority and sort order for a flag. `critical` = blocks purchase
 *  in most cases (e.g. active safety recall). `watch` = should investigate
 *  further. `info` = noted, not necessarily a concern. */
export type HistorySeverity = 'info' | 'watch' | 'critical';

/** Classification for filtering, grouping, and mapping to an icon. */
export type HistoryCategory =
  | 'open_recall'  // NHTSA safety recalls
  | 'title_brand'  // NMVTIS — reserved for future phase
  | 'salvage'      // NICB / NMVTIS — reserved for future phase
  | 'stolen'       // NICB — reserved for future phase
  | 'odometer'     // NMVTIS — reserved for future phase
  | 'user_note';   // manually added flag

/** Identifier for the data source that produced a flag. Using a closed
 *  union (not `string`) keeps the fieldMeta/provenance story consistent
 *  with the rest of the app. */
export type HistorySource =
  | 'nhtsa_recalls'
  | 'nhtsa_vpic'
  | 'user_override';

export interface HistoryFlag {
  /** Stable id for React list keys and user-override tracking. */
  id: string;
  source: HistorySource;
  severity: HistorySeverity;
  category: HistoryCategory;
  /** Short one-line summary shown in the flag list. */
  title: string;
  /** Long-form description; may be multi-sentence. */
  detail: string;
  /** Optional deep link (e.g. NHTSA recall lookup URL). */
  link?: string;
  /** Optional external identifier (e.g. NHTSA campaign number). */
  identifier?: string;
}

/** Completeness tier. Currently only `screening` exists; reserved slot for
 *  a future `full` tier that would cover NMVTIS / Carfax-equivalent data. */
export type HistoryCompleteness = 'screening';

export interface HistoryReport {
  flags: HistoryFlag[];
  /** Which providers were consulted for this report — lets the UI render
   *  "Checked: NHTSA recalls" without guessing. */
  sourcesChecked: HistorySource[];
  completeness: HistoryCompleteness;
  /** ISO-8601 timestamp of the most recent successful fetch. Used to
   *  gate re-fetch after the cache staleness window (7 days). */
  lastChecked: string;
  /** User-visible disclaimer enumerating what the screening tier does
   *  NOT cover. Stored on the report so the UI can never omit it. */
  disclaimer: string;
}

/** Standard disclaimer baked into every screening-tier report. Exported
 *  so producers (historyResolver) and consumers (HistorySection) agree
 *  on the exact wording.
 *
 *  Wording is deliberately tier-aware: distinguishes what we check
 *  in-app, what is free but only available via a manual click-through,
 *  and what genuinely requires a paid provider. This prevents the
 *  mistaken impression that theft/salvage signal is behind a paywall —
 *  it isn't; NICB is free, just CAPTCHA-gated from automated clients.
 */
export const SCREENING_DISCLAIMER =
  'Screening only. In-app checks cover NHTSA open safety recalls. ' +
  'For theft and insurer-reported salvage, use the free NICB VINCheck ' +
  "link below \u2014 we can't query it automatically. A paid NMVTIS " +
  'provider (Carfax, AutoCheck, VinAudit) is still the only way to get ' +
  'authoritative title-brand, odometer-rollback, and accident history.';
