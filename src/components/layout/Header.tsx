import { Plus, Car } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useVehicles } from '../../hooks/useVehicles';

export function Header() {
  const openAddDialog = useUIStore((s) => s.openAddDialog);
  const openAddCurrentCarDialog = useUIStore((s) => s.openAddCurrentCarDialog);
  const vehicles = useVehicles();
  const activeCount = vehicles.filter((v) => !v.user.archived).length;
  const hasCurrentCar = vehicles.some((v) => v.user.isCurrentCar && !v.user.archived);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-slate-800">
          <Car size={20} className="text-blue-600" />
          <h1 className="text-lg font-bold tracking-tight">Car Board</h1>
        </div>
        <span className="text-xs text-slate-400 mt-0.5">
          {activeCount} {activeCount === 1 ? 'vehicle' : 'vehicles'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!hasCurrentCar && (
          <button
            onClick={openAddCurrentCarDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <Car size={15} />
            Add Your Car
          </button>
        )}
        <button
          onClick={openAddDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Listing
        </button>
      </div>
    </header>
  );
}
