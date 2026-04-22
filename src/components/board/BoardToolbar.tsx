import { Search, Columns3, Eye, EyeOff, Download, GitCompareArrows } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAssumptions } from '../../hooks/useAssumptions';
import { useComputedBoard } from '../../hooks/useComputedBoard';
import { useToastStore } from '../../store/toastStore';
import { downloadTextFile, filenameStamp, vehiclesToCsv, exportJson } from '../../lib/exportData';
import { useState, useRef, useEffect } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { COLUMN_FAMILIES, CHILD_TO_PARENT } from './columns';

const COLUMN_LABELS: Record<string, string> = {
  pin: 'Pin',
  source: 'Source',
  vehicle: 'Vehicle',
  rating: 'My Rating',
  price: 'Price',
  mileage: 'Miles',
  drivetrain: 'Drive',
  mpg: 'MPG',
  insurance: 'Insurance/mo',
  baseline: 'Baseline/mo',
  allIn: 'All-In/mo',
  salesTax: 'Tax',
  firstYear: '1st Year Cost',
  resaleLoss: 'Resale Loss',
  totalCost: 'Total Cost',
  capability: 'Capability',
  deal: 'Deal Rating',
  fuel: 'Fuel/mo',
  routine: 'Routine/mo',
  repairs: 'Repairs/mo',
  reserve: 'Reserve/mo',
  catchUp: 'Catch-Up / Fees',
  resale: 'Resale Est.',
  confidence: 'Confidence',
};

/** Group labels so the dropdown can render parent families together.
 *  Children are suppressed from the top-level list and rendered under
 *  the parent instead. Columns not present in any family and not a
 *  parent themselves fall into the "More columns" tail section. */
const FAMILY_PARENT_ORDER = ['allIn', 'firstYear', 'totalCost'];
const MORE_COLUMNS = ['fuel', 'routine', 'repairs', 'reserve', 'catchUp', 'resale', 'confidence'];
const TOP_LEVEL_COLUMNS = Object.keys(COLUMN_LABELS).filter(
  (id) => CHILD_TO_PARENT[id] === undefined && !MORE_COLUMNS.includes(id),
);

interface BoardToolbarProps {
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (vis: VisibilityState) => void;
}

export function BoardToolbar({ columnVisibility, onColumnVisibilityChange }: BoardToolbarProps) {
  const { searchQuery, setSearchQuery, openCompareModal } = useUIStore();
  const computed = useComputedBoard();
  const assumptions = useAssumptions();
  const showToast = useToastStore((s) => s.showToast);
  const activeCount = computed.filter((c) => !c.vehicle.user.archived).length;
  const [showColumns, setShowColumns] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowColumns(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleColumn = (colId: string) => {
    const current = columnVisibility[colId] ?? true;
    onColumnVisibilityChange({ ...columnVisibility, [colId]: !current });
  };

  const handleExportCsv = () => {
    if (computed.length === 0) {
      showToast('No vehicles to export', 'info');
      return;
    }
    const csv = vehiclesToCsv(computed);
    downloadTextFile(csv, `car-board-${filenameStamp()}.csv`, 'text/csv;charset=utf-8');
    showToast(`Exported ${computed.length} ${computed.length === 1 ? 'vehicle' : 'vehicles'} to CSV`, 'success');
    setShowExport(false);
  };

  const handleExportJson = () => {
    const vehicles = computed.map((c) => c.vehicle);
    if (vehicles.length === 0) {
      showToast('No vehicles to export', 'info');
      return;
    }
    const json = exportJson(vehicles, assumptions);
    downloadTextFile(json, `car-board-backup-${filenameStamp()}.json`, 'application/json');
    showToast(`Exported ${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'} to JSON`, 'success');
    setShowExport(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search vehicles..."
          aria-label="Search vehicles"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <button
        onClick={openCompareModal}
        disabled={activeCount < 2}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        title={activeCount < 2 ? 'Add at least 2 vehicles to compare' : 'Side-by-side comparison'}
      >
        <GitCompareArrows size={14} aria-hidden="true" />
        Compare
      </button>

      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setShowExport(!showExport)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          aria-haspopup="true"
          aria-expanded={showExport}
          aria-label="Export data"
        >
          <Download size={14} aria-hidden="true" />
          Export
        </button>
        {showExport && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1" role="menu">
            <button
              onClick={handleExportCsv}
              className="flex flex-col items-start w-full px-3 py-2 text-sm text-left hover:bg-slate-50 cursor-pointer"
              role="menuitem"
            >
              <span className="font-medium text-slate-700">Download CSV</span>
              <span className="text-xs text-slate-400">Spreadsheet-friendly</span>
            </button>
            <button
              onClick={handleExportJson}
              className="flex flex-col items-start w-full px-3 py-2 text-sm text-left hover:bg-slate-50 cursor-pointer"
              role="menuitem"
            >
              <span className="font-medium text-slate-700">Download JSON</span>
              <span className="text-xs text-slate-400">Full backup (restore-ready)</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowColumns(!showColumns)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          aria-haspopup="true"
          aria-expanded={showColumns}
        >
          <Columns3 size={14} aria-hidden="true" />
          Columns
        </button>
        {showColumns && (
          <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-96 overflow-y-auto" role="menu">
            {/* Top-level (summary + single) columns in render order. */}
            {TOP_LEVEL_COLUMNS.map((colId) => (
              <ColumnToggle
                key={colId}
                colId={colId}
                label={COLUMN_LABELS[colId]}
                visible={columnVisibility[colId] ?? true}
                onToggle={toggleColumn}
              />
            ))}

            {/* Breakdowns — family children grouped under their parent. */}
            {FAMILY_PARENT_ORDER.map((parentId) => {
              const children = COLUMN_FAMILIES[parentId] ?? [];
              if (children.length === 0) return null;
              return (
                <div key={`family-${parentId}`} className="mt-1 pt-1 border-t border-slate-100">
                  <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {COLUMN_LABELS[parentId]} breakdown
                  </div>
                  {children.map((childId) => (
                    <ColumnToggle
                      key={childId}
                      colId={childId}
                      label={COLUMN_LABELS[childId] ?? childId}
                      visible={columnVisibility[childId] ?? true}
                      onToggle={toggleColumn}
                      indent
                    />
                  ))}
                </div>
              );
            })}

            {/* More columns — power-user extras not tied to a family. */}
            {MORE_COLUMNS.length > 0 && (
              <div className="mt-1 pt-1 border-t border-slate-100">
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  More columns
                </div>
                {MORE_COLUMNS.map((colId) => (
                  <ColumnToggle
                    key={colId}
                    colId={colId}
                    label={COLUMN_LABELS[colId] ?? colId}
                    visible={columnVisibility[colId] ?? true}
                    onToggle={toggleColumn}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnToggle({
  colId,
  label,
  visible,
  onToggle,
  indent,
}: {
  colId: string;
  label: string;
  visible: boolean;
  onToggle: (id: string) => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={() => onToggle(colId)}
      className={`flex items-center gap-2 w-full py-1.5 text-sm text-left hover:bg-slate-50 ${
        indent ? 'pl-6 pr-3' : 'px-3'
      }`}
      role="menuitemcheckbox"
      aria-checked={visible}
    >
      {visible ? (
        <Eye size={14} className="text-blue-500" aria-hidden="true" />
      ) : (
        <EyeOff size={14} className="text-slate-300" aria-hidden="true" />
      )}
      <span className={visible ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
    </button>
  );
}
