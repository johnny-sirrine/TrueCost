import { useState } from 'react';
import { Car } from 'lucide-react';
import { BoardTable } from './BoardTable';
import { BoardToolbar } from './BoardToolbar';
import { useComputedBoard } from '../../hooks/useComputedBoard';
import { useUIStore } from '../../store/uiStore';
import type { VisibilityState } from '@tanstack/react-table';

// Default visibility:
//   - Summary columns (All-In/mo, 1st Year Cost, 5-Year Cost) are shown;
//     their component children (Ins./mo, Baseline/mo, Tax, Resale Loss)
//     are hidden and revealed via the per-family chevron in the header.
//   - The historical power-user columns below the main set (fuel breakdown,
//     resale estimate, confidence) stay hidden — accessed via the Columns
//     dropdown only.
const DEFAULT_VISIBILITY: VisibilityState = {
  // Family children — collapsed by default
  insurance: false,
  baseline: false,
  salesTax: false,
  resaleLoss: false,
  // Power-user extras
  fuel: false,
  routine: false,
  repairs: false,
  reserve: false,
  catchUp: false,
  resale: false,
  confidence: false,
};

export function BoardView() {
  const computedBoard = useComputedBoard();
  const openAddCurrentCarDialog = useUIStore((s) => s.openAddCurrentCarDialog);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);
  const [showSellScenario, setShowSellScenario] = useState(true);

  // Separate current car, active candidates, and archived
  const currentCars = computedBoard.filter((r) => r.vehicle.user.isCurrentCar && !r.vehicle.user.archived);
  const candidates = computedBoard.filter((r) => !r.vehicle.user.isCurrentCar && !r.vehicle.user.archived);
  const archivedRows = computedBoard.filter((r) => r.vehicle.user.archived);

  // Pinned first within candidates
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.vehicle.user.pinned && !b.vehicle.user.pinned) return -1;
    if (!a.vehicle.user.pinned && b.vehicle.user.pinned) return 1;
    return 0;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <BoardToolbar
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
      <div className="flex-1 overflow-auto">
        {/* CTA when no current car */}
        {currentCars.length === 0 && (
          <button
            onClick={openAddCurrentCarDialog}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-emerald-600 bg-emerald-50/50 border-b border-emerald-100 hover:bg-emerald-50 transition-colors cursor-pointer text-left"
          >
            <Car size={14} />
            <span>Add your current car to compare the cost of keeping it vs. buying</span>
          </button>
        )}

        {/* Single table: current car rows first, then candidates — columns align */}
        <BoardTable
          data={[...currentCars, ...sortedCandidates]}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          showSellScenario={showSellScenario}
          onToggleSellScenario={() => setShowSellScenario((p) => !p)}
        />

        {archivedRows.length > 0 && (
          <div className="px-4 py-3">
            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600">
                {archivedRows.length} archived {archivedRows.length === 1 ? 'vehicle' : 'vehicles'}
              </summary>
              <div className="mt-2">
                <BoardTable
                  data={archivedRows}
                  columnVisibility={columnVisibility}
                  onColumnVisibilityChange={setColumnVisibility}
                />
              </div>
            </details>
          </div>
        )}

        {/* Breathing room below the last row so users can scroll the
            final row clear of any bottom UI / browser chrome. */}
        <div className="h-32" aria-hidden="true" />
      </div>
    </div>
  );
}
