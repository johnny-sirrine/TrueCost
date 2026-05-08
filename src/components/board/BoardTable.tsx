import { Fragment, useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react';
import { boardColumns, COLUMN_FAMILIES, CHILD_TO_PARENT, type BoardTableMeta } from './columns';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { useAssumptions } from '../../hooks/useAssumptions';
import { useVehicleActions } from '../../hooks/useVehicleActions';
import { formatCurrency } from '../../lib/formatters';
import type { ComputedVehicle } from '../../hooks/useComputedBoard';

interface BoardTableProps {
  data: ComputedVehicle[];
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (vis: VisibilityState) => void;
  showSellScenario?: boolean;
  onToggleSellScenario?: () => void;
}

const SELL_ZERO_COLUMNS = new Set(['insurance', 'baseline', 'allIn', 'fuel', 'routine', 'repairs', 'reserve']);
const SELL_PROCEEDS_COLUMNS = new Set(['firstYear', 'totalCost']);
const STICKY_COLUMN_IDS = ['pin', 'source', 'vehicle'] as const;

function rowBgClass(isCurrentCar: boolean, isPinned: boolean): string {
  if (isCurrentCar) return 'bg-emerald-50';
  if (isPinned) return 'bg-amber-50';
  return 'bg-white group-hover/row:bg-slate-50';
}

/** Resolve the slate-100 band for family columns (visible children and their
 *  expanded parent). Returns '' when the column is not part of an expanded
 *  family — callers can then fall back to the row background. */
function familyBandFor(columnId: string, columnVisibility: VisibilityState): string {
  const parentId = CHILD_TO_PARENT[columnId];
  if (parentId !== undefined) return 'bg-slate-100';
  const children = COLUMN_FAMILIES[columnId];
  if (children && children.some((childId) => columnVisibility[childId] !== false)) {
    return 'bg-slate-100';
  }
  return '';
}

export function BoardTable({ data, columnVisibility, onColumnVisibilityChange, showSellScenario, onToggleSellScenario }: BoardTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const openDetailDrawer = useUIStore((s) => s.openDetailDrawer);
  const openSellScenarioDrawer = useUIStore((s) => s.openSellScenarioDrawer);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const showToast = useToastStore((s) => s.showToast);
  const assumptions = useAssumptions();
  const { addVehicle, updateVehicle, removeVehicle, togglePin } = useVehicleActions();

  const globalFilter = useMemo(() => searchQuery, [searchQuery]);

  const onRatingChange = useCallback(async (vehicleId: string, rating: number | undefined) => {
    const vehicle = data.find(d => d.vehicle.id === vehicleId)?.vehicle;
    if (!vehicle) return;
    await updateVehicle(vehicleId, {
      user: { ...vehicle.user, userRating: rating },
    });
  }, [data, updateVehicle]);

  const onLocationChange = useCallback(async (vehicleId: string, location: string) => {
    const vehicle = data.find((d) => d.vehicle.id === vehicleId)?.vehicle;
    if (!vehicle || vehicle.user.isCurrentCar) return;
    const normalizedLocation = location.trim();
    await updateVehicle(vehicleId, {
      listing: {
        ...vehicle.listing,
        location: normalizedLocation || undefined,
      },
    });
  }, [data, updateVehicle]);

  const onNotesChange = useCallback(async (vehicleId: string, notes: string) => {
    const vehicle = data.find((d) => d.vehicle.id === vehicleId)?.vehicle;
    if (!vehicle) return;
    await updateVehicle(vehicleId, {
      user: {
        ...vehicle.user,
        notes,
      },
    });
  }, [data, updateVehicle]);

  /** Delete a vehicle and offer an undo toast. We snapshot the full row
   *  before deletion so the undo handler can re-add it with the same id
   *  (preserving references from other data — sell scenario, pinned state,
   *  etc.). Undo re-inserts via `addVehicle`, which runs its single-current-
   *  car enforcement; for deleted non-current-car rows that's a no-op. */
  const onDeleteVehicle = useCallback(async (vehicleId: string) => {
    const row = data.find((d) => d.vehicle.id === vehicleId)?.vehicle;
    if (!row) return;
    const snapshot = structuredClone(row);
    const { year, make, model } = snapshot.canonical;
    await removeVehicle(vehicleId);
    showToast(`Removed ${year} ${make} ${model}`, 'info', {
      label: 'Undo',
      onClick: () => {
        void addVehicle(snapshot).catch(() => {
          showToast('Could not restore vehicle', 'error');
        });
      },
    });
  }, [data, removeVehicle, addVehicle, showToast]);

  const onTogglePin = useCallback(async (vehicleId: string, currentPinned: boolean) => {
    await togglePin(vehicleId, currentPinned);
  }, [togglePin]);

  const meta: BoardTableMeta = useMemo(() => ({
    openDetailDrawer,
    assumptions,
    onRatingChange,
    onLocationChange,
    onNotesChange,
    onDeleteVehicle,
    onTogglePin,
  }), [openDetailDrawer, assumptions, onRatingChange, onLocationChange, onNotesChange, onDeleteVehicle, onTogglePin]);

  /** Flip all children of a family's visibility at once. If any child is
   *  currently visible, the next state hides them all; otherwise show them
   *  all. The click target is the chevron button inside the header, so we
   *  stopPropagation to avoid toggling the column's sort at the same time. */
  const toggleFamily = useCallback((parentId: string) => {
    const children = COLUMN_FAMILIES[parentId];
    if (!children) return;
    const anyVisible = children.some((childId) => columnVisibility[childId] !== false);
    const next: VisibilityState = { ...columnVisibility };
    for (const childId of children) {
      next[childId] = !anyVisible;
    }
    onColumnVisibilityChange(next);
  }, [columnVisibility, onColumnVisibilityChange]);

  const table = useReactTable({
    data,
    columns: boardColumns,
    state: { sorting, columnVisibility, globalFilter, columnSizing },
    meta,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
      onColumnVisibilityChange(next);
    },
    defaultColumn: {
      minSize: 40,
      enableResizing: false,
    },
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true;
      const v = row.original.vehicle;
      const searchStr = `${v.canonical.year} ${v.canonical.make} ${v.canonical.model} ${v.canonical.trim ?? ''} ${v.user.tags.join(' ')}`.toLowerCase();
      return searchStr.includes(filterValue.toLowerCase());
    },
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const stickyLeftById: Record<string, number> = {};
  let stickySectionWidth = 0;
  for (const stickyId of STICKY_COLUMN_IDS) {
    const column = visibleLeafColumns.find((candidate) => candidate.id === stickyId);
    if (!column) continue;
    stickyLeftById[stickyId] = stickySectionWidth;
    stickySectionWidth += column.getSize();
  }
  const stickySectionColumns = visibleLeafColumns.filter((column) => stickyLeftById[column.id] !== undefined);
  const stickySectionColSpan = stickySectionColumns.length;
  const trailingSectionColSpan = visibleLeafColumns.length - stickySectionColSpan;

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-slate-200 bg-white">
              {hg.headers.map((header) => {
                const stickyLeft = stickyLeftById[header.id];
                const isSticky = stickyLeft !== undefined;
                const width = header.getSize();
                const familyChildren = COLUMN_FAMILIES[header.id];
                const isFamilyParent = familyChildren !== undefined;
                const childrenExpanded = isFamilyParent
                  ? familyChildren.some((childId) => columnVisibility[childId] !== false)
                  : false;
                // Band any visible family child — and its expanded parent —
                // in slate-100 so users can see the group at a glance.
                const familyBandClass = familyBandFor(header.id, columnVisibility) || 'bg-white';
                // The whole header row sticks to the top of the scroll
                // container. Sticky columns (pin/source/vehicle) live at the
                // intersection and need a higher z so they stay above body
                // sticky cells when scrolling horizontally.
                const stickyClass = isSticky
                  ? 'sticky top-0 z-30'
                  : 'sticky top-0 z-20';
                return (
                  <th
                    key={header.id}
                    className={`relative text-left py-2.5 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider select-none whitespace-nowrap ${familyBandClass} ${stickyClass} shadow-[inset_0_-1px_0_rgb(226_232_240)]`}
                    style={{ width, minWidth: width, ...(isSticky ? { left: stickyLeft } : {}) }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-0.5">
                        <button
                          className={`flex items-center gap-0.5 cursor-pointer hover:text-slate-700 ${
                            isFamilyParent && childrenExpanded ? 'font-bold text-slate-700' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                          {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                        </button>
                        {isFamilyParent && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFamily(header.id);
                            }}
                            aria-expanded={childrenExpanded}
                            aria-label={`${childrenExpanded ? 'Hide' : 'Show'} ${
                              typeof header.column.columnDef.header === 'string'
                                ? header.column.columnDef.header
                                : header.id
                            } breakdown`}
                            title={`${childrenExpanded ? 'Hide' : 'Show'} breakdown`}
                            className={`ml-0.5 p-0.5 rounded hover:bg-slate-200 cursor-pointer transition-colors ${
                              childrenExpanded ? 'text-slate-700' : 'text-slate-400'
                            }`}
                          >
                            {childrenExpanded ? (
                              // Inward-pointing double chevron = collapse
                              <ChevronsRightLeft size={11} aria-hidden="true" />
                            ) : (
                              // Outward-pointing double chevron = expand
                              <ChevronsLeftRight size={11} aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        data-testid={`resize-${header.id}`}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={() => header.column.resetSize()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute right-0 top-0 h-full w-3 translate-x-1/2 cursor-col-resize select-none touch-none ${
                          header.column.getIsResizing() ? 'bg-blue-500/20' : 'hover:bg-slate-300/50'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {(() => {
            // Partition sorted rows so current-car rows always float to the top,
            // independent of the active column sort. TanStack's sort still
            // orders within each partition.
            const allRows = table.getRowModel().rows;
            const orderedRows = [
              ...allRows.filter((r) => r.original.vehicle.user.isCurrentCar),
              ...allRows.filter((r) => !r.original.vehicle.user.isCurrentCar),
            ];
            return orderedRows.map((row, index) => {
            const isCurrentCar = row.original.vehicle.user.isCurrentCar;
            const isArchived = row.original.vehicle.user.archived;
            const isPinned = row.original.vehicle.user.pinned;
            const rows = orderedRows;
            const colCount = visibleLeafColumns.length;

            const isFirstCurrentCar = isCurrentCar && (index === 0 || !rows[index - 1].original.vehicle.user.isCurrentCar);
            const isLastCurrentCar = isCurrentCar && (index === rows.length - 1 || !rows[index + 1].original.vehicle.user.isCurrentCar);
            const isFirstCandidate = !isCurrentCar && index > 0 && rows[index - 1].original.vehicle.user.isCurrentCar;

            return (
              <Fragment key={row.id}>
                {isFirstCurrentCar && (
                  <tr>
                    {stickySectionColSpan > 0 ? (
                      <>
                        <td
                          colSpan={stickySectionColSpan}
                          className="sticky left-0 z-10 pt-1 pb-1 px-4 bg-emerald-50/30"
                          style={{ width: stickySectionWidth, minWidth: stickySectionWidth }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">My Car</span>
                            {onToggleSellScenario && (
                              <button
                                onClick={onToggleSellScenario}
                                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showSellScenario ? 'Hide' : 'Show'} sell scenario
                              </button>
                            )}
                          </div>
                        </td>
                        {trailingSectionColSpan > 0 && (
                          <td colSpan={trailingSectionColSpan} className="pt-1 pb-1 px-4 bg-emerald-50/30" />
                        )}
                      </>
                    ) : (
                      <td colSpan={colCount} className="pt-1 pb-1 px-4 bg-emerald-50/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">My Car</span>
                          {onToggleSellScenario && (
                            <button
                              onClick={onToggleSellScenario}
                              className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showSellScenario ? 'Hide' : 'Show'} sell scenario
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )}
                {isFirstCandidate && (
                  <tr>
                    {stickySectionColSpan > 0 ? (
                      <>
                        <td
                          colSpan={stickySectionColSpan}
                          className="sticky left-0 z-10 pt-3 pb-1 px-4 border-t-2 border-emerald-200 bg-white"
                          style={{ width: stickySectionWidth, minWidth: stickySectionWidth }}
                        >
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidates</span>
                        </td>
                        {trailingSectionColSpan > 0 && (
                          <td colSpan={trailingSectionColSpan} className="pt-3 pb-1 px-4 border-t-2 border-emerald-200 bg-white" />
                        )}
                      </>
                    ) : (
                      <td colSpan={colCount} className="pt-3 pb-1 px-4 border-t-2 border-emerald-200">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidates</span>
                      </td>
                    )}
                  </tr>
                )}
                <tr
                  className={`
                    border-b border-slate-100 transition-colors group/row
                    ${isArchived ? 'opacity-50' : ''}
                    ${isCurrentCar ? 'bg-emerald-50' : isPinned ? 'bg-amber-50' : 'bg-white hover:bg-slate-50'}
                  `}
                >
                  {row.getVisibleCells().map((cell) => {
                    const stickyLeft = stickyLeftById[cell.column.id];
                    const isSticky = stickyLeft !== undefined;
                    const stickyBg = isSticky ? rowBgClass(isCurrentCar, isPinned) : '';
                    // Family columns (visible children + expanded parent) get
                    // a slate-100 band that visually overrides the row color
                    // to make the group obvious. Sticky columns are never
                    // family members, so no conflict.
                    const bandClass = !isSticky ? familyBandFor(cell.column.id, columnVisibility) : '';
                    return (
                      <td
                        key={cell.id}
                        className={`py-2.5 px-2 whitespace-nowrap ${cell.column.id === 'notes' ? 'align-top' : ''} ${isSticky ? `sticky z-[1] ${stickyBg}` : bandClass}`}
                        style={isSticky ? { left: stickyLeft, width: cell.column.getSize(), minWidth: cell.column.getSize() } : { width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                {isLastCurrentCar && showSellScenario && (() => {
                  const mv = row.original.computed.currentMarketValueEstimate;
                  const netProceeds = Math.round(mv * 0.92);
                  return (
                    <tr
                      className="border-b border-slate-100 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors group/row"
                      onClick={openSellScenarioDrawer}
                    >
                      {table.getVisibleLeafColumns().map((column) => {
                        const stickyLeft = stickyLeftById[column.id];
                        const isSticky = stickyLeft !== undefined;
                        const bandClass = !isSticky ? familyBandFor(column.id, columnVisibility) : '';
                        return (
                          <td
                            key={`sell-${column.id}`}
                            className={`py-2 px-2 whitespace-nowrap text-sm ${isSticky ? 'sticky z-[1] bg-amber-50 group-hover/row:bg-amber-100' : bandClass}`}
                            style={isSticky ? { left: stickyLeft, width: column.getSize(), minWidth: column.getSize() } : { width: column.getSize(), minWidth: column.getSize() }}
                          >
                            {column.id === 'vehicle' ? (
                              <span className="flex items-center gap-2 pl-4 text-xs">
                                <span className="text-slate-500 italic hover:text-blue-700 hover:underline">↳ If you sell</span>
                                <span className="tabular-nums text-emerald-700 font-semibold">
                                  +{formatCurrency(netProceeds)}
                                </span>
                              </span>
                            ) : column.id === 'price' ? (
                              <span className="tabular-nums text-emerald-600 font-medium">+{formatCurrency(netProceeds)}</span>
                            ) : SELL_ZERO_COLUMNS.has(column.id) ? (
                              <span className="text-slate-300">$0</span>
                            ) : SELL_PROCEEDS_COLUMNS.has(column.id) ? (
                              <span className="tabular-nums text-emerald-600 font-medium">+{formatCurrency(netProceeds)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })()}
              </Fragment>
            );
          });
          })()}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          No vehicles to show. Add a listing to get started.
        </div>
      )}
    </>
  );
}
