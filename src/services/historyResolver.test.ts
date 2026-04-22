import { describe, it, expect } from 'vitest';
import { resolveHistory, isReportStale, HISTORY_CACHE_MAX_AGE_MS } from './historyResolver';
import type { HistoryReport } from '../types';

function makeRecallsResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('isReportStale', () => {
  it('returns true when no report exists', () => {
    expect(isReportStale(undefined)).toBe(true);
  });

  it('returns false for a report fetched within the cache window', () => {
    const fresh: HistoryReport = {
      flags: [],
      sourcesChecked: ['nhtsa_recalls'],
      completeness: 'screening',
      lastChecked: new Date().toISOString(),
      disclaimer: 'x',
    };
    expect(isReportStale(fresh)).toBe(false);
  });

  it('returns true for a report older than the cache window', () => {
    const stale: HistoryReport = {
      flags: [],
      sourcesChecked: ['nhtsa_recalls'],
      completeness: 'screening',
      lastChecked: new Date(Date.now() - HISTORY_CACHE_MAX_AGE_MS - 1000).toISOString(),
      disclaimer: 'x',
    };
    expect(isReportStale(stale)).toBe(true);
  });

  it('treats unparseable timestamps as stale (defensive)', () => {
    const bad: HistoryReport = {
      flags: [],
      sourcesChecked: ['nhtsa_recalls'],
      completeness: 'screening',
      lastChecked: 'not-a-date',
      disclaimer: 'x',
    };
    expect(isReportStale(bad)).toBe(true);
  });
});

describe('resolveHistory', () => {
  it('composes a report from NHTSA recalls output with the mandatory disclaimer', async () => {
    const fetchImpl = () =>
      Promise.resolve(
        makeRecallsResponse({
          results: [
            {
              NHTSACampaignNumber: '23V001000',
              Component: 'FUEL SYSTEM, GASOLINE',
              Summary: 'Fuel pump may fail.',
              Consequence: 'Engine stall could cause a crash.',
            },
          ],
        }),
      );

    const now = new Date('2026-04-16T00:00:00Z');
    const { report, errors } = await resolveHistory(
      { year: 2014, make: 'Chevrolet', model: 'Captiva' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now },
    );

    expect(errors).toEqual([]);
    expect(report.sourcesChecked).toContain('nhtsa_recalls');
    expect(report.flags).toHaveLength(1);
    expect(report.completeness).toBe('screening');
    expect(report.lastChecked).toBe(now.toISOString());
    expect(report.disclaimer).toMatch(/Screening only/);
    // Disclaimer must explicitly name NICB (free, manual) and NMVTIS/Carfax
    // (paid, comprehensive) so users understand the tiering and can't
    // mistake silence on theft/salvage for "clean".
    expect(report.disclaimer).toMatch(/NICB/);
    expect(report.disclaimer).toMatch(/NMVTIS|Carfax/);
    expect(report.disclaimer).toMatch(/title-brand/);
  });

  it('records per-provider errors without failing the overall resolve', async () => {
    const fetchImpl = () =>
      Promise.resolve(new Response('', { status: 503 }));

    const { report, errors } = await resolveHistory(
      { year: 2020, make: 'Honda', model: 'CR-V' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('nhtsa_recalls');
    expect(report.sourcesChecked).toEqual([]);
    expect(report.flags).toEqual([]);
    // Disclaimer is still attached even when every provider failed.
    expect(report.disclaimer).toMatch(/Screening only/);
  });

  it('sorts flags by severity (critical > watch > info) then by title', async () => {
    const fetchImpl = () =>
      Promise.resolve(
        makeRecallsResponse({
          results: [
            {
              NHTSACampaignNumber: 'A',
              Component: 'Alpha',
              Summary: 'A',
              Consequence: 'Minor inconvenience.',  // watch
            },
            {
              NHTSACampaignNumber: 'B',
              Component: 'Bravo',
              Summary: 'B',
              Consequence: 'Crash risk.',  // critical
            },
            {
              NHTSACampaignNumber: 'C',
              Component: 'Charlie',
              Summary: 'C',
              // no consequence -> info
            },
          ],
        }),
      );

    const { report } = await resolveHistory(
      { year: 2018, make: 'Honda', model: 'Accord' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(report.flags.map((f) => f.severity)).toEqual(['critical', 'watch', 'info']);
    expect(report.flags.map((f) => f.title)).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });
});
