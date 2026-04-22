/**
 * Hook for loading and refreshing a vehicle's screening-tier history
 * report. Mirrors the shape of useVehicleLookup: exposes a status enum,
 * the resolved report, and an imperative refresh() action.
 *
 * Opt-in by design: this hook does NOT auto-fetch on mount. It only
 * dispatches a fetch when `refresh()` is called, or when the caller
 * explicitly asks for a check via the returned trigger. This matches
 * the plan's privacy posture — no surprise network traffic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db';
import {
  resolveHistory,
  isReportStale,
  type ResolveHistoryInput,
} from '../services/historyResolver';
import type { HistoryReport, HistorySource } from '../types';

export interface UseHistoryReportState {
  status: 'idle' | 'loading' | 'success' | 'error';
  report: HistoryReport | undefined;
  errors: Array<{ source: HistorySource; message: string }>;
  /** True if the cached report is older than the staleness window
   *  (or missing entirely). UI can surface "refresh recommended". */
  isStale: boolean;
  /** Trigger a fresh fetch and persist the result. */
  refresh: () => Promise<void>;
}

export interface UseHistoryReportOptions {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export function useHistoryReport(
  vehicleId: string | undefined,
  cached: HistoryReport | undefined,
  vehicleInput: ResolveHistoryInput | undefined,
  options: UseHistoryReportOptions = {},
): UseHistoryReportState {
  const [report, setReport] = useState<HistoryReport | undefined>(cached);
  const [status, setStatus] = useState<UseHistoryReportState['status']>(
    cached ? 'success' : 'idle',
  );
  const [errors, setErrors] = useState<UseHistoryReportState['errors']>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Keep local state in sync if the cached prop updates (e.g. Dexie
  // reactive query emits a new value after another component refreshed).
  useEffect(() => {
    setReport(cached);
    if (cached) setStatus('success');
  }, [cached]);

  // Cancel any inflight fetch on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!vehicleId || !vehicleInput) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setErrors([]);

    const { report: fresh, errors: providerErrors } = await resolveHistory(
      vehicleInput,
      { fetchImpl: options.fetchImpl, signal: controller.signal },
    );

    if (controller.signal.aborted) return;

    setReport(fresh);
    setErrors(providerErrors);
    // If every provider failed, we surface error state even though the
    // report object itself (with empty flags + disclaimer) is populated.
    // That way the UI can show "Couldn't reach NHTSA" instead of a
    // misleading "0 flags found".
    const allFailed =
      providerErrors.length > 0 && fresh.sourcesChecked.length === 0;
    setStatus(allFailed ? 'error' : 'success');

    // Persist to Dexie so reopens show the cached result without a network
    // round-trip. We only persist when at least one provider succeeded;
    // a total-failure shouldn't overwrite a valid older report.
    if (!allFailed) {
      try {
        await db.vehicles.update(vehicleId, {
          historyReport: fresh,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Persistence failure is non-fatal; user still sees the report
        // in-memory for this session.
      }
    }
  }, [vehicleId, vehicleInput, options.fetchImpl]);

  return {
    status,
    report,
    errors,
    isStale: isReportStale(report),
    refresh,
  };
}
