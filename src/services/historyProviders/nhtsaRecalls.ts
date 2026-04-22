/**
 * NHTSA recalls provider.
 *
 * Free, keyless, CORS-friendly. Returns open safety-recall campaigns for
 * a vehicle. This is intentionally scoped to *safety recalls* only —
 * TSBs, title brands, theft, and accident history are out of scope.
 *
 * Endpoint (year/make/model):
 *   https://api.nhtsa.gov/recalls/recallsByVehicle?make=X&model=Y&modelYear=Z
 *
 * vPIC-style VIN lookups for recalls exist but require a separate
 * endpoint and historically have had flaky coverage; we stick to the
 * year/make/model variant for Phase 1.
 */

import type { HistoryFlag } from '../../types';

const RECALLS_URL = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

interface NhtsaRecallResult {
  Manufacturer?: string;
  NHTSACampaignNumber?: string;
  ReportReceivedDate?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  Notes?: string;
  ModelYear?: string;
  Make?: string;
  Model?: string;
}

interface NhtsaRecallsResponse {
  Count?: number;
  Message?: string;
  results?: NhtsaRecallResult[];
}

export interface FetchRecallsOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface RecallsQuery {
  year: number;
  make: string;
  model: string;
}

/** Truncate long free-text fields to a readable preview. NHTSA summaries
 *  can run multiple paragraphs; the detail drawer truncates further via
 *  CSS, but a hard cap prevents storing unbounded strings in Dexie. */
function truncate(s: string, max = 500): string {
  const cleaned = s.trim().replace(/\s+/g, ' ');
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Assess severity from the Consequence field. An explicit mention of
 *  crash, fire, injury, or death escalates to `critical`. Anything with
 *  a `Consequence` string defaults to `watch`. No consequence = `info`. */
function assessSeverity(consequence: string | undefined): 'info' | 'watch' | 'critical' {
  if (!consequence) return 'info';
  const s = consequence.toLowerCase();
  if (/crash|fire|injur|death|fatal|serious/.test(s)) return 'critical';
  return 'watch';
}

/** Build a public NHTSA deep link for a campaign number. If no campaign
 *  number is present we fall back to the generic recalls search page. */
function buildRecallLink(campaign: string | undefined, year: number, make: string, model: string): string {
  if (campaign) {
    return `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(campaign)}`;
  }
  const params = new URLSearchParams({
    vehicleModelYear: String(year),
    vehicleMake: make,
    vehicleModel: model,
  });
  return `https://www.nhtsa.gov/recalls?${params.toString()}`;
}

function recallToFlag(r: NhtsaRecallResult, query: RecallsQuery): HistoryFlag {
  const campaign = r.NHTSACampaignNumber?.trim() || undefined;
  const component = r.Component?.trim() || 'Recall';
  const summary = r.Summary?.trim() || '';
  const consequence = r.Consequence?.trim() || '';
  const remedy = r.Remedy?.trim() || '';

  const detailParts: string[] = [];
  if (summary) detailParts.push(summary);
  if (consequence) detailParts.push(`Consequence: ${consequence}`);
  if (remedy) detailParts.push(`Remedy: ${remedy}`);

  return {
    id: campaign ? `nhtsa:${campaign}` : `nhtsa:${component}:${summary.slice(0, 32)}`,
    source: 'nhtsa_recalls',
    severity: assessSeverity(consequence),
    category: 'open_recall',
    title: component,
    detail: truncate(detailParts.join(' ')),
    link: buildRecallLink(campaign, query.year, query.make, query.model),
    identifier: campaign,
  };
}

/**
 * Fetch open recalls for a year/make/model. Returns an empty array if
 * nothing is found or the network call fails; the historyResolver is
 * responsible for turning errors into user-visible state.
 *
 * Throws on network errors so the hook can distinguish "no flags" from
 * "couldn't reach NHTSA".
 */
export async function fetchRecalls(
  query: RecallsQuery,
  options: FetchRecallsOptions = {},
): Promise<HistoryFlag[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    make: query.make,
    model: query.model,
    modelYear: String(query.year),
  });
  const url = `${RECALLS_URL}?${params.toString()}`;

  const response = await fetchImpl(url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(`NHTSA recalls returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as NhtsaRecallsResponse;
  const results = body.results ?? [];
  return results.map((r) => recallToFlag(r, query));
}
