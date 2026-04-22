import { useAssumptions } from '../../hooks/useAssumptions';
import { useUIStore } from '../../store/uiStore';
import { Settings2 } from 'lucide-react';
import { formatNumber } from '../../lib/formatters';

const USAGE_LABELS: Record<string, string> = {
  mostly_highway: 'highway',
  mixed: 'mixed',
  city_heavy: 'city',
  aggressive_short_trips: 'aggressive',
};

export function AssumptionsSummaryBar() {
  const assumptions = useAssumptions();
  const togglePanel = useUIStore((s) => s.toggleAssumptionsPanel);

  return (
    <button
      onClick={togglePanel}
      className="flex items-center gap-3 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100 w-full text-left transition-colors"
    >
      <Settings2 size={12} className="text-slate-400 shrink-0" />
      <span className="tabular-nums">
        {formatNumber(assumptions.annualMiles / 1000)}k mi/yr
      </span>
      <span className="text-slate-300">|</span>
      <span className="tabular-nums">${assumptions.gasPrice.toFixed(2)}/gal</span>
      <span className="text-slate-300">|</span>
      <span>{assumptions.ownershipYears}yr horizon</span>
      <span className="text-slate-300">|</span>
      <span className="tabular-nums">{(assumptions.salesTaxRate * 100).toFixed(1)}% tax</span>
      <span className="text-slate-300">|</span>
      <span>{USAGE_LABELS[assumptions.usagePattern] ?? assumptions.usagePattern} driving</span>
      <span className="text-slate-300">|</span>
      <span>{assumptions.optimismLevel}</span>
      <span className="text-slate-300">|</span>
      <span>{assumptions.insuranceCoverageDefault === 'full_coverage' ? 'full ins.' : 'liability ins.'}</span>
      <span className="ml-auto text-slate-400 text-[10px]">Click to edit</span>
    </button>
  );
}
