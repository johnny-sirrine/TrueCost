/**
 * Thin React orchestrator for EPA vehicle resolution.
 * Calls the pure resolver, manages async state and debouncing.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveVehicle, type ResolveResult, type ResolvedVehicle, type ScoredCandidate, type ResolutionMethod, type UserHints } from '../services/vehicleResolver';
import { preloadEpaData } from '../services/epaProvider';
import type { Drivetrain, TransmissionType } from '../types';

export interface VehicleLookupState {
  status: 'idle' | 'loading' | 'resolved' | 'ambiguous' | 'no_data';
  data: ResolvedVehicle | null;
  candidates: ScoredCandidate[];
  selectedIndex: number | null;
  selectCandidate: (index: number) => void;
  isStaticFallback: boolean;
  resolutionMethod: ResolutionMethod | null;
  matchReason: string;
  /** The EPA option label of the selected/resolved config, for provenance tracing */
  epaOptionLabel: string | undefined;
}

const DEBOUNCE_MS = 300;

export function useVehicleLookup(
  year: number,
  make: string,
  model: string,
  hints?: { trim?: string; drivetrain?: Drivetrain; transmission?: TransmissionType; cylinders?: number },
): VehicleLookupState {
  const [status, setStatus] = useState<VehicleLookupState['status']>('idle');
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload EPA data on mount
  useEffect(() => {
    preloadEpaData();
  }, []);

  // Debounced resolve on input changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!make.trim() || !model.trim()) {
      setStatus('idle');
      setResult(null);
      setSelectedIndex(null);
      return;
    }

    setStatus('loading');

    timerRef.current = setTimeout(async () => {
      const userHints: UserHints = {};
      if (hints?.trim) userHints.trim = hints.trim;
      if (hints?.drivetrain) userHints.drivetrain = hints.drivetrain;
      if (hints?.transmission) userHints.transmission = hints.transmission;
      if (hints?.cylinders) userHints.cylinders = hints.cylinders;

      const res = await resolveVehicle(year, make, model, userHints);
      setResult(res);
      setSelectedIndex(null);

      if (res.status === 'resolved') {
        setStatus(res.isStaticFallback ? 'resolved' : 'resolved');
      } else if (res.status === 'ambiguous') {
        setStatus('ambiguous');
      } else {
        setStatus('no_data');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [year, make, model, hints?.trim, hints?.drivetrain, hints?.transmission, hints?.cylinders]);

  const selectCandidate = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Derive current data from result + selection
  let data: ResolvedVehicle | null = null;
  let epaOptionLabel: string | undefined;
  let resolutionMethod: ResolutionMethod | null = result?.resolutionMethod ?? null;

  if (result) {
    if (selectedIndex !== null && result.candidates[selectedIndex]) {
      data = result.candidates[selectedIndex].mapped;
      epaOptionLabel = result.candidates[selectedIndex].config.option;
      resolutionMethod = 'manual_candidate_selection';
    } else if (result.best) {
      data = result.best;
      // Find the matching candidate to get option label
      const bestCandidate = result.candidates.find((c) => c.mapped === result.best);
      epaOptionLabel = bestCandidate?.config.option;
    }
  }

  return {
    status,
    data,
    candidates: result?.candidates ?? [],
    selectedIndex,
    selectCandidate,
    isStaticFallback: result?.isStaticFallback ?? false,
    resolutionMethod,
    matchReason: result?.matchReason ?? '',
    epaOptionLabel,
  };
}
