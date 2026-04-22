import { useEffect } from 'react';
import { X, DollarSign, TrendingDown, Fuel, Shield, Wrench } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useComputedBoard } from '../../hooks/useComputedBoard';
import { useAssumptions } from '../../hooks/useAssumptions';
import { formatCurrency } from '../../lib/formatters';

const REALIZATION_DISCOUNT = 0.08;

export function SellScenarioDrawer() {
  const { isSellScenarioDrawerOpen, closeSellScenarioDrawer } = useUIStore();
  const assumptions = useAssumptions();
  const computedBoard = useComputedBoard();

  // Find the current car
  const currentCar = computedBoard.find((r) => r.vehicle.user.isCurrentCar && !r.vehicle.user.archived);

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSellScenarioDrawer();
    }
    if (isSellScenarioDrawerOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isSellScenarioDrawerOpen, closeSellScenarioDrawer]);

  if (!isSellScenarioDrawerOpen || !currentCar) return null;

  const { vehicle, computed } = currentCar;
  const marketValue = computed.currentMarketValueEstimate;
  const realizationCost = Math.round(marketValue * REALIZATION_DISCOUNT);
  const netProceeds = Math.round(marketValue * (1 - REALIZATION_DISCOUNT));

  // Costs eliminated by selling
  const monthlyEliminated = computed.allInMonthly;
  const annualEliminated = monthlyEliminated * 12;
  const horizonEliminated = monthlyEliminated * 12 * assumptions.ownershipYears;

  // Depreciation avoided
  const depreciationAvoided = computed.resaleLoss;

  // Net financial impact: proceeds + costs avoided + depreciation avoided
  const totalFinancialImpact = netProceeds + horizonEliminated + depreciationAvoided;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closeSellScenarioDrawer}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[520px] max-w-full bg-white shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-scenario-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="sell-scenario-title" className="text-lg font-semibold text-slate-900">Sell Scenario</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              What if you sell your {vehicle.canonical.year} {vehicle.canonical.make} {vehicle.canonical.model}?
            </p>
          </div>
          <button onClick={closeSellScenarioDrawer} className="p-1.5 hover:bg-slate-100 rounded" aria-label="Close sell scenario panel">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
            <StatCard
              label="Net Proceeds"
              value={`+${formatCurrency(netProceeds)}`}
              color="emerald"
            />
            <StatCard
              label="Monthly Savings"
              value={`${formatCurrency(monthlyEliminated)}`}
              color="emerald"
            />
            <StatCard
              label="Depr. Avoided"
              value={`${formatCurrency(depreciationAvoided)}`}
              color="emerald"
            />
          </div>

          {/* Sale Proceeds */}
          <Section title="Sale Proceeds" icon={<DollarSign size={14} />}>
            <div className="text-sm space-y-1.5">
              <Line label="Estimated market value" value={formatCurrency(marketValue)} />
              <Line
                label={`Realization discount (${(REALIZATION_DISCOUNT * 100).toFixed(0)}%)`}
                value={`-${formatCurrency(realizationCost)}`}
                muted
              />
              <div className="text-xs text-slate-400 pl-3 -mt-0.5">
                Selling costs, negotiation, listing fees, inspection
              </div>
              <div className="flex justify-between font-semibold text-slate-900 pt-1.5 border-t border-slate-200 mt-2">
                <span>Net cash proceeds</span>
                <span className="tabular-nums text-emerald-600">+{formatCurrency(netProceeds)}</span>
              </div>
            </div>
          </Section>

          {/* Operating Costs Eliminated */}
          <Section title="Operating Costs Eliminated" icon={<Fuel size={14} />}>
            <div className="text-sm space-y-1.5">
              <div className="text-xs text-slate-400 mb-2">
                Monthly costs you stop paying when the car is sold.
              </div>
              <Line label="Fuel" value={formatCurrency(computed.fuelMonthly)} />
              <Line label="Routine maintenance" value={formatCurrency(computed.routineMonthly)} />
              <Line label="Expected repairs" value={formatCurrency(computed.expectedRepairsMonthly)} />
              <Line label="Insurance" value={formatCurrency(computed.insuranceMonthly)} />
              <Line label="Major repair reserve" value={formatCurrency(computed.majorRepairReserveMonthly)} italic />
              {computed.registrationMonthly > 0 && (
                <Line label="Registration & fees" value={formatCurrency(computed.registrationMonthly)} />
              )}
              <div className="flex justify-between font-semibold text-slate-900 pt-1.5 border-t border-slate-200 mt-2">
                <span>Total monthly savings</span>
                <span className="tabular-nums">{formatCurrency(monthlyEliminated)}/mo</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Annual savings</span>
                <span className="tabular-nums">{formatCurrency(annualEliminated)}/yr</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{assumptions.ownershipYears}-year savings</span>
                <span className="tabular-nums">{formatCurrency(horizonEliminated)}</span>
              </div>
            </div>
          </Section>

          {/* Depreciation Avoided */}
          <Section title="Depreciation Avoided" icon={<TrendingDown size={14} />}>
            <div className="text-sm space-y-1.5">
              <div className="text-xs text-slate-400 mb-2">
                Value your car would lose if you kept it for the full {assumptions.ownershipYears}-year horizon.
              </div>
              <Line label="Current market value" value={formatCurrency(marketValue)} />
              <Line label={`Projected value in ${assumptions.ownershipYears}yr`} value={formatCurrency(computed.futureResaleValueEstimate)} />
              <div className="flex justify-between font-medium text-slate-900 pt-1.5 border-t border-slate-200 mt-2">
                <span>Depreciation avoided</span>
                <span className="tabular-nums">{formatCurrency(depreciationAvoided)}</span>
              </div>
            </div>
          </Section>

          {/* Net Financial Impact */}
          <Section title="Net Financial Impact">
            <div className="text-sm space-y-1.5">
              <div className="text-xs text-slate-400 mb-2">
                Total financial benefit of selling vs. keeping over the {assumptions.ownershipYears}-year horizon.
              </div>
              <Line label="Net cash proceeds" value={`+${formatCurrency(netProceeds)}`} bold />
              <Line label={`Operating costs avoided (${assumptions.ownershipYears}yr)`} value={`+${formatCurrency(horizonEliminated)}`} bold />
              <Line label="Depreciation avoided" value={`+${formatCurrency(depreciationAvoided)}`} bold />
              <div className="flex justify-between font-bold text-lg text-emerald-700 pt-2 border-t-2 border-emerald-200 mt-3">
                <span>Total impact</span>
                <span className="tabular-nums">+{formatCurrency(totalFinancialImpact)}</span>
              </div>
              <div className="mt-3 p-3 bg-amber-50 rounded-md text-xs text-amber-700 leading-relaxed">
                This total represents the financial benefit of selling. It does not account for the cost of replacement transportation.
                Compare with candidate vehicles to see the net difference.
              </div>
            </div>
          </Section>

          {/* Assumptions Used */}
          <Section title="Assumptions" collapsible>
            <div className="text-sm space-y-1">
              <Line label="Ownership horizon" value={`${assumptions.ownershipYears} years`} muted />
              <Line label="Annual miles" value={`${(assumptions.annualMiles / 1000).toFixed(0)}k`} muted />
              <Line label="Gas price" value={`$${assumptions.gasPrice.toFixed(2)}/gal`} muted />
              <Line label="Realization discount" value={`${(REALIZATION_DISCOUNT * 100).toFixed(0)}%`} muted />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, icon, children, collapsible }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="p-4 border-b border-slate-100 group">
        <summary className="text-sm font-semibold text-slate-800 cursor-pointer select-none list-none flex items-center gap-1.5">
          <span className="text-slate-400 group-open:rotate-90 transition-transform text-xs">&#9654;</span>
          {icon && <span className="text-slate-400">{icon}</span>}
          {title}
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    );
  }
  return (
    <div className="p-4 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'emerald' | 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-50 text-slate-700',
  };
  return (
    <div className={`p-2 rounded ${colors[color]}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Line({ label, value, muted, italic, bold }: {
  label: string;
  value: string;
  muted?: boolean;
  italic?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${muted ? 'text-slate-400' : 'text-slate-600'} ${italic ? 'italic' : ''} ${bold ? 'font-medium' : ''}`}>
        {label}
      </span>
      <span className={`tabular-nums ${muted ? 'text-slate-400' : 'text-slate-700'} ${italic ? 'italic text-slate-500' : ''} ${bold ? 'font-medium' : ''}`}>
        {value}
      </span>
    </div>
  );
}
