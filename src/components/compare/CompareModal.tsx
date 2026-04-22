import { Fragment, useEffect, useMemo } from 'react';
import { X, Car } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useComputedBoard } from '../../hooks/useComputedBoard';
import { formatCurrency, formatMiles, formatMpg } from '../../lib/formatters';
import { DEAL_QUALITY_COLORS } from '../../lib/constants';
import type { ComputedVehicle } from '../../hooks/useComputedBoard';

/**
 * Side-by-side comparison of pinned or current+pinned vehicles.
 * - If any vehicles are pinned, shows those (plus current car if present).
 * - Otherwise shows current car + up to 3 non-archived candidates.
 * Max 4 columns to stay readable.
 */
function pickComparisonSet(all: ComputedVehicle[]): ComputedVehicle[] {
  const active = all.filter((c) => !c.vehicle.user.archived);
  const current = active.filter((c) => c.vehicle.user.isCurrentCar);
  const pinned = active.filter((c) => c.vehicle.user.pinned && !c.vehicle.user.isCurrentCar);
  if (pinned.length > 0) {
    return [...current, ...pinned].slice(0, 4);
  }
  // Fall back: current + first few candidates sorted by totalCostAtHorizon
  const candidates = active
    .filter((c) => !c.vehicle.user.isCurrentCar)
    .sort((a, b) => a.computed.totalCostAtHorizon - b.computed.totalCostAtHorizon)
    .slice(0, current.length > 0 ? 3 : 4);
  return [...current, ...candidates];
}

type RowType = 'currency' | 'miles' | 'mpg' | 'text' | 'number';

interface MetricRow {
  label: string;
  type: RowType;
  value: (c: ComputedVehicle) => number | string | undefined;
  lowerIsBetter?: boolean;
  higherIsBetter?: boolean;
  section?: string;
}

const ROWS: MetricRow[] = [
  { section: 'Price & Miles', label: 'Listing price', type: 'currency', value: (c) => c.vehicle.user.isCurrentCar ? undefined : c.vehicle.user.listingPrice, lowerIsBetter: true },
  { label: 'Mileage', type: 'miles', value: (c) => c.vehicle.user.mileage },
  { label: 'Title status', type: 'text', value: (c) => c.vehicle.user.titleStatus },
  { label: 'Condition', type: 'text', value: (c) => c.vehicle.user.conditionLevel },

  { section: 'Fuel & MPG', label: 'EPA combined MPG', type: 'mpg', value: (c) => c.vehicle.canonical.epaCombinedMpg },
  { label: 'Realistic MPG', type: 'mpg', value: (c) => c.computed.realisticMpg, higherIsBetter: true },
  { label: 'Fuel / mo', type: 'currency', value: (c) => c.computed.fuelMonthly, lowerIsBetter: true },

  { section: 'Monthly cost', label: 'Insurance / mo', type: 'currency', value: (c) => c.computed.insuranceMonthly, lowerIsBetter: true },
  { label: 'Routine / mo', type: 'currency', value: (c) => c.computed.routineMonthly, lowerIsBetter: true },
  { label: 'Expected repairs / mo', type: 'currency', value: (c) => c.computed.expectedRepairsMonthly, lowerIsBetter: true },
  { label: 'Baseline / mo', type: 'currency', value: (c) => c.computed.baselineMonthly, lowerIsBetter: true },
  { label: 'All-in / mo', type: 'currency', value: (c) => c.computed.allInMonthly, lowerIsBetter: true },

  { section: 'Totals', label: 'First-year cost', type: 'currency', value: (c) => c.computed.firstYearCost, lowerIsBetter: true },
  { label: 'Resale loss', type: 'currency', value: (c) => c.computed.resaleLoss, lowerIsBetter: true },
  { label: 'Total cost at horizon', type: 'currency', value: (c) => c.computed.totalCostAtHorizon, lowerIsBetter: true },

  { section: 'Verdict', label: 'Deal quality', type: 'text', value: (c) => c.computed.dealQuality },
  { label: 'Confidence', type: 'text', value: (c) => c.computed.confidence },
];

function formatValue(type: RowType, v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '\u2014';
  if (typeof v === 'string') return v;
  if (type === 'currency') return formatCurrency(v);
  if (type === 'miles') return formatMiles(v);
  if (type === 'mpg') return formatMpg(v);
  return String(v);
}

function bestIndexForRow(row: MetricRow, set: ComputedVehicle[]): number | null {
  if (!row.lowerIsBetter && !row.higherIsBetter) return null;
  const vals = set.map((c) => row.value(c));
  const numeric: { i: number; n: number }[] = [];
  vals.forEach((v, i) => {
    if (typeof v === 'number' && !isNaN(v)) numeric.push({ i, n: v });
  });
  if (numeric.length === 0) return null;
  if (row.lowerIsBetter) {
    return numeric.reduce((best, cur) => cur.n < best.n ? cur : best).i;
  }
  return numeric.reduce((best, cur) => cur.n > best.n ? cur : best).i;
}

export function CompareModal() {
  const isOpen = useUIStore((s) => s.isCompareModalOpen);
  const closeCompareModal = useUIStore((s) => s.closeCompareModal);
  const openDetailDrawer = useUIStore((s) => s.openDetailDrawer);
  const all = useComputedBoard();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCompareModal();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeCompareModal]);

  const set = useMemo(() => pickComparisonSet(all), [all]);

  if (!isOpen) return null;

  const pinnedCount = all.filter((c) => c.vehicle.user.pinned && !c.vehicle.user.archived).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={closeCompareModal} />
      <div
        className="fixed inset-4 md:inset-8 bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id="compare-modal-title" className="text-lg font-semibold text-slate-900">Compare Vehicles</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {pinnedCount > 0
                ? `Showing ${set.length} vehicles (current car + ${pinnedCount} pinned)`
                : `Showing ${set.length} vehicles (pin vehicles on the board to choose what's compared)`}
            </p>
          </div>
          <button
            onClick={closeCompareModal}
            className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
            aria-label="Close compare view"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {set.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            No vehicles to compare. Add some listings to the board first.
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider w-48 bg-white">
                    Metric
                  </th>
                  {set.map(({ vehicle }) => (
                    <th
                      key={vehicle.id}
                      className={`text-left py-3 px-4 bg-white ${vehicle.user.isCurrentCar ? 'bg-emerald-50/50' : ''}`}
                    >
                      <button
                        onClick={() => {
                          openDetailDrawer(vehicle.id);
                          closeCompareModal();
                        }}
                        className="flex flex-col items-start gap-0.5 hover:text-blue-600 cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase">
                          {vehicle.user.isCurrentCar && <Car size={11} className="text-emerald-500" />}
                          {vehicle.user.isCurrentCar ? 'Current car' : vehicle.user.pinned ? 'Pinned' : 'Candidate'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {vehicle.canonical.year} {vehicle.canonical.make} {vehicle.canonical.model}
                        </span>
                        {vehicle.canonical.trim && (
                          <span className="text-xs text-slate-500 font-normal">{vehicle.canonical.trim}</span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, idx) => {
                  const bestIdx = bestIndexForRow(row, set);
                  return (
                    <Fragment key={idx}>
                      {row.section && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={set.length + 1} className="pt-3 pb-1 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {row.section}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-4 text-slate-600">{row.label}</td>
                        {set.map((c, i) => {
                          const val = row.value(c);
                          const isBest = bestIdx === i && set.length > 1;
                          const formatted = formatValue(row.type, val);
                          let cellClass = 'py-2 px-4 tabular-nums';
                          if (c.vehicle.user.isCurrentCar) cellClass += ' bg-emerald-50/30';
                          if (isBest) cellClass += ' font-semibold text-emerald-700';
                          if (row.label === 'Deal quality' && typeof val === 'string') {
                            return (
                              <td key={c.vehicle.id} className={cellClass}>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DEAL_QUALITY_COLORS[val as keyof typeof DEAL_QUALITY_COLORS] ?? ''}`}>
                                  {val}
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={c.vehicle.id} className={cellClass}>
                              {formatted}
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
              Best value for each metric is shown in <span className="text-emerald-700 font-semibold">green</span>. Click a vehicle header to open details.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
