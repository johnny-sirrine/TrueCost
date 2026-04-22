import { AlertTriangle } from 'lucide-react';
import type { ResolvedVehicle, ScoredCandidate } from '../../services/vehicleResolver';

interface DerivedInfoPreviewProps {
  status: 'idle' | 'loading' | 'resolved' | 'ambiguous' | 'no_data';
  data: ResolvedVehicle | null;
  candidates?: ScoredCandidate[];
  selectedIndex: number | null;
  onSelectCandidate?: (index: number) => void;
  isStaticFallback: boolean;
}

/** Pick the shortest human-readable prompt based on which field actually
 *  varies across the ambiguous candidates. When everything but trim is the
 *  same, ask for trim; when drivetrain is the only varying field, ask for
 *  drivetrain; etc. Keeps the user focused on the meaningful choice. */
function describeAmbiguity(candidates: ScoredCandidate[]): string {
  if (candidates.length < 2) return 'Multiple configurations found — select one:';

  const first = candidates[0].mapped;
  const allSame = (key: keyof ResolvedVehicle) =>
    candidates.every((c) => c.mapped[key] === first[key]);

  const drivetrainSame = allSame('drivetrain');
  const transSame = allSame('transmissionType');
  const cylSame = allSame('cylinders');
  const engineSame = allSame('engineType');
  const mpgSpread = Math.max(...candidates.map((c) => c.mapped.combinedMpg)) -
                    Math.min(...candidates.map((c) => c.mapped.combinedMpg));

  const varying: string[] = [];
  if (!drivetrainSame) varying.push('drivetrain');
  if (!transSame) varying.push('transmission');
  if (!cylSame) varying.push('engine size');
  if (!engineSame) varying.push('fuel type');
  if (drivetrainSame && transSame && cylSame && engineSame && mpgSpread > 0) {
    varying.push('trim');
  }

  if (varying.length === 0) return 'Multiple configurations found \u2014 select one:';
  if (varying.length === 1) return `Multiple ${varying[0]} options \u2014 select one:`;
  return `Candidates differ by ${varying.join(', ')} \u2014 select one:`;
}

export function DerivedInfoPreview({ status, data, candidates, selectedIndex, onSelectCandidate, isStaticFallback }: DerivedInfoPreviewProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 -mt-1 py-1">
        <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        Looking up EPA data...
      </div>
    );
  }

  if (status === 'no_data') {
    return (
      <div className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2 -mt-1">
        No reference data found — the engine will use generic estimates. You can refine in the detail view later.
      </div>
    );
  }

  if (status === 'ambiguous' && candidates && candidates.length > 0) {
    const active = selectedIndex !== null ? candidates[selectedIndex]?.mapped : null;
    const prompt = describeAmbiguity(candidates);
    return (
      <div className="space-y-1.5 -mt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-600">{prompt}</span>
        </div>
        <select
          className="w-full text-xs border border-amber-200 bg-amber-50/50 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
          value={selectedIndex ?? ''}
          onChange={(e) => onSelectCandidate?.(Number(e.target.value))}
        >
          <option value="" disabled>Choose a configuration...</option>
          {candidates.map((c, i) => {
            const parts: string[] = [];
            if (c.mapped.drivetrain) parts.push(c.mapped.drivetrain.toUpperCase());
            parts.push(`${c.mapped.combinedMpg} mpg`);
            if (c.mapped.cylinders) parts.push(`${c.mapped.cylinders} cyl`);
            if (c.mapped.transmissionType) parts.push(c.mapped.transmissionType);
            return (
              <option key={i} value={i}>
                {c.config.option || parts.join(', ')} — {parts.join(', ')}
              </option>
            );
          })}
        </select>
        {active && <Chips data={active} isStaticFallback={false} />}
      </div>
    );
  }

  // Resolved state
  if (status === 'resolved' && isStaticFallback) {
    return (
      <div className="space-y-1.5 -mt-1">
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <AlertTriangle size={13} className="shrink-0" />
          <span>No EPA match found — using limited heuristic data. You can refine in the detail view.</span>
        </div>
        {data && <Chips data={data} isStaticFallback />}
      </div>
    );
  }

  if (status === 'resolved' && data) {
    return <Chips data={data} isStaticFallback={false} />;
  }

  return null;
}

function Chips({ data, isStaticFallback }: { data: ResolvedVehicle; isStaticFallback: boolean }) {
  const chips: { label: string; value: string }[] = [];
  if (data.vehicleClass) chips.push({ label: 'Class', value: data.vehicleClass.replace(/_/g, ' ') });
  if (data.bodyStyle) chips.push({ label: 'Body', value: data.bodyStyle });
  if (data.drivetrain) chips.push({ label: 'Drive', value: data.drivetrain.toUpperCase() });
  if (data.combinedMpg) chips.push({ label: 'EPA', value: `${data.combinedMpg} mpg` });
  if (data.cylinders) chips.push({ label: 'Cyl', value: String(data.cylinders) });
  if (data.engineType && data.engineType !== 'gas') chips.push({ label: 'Engine', value: data.engineType });
  if (data.transmissionType) chips.push({ label: 'Trans', value: data.transmissionType });

  if (chips.length === 0) return null;

  const chipColor = isStaticFallback
    ? 'bg-amber-50 text-amber-700'
    : 'bg-teal-50 text-teal-700';
  const labelColor = isStaticFallback ? 'text-amber-400' : 'text-teal-400';

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs -mt-1">
      <span className="text-slate-400">{isStaticFallback ? 'Heuristic:' : 'Auto-detected:'}</span>
      {chips.map((c) => (
        <span key={c.label} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${chipColor}`}>
          <span className={labelColor}>{c.label}</span> {c.value}
        </span>
      ))}
    </div>
  );
}
