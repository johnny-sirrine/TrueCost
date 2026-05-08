import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Pin, Archive, Copy, Trash2, Car, Pencil } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { useVehicleById } from '../../hooks/useVehicles';
import { useAssumptions } from '../../hooks/useAssumptions';
import { useVehicleActions } from '../../hooks/useVehicleActions';
import { db } from '../../db';
import { computeEvaluation } from '../../engine';
import { computeInsurance } from '../../engine/insurance';
import { computeResale } from '../../engine/resale';
import { formatCurrency, formatMiles, formatMpg } from '../../lib/formatters';
import { DEAL_QUALITY_COLORS, LISTING_SOURCE_LABELS, CONFIDENCE_COLORS } from '../../lib/constants';
import { DEPRECIATION_PROFILES } from '../../data/depreciationProfiles';
import { FieldStatusBadge } from '../shared/FieldStatusBadge';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EditableField } from './EditableField';
import { HistorySection } from './HistorySection';
import { detectSourceFromUrl } from '../../adapters/detectSource';

type ActiveDetailEditor = {
  commitIfDirty: () => Promise<void> | void;
};

export function DetailDrawer() {
  const { selectedVehicleId, isDetailDrawerOpen, closeDetailDrawer } = useUIStore();
  const vehicle = useVehicleById(selectedVehicleId);
  const assumptions = useAssumptions();
  const { duplicateVehicle, removeVehicle, togglePin, toggleArchive, setCurrentCar } = useVehicleActions();
  const showToast = useToastStore((s) => s.showToast);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchiveCurrentCar, setConfirmArchiveCurrentCar] = useState(false);
  const activeDetailEditorRef = useRef<ActiveDetailEditor | null>(null);

  const registerActiveDetailEditor = (editor: ActiveDetailEditor | null) => {
    activeDetailEditorRef.current = editor;
  };

  const requestCloseDrawer = async () => {
    await Promise.resolve(activeDetailEditorRef.current?.commitIfDirty?.());
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    closeDetailDrawer();
  };

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        void requestCloseDrawer();
      }
    }
    if (isDetailDrawerOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isDetailDrawerOpen, requestCloseDrawer]);

  if (!isDetailDrawerOpen || !vehicle) return null;

  const computed = computeEvaluation(vehicle, assumptions);
  const resale = computeResale(vehicle, assumptions);
  const insurance = computeInsurance(vehicle, assumptions, resale.currentMarketValueEstimate);
  const profileInfo = DEPRECIATION_PROFILES[vehicle.user.depreciationProfileId ?? 'normal_midlife'];
  const isCurrentCar = vehicle.user.isCurrentCar;

  const applyVehicleUpdate = async (changes: Record<string, unknown>) => {
    await db.vehicles.update(vehicle.id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    } as never);
  };

  const handleOverride = async (field: string, value: number) => {
    // Clamp to sane bounds per field to prevent runaway calculations
    const bounds: Record<string, { min: number; max: number }> = {
      realisticMpg: { min: 5, max: 150 },
      routineMonthly: { min: 0, max: 2000 },
      expectedRepairsMonthly: { min: 0, max: 2000 },
      majorRepairReserveMonthly: { min: 0, max: 2000 },
      currentMarketValue: { min: 0, max: 500000 },
    };
    const b = bounds[field];
    const clamped = b ? Math.max(b.min, Math.min(b.max, value)) : value;
    await applyVehicleUpdate({
      [`user.overrides.${field}`]: clamped,
      [`fieldMeta.${field}`]: {
        origin: 'overridden' as const,
        confidence: 'high' as const,
        originalValue: undefined,
        note: 'User override',
      },
    });
  };

  const handleCatchUpChange = async (value: number) => {
    await applyVehicleUpdate({
      'user.catchUpCost': value,
    });
  };

  const handleNotesChange = async (notes: string) => {
    await applyVehicleUpdate({
      'user.notes': notes,
    });
  };

  const handleCanonicalChange = async (field: string, value: string | number | undefined) => {
    await applyVehicleUpdate({
      [`canonical.${field}`]: value || undefined,
      [`fieldMeta.${field}`]: {
        origin: 'overridden' as const,
        confidence: 'high' as const,
        note: 'User override',
      },
    });
  };

  const handleUserChange = async (
    field: keyof typeof vehicle.user,
    value: typeof vehicle.user[keyof typeof vehicle.user],
    opts?: { markOverride?: boolean }
  ) => {
    const updates: Record<string, unknown> = {
      [`user.${String(field)}`]: value,
    };
    if (opts?.markOverride) {
      updates[`fieldMeta.${String(field)}`] = {
        origin: 'overridden' as const,
        confidence: 'high' as const,
        note: 'User override',
      };
    }
    await applyVehicleUpdate(updates);
  };

  const handleListingChange = async (
    field: keyof typeof vehicle.listing,
    value: typeof vehicle.listing[keyof typeof vehicle.listing]
  ) => {
    const updates: Record<string, unknown> = {
      [`listing.${String(field)}`]: value,
    };
    // When the user adds or edits a sourceUrl and the URL maps to a
    // recognized site, also update `source` so the Source label in the
    // board reflects the website instead of staying on the original
    // entry channel (e.g. raw_text → facebook). This mirrors the
    // detection we already do in the Add Listing dialog, keeping the
    // invariant "a URL that points at a known site overrides the
    // source" consistent across entry paths.
    if (field === 'sourceUrl' && typeof value === 'string' && value.length > 0) {
      const detected = detectSourceFromUrl(value);
      if (detected) updates['listing.source'] = detected;
    }
    await applyVehicleUpdate(updates);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="detail-drawer-backdrop"
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => {
          void requestCloseDrawer();
        }}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[520px] max-w-full bg-white shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="detail-drawer-title" className="text-lg font-semibold text-slate-900">
              {vehicle.canonical.year} {vehicle.canonical.make} {vehicle.canonical.model}
              {vehicle.canonical.trim && <span className="text-slate-500 font-normal"> {vehicle.canonical.trim}</span>}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                {LISTING_SOURCE_LABELS[vehicle.listing.source] ?? vehicle.listing.source}
              </span>
              {vehicle.listing.sourceUrl && (
                <a
                  href={vehicle.listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 text-xs"
                >
                  <ExternalLink size={10} /> View listing
                </a>
              )}
              {vehicle.user.titleStatus !== 'clean' && (
                <span className="text-xs font-medium text-amber-600">{vehicle.user.titleStatus} title</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentCar(vehicle.id, !vehicle.user.isCurrentCar)}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              title={isCurrentCar ? 'Unmark as current car' : 'Mark as current car'}
              aria-label={isCurrentCar ? 'Unmark as current car' : 'Mark as current car'}
            >
              <Car size={16} className={isCurrentCar ? 'text-emerald-500' : 'text-slate-400'} />
            </button>
            <button
              onClick={() => togglePin(vehicle.id, vehicle.user.pinned)}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              title={vehicle.user.pinned ? 'Unpin' : 'Pin'}
              aria-label={vehicle.user.pinned ? 'Unpin vehicle' : 'Pin vehicle'}
            >
              <Pin size={16} className={vehicle.user.pinned ? 'text-amber-500' : 'text-slate-400'} />
            </button>
            <button
              onClick={() => {
                if (!vehicle.user.archived && vehicle.user.isCurrentCar) {
                  setConfirmArchiveCurrentCar(true);
                } else {
                  toggleArchive(vehicle.id, vehicle.user.archived);
                }
              }}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              title={vehicle.user.archived ? 'Unarchive' : 'Archive'}
              aria-label={vehicle.user.archived ? 'Unarchive vehicle' : 'Archive vehicle'}
            >
              <Archive size={16} className={vehicle.user.archived ? 'text-blue-500' : 'text-slate-400'} />
            </button>
            <button
              onClick={async () => {
                await duplicateVehicle(vehicle);
                showToast('Vehicle duplicated', 'success');
              }}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              title="Duplicate"
              aria-label="Duplicate vehicle"
            >
              <Copy size={16} className="text-slate-400" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 hover:bg-red-50 rounded cursor-pointer"
              title="Remove"
              aria-label="Remove vehicle"
            >
              <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
            </button>
            <button
              onClick={() => {
                void requestCloseDrawer();
              }}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              title="Close"
              aria-label="Close detail panel"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100">
            {isCurrentCar ? (
              <StatCard label="Market Value Est." value={formatCurrency(computed.currentMarketValueEstimate)} meta={vehicle.fieldMeta['currentMarketValue']} />
            ) : (
              <EditableStatCard
                label="Price"
                rawValue={vehicle.user.listingPrice}
                displayValue={formatCurrency(vehicle.user.listingPrice)}
                meta={vehicle.fieldMeta['listingPrice']}
                onSave={(v) => handleUserChange('listingPrice', v, { markOverride: true })}
                min={0}
                step={100}
              />
            )}
            <EditableStatCard
              label="Mileage"
              rawValue={vehicle.user.mileage}
              displayValue={formatMiles(vehicle.user.mileage)}
              meta={vehicle.fieldMeta['mileage']}
              onSave={(v) => handleUserChange('mileage', v, { markOverride: true })}
              min={0}
              step={1000}
            />
            <StatCard label={isCurrentCar ? 'Depreciation' : 'Market Value Est.'} value={isCurrentCar ? formatCurrency(computed.resaleLoss) : formatCurrency(computed.currentMarketValueEstimate)} meta={isCurrentCar ? undefined : vehicle.fieldMeta['currentMarketValue']} />
          </div>

          {/* Deal Quality */}
          <Section title="Deal Quality">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${DEAL_QUALITY_COLORS[computed.dealQuality]}`}>
                {computed.dealQuality}
              </span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${CONFIDENCE_COLORS[computed.confidence]}`} />
                <span className="text-xs text-slate-500">{computed.confidence} confidence</span>
              </div>
            </div>
            <ul className="space-y-1">
              {computed.dealExplanation.map((exp, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">-</span>
                  {exp}
                </li>
              ))}
            </ul>
          </Section>

          {/* History & Recalls — screening tier, opt-in fetch */}
          <Section title="History & Recalls" collapsible>
            <HistorySection vehicle={vehicle} />
          </Section>

          {/* Canonical Vehicle */}
          <Section title="Vehicle Identity" collapsible>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <EditableFieldRow label="Year" value={String(vehicle.canonical.year)} meta={vehicle.fieldMeta['year']} inputType="number" onSave={(v) => handleCanonicalChange('year', Number(v))} registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Make" value={vehicle.canonical.make} meta={vehicle.fieldMeta['make']} onSave={(v) => handleCanonicalChange('make', v)} registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Model" value={vehicle.canonical.model} meta={vehicle.fieldMeta['model']} onSave={(v) => handleCanonicalChange('model', v)} registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Trim" value={vehicle.canonical.trim ?? ''} meta={vehicle.fieldMeta['trim']} onSave={(v) => handleCanonicalChange('trim', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Body Style" value={vehicle.canonical.bodyStyle ?? ''} meta={vehicle.fieldMeta['bodyStyle']} options={['sedan', 'suv', 'truck', 'van', 'coupe', 'hatchback', 'wagon', 'crossover']} onSave={(v) => handleCanonicalChange('bodyStyle', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Drivetrain" value={vehicle.canonical.drivetrain ?? ''} meta={vehicle.fieldMeta['drivetrain']} options={['awd', '4wd', 'fwd', 'rwd']} displayTransform={(v) => v.toUpperCase()} onSave={(v) => handleCanonicalChange('drivetrain', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Engine" value={vehicle.canonical.engineType ?? ''} meta={vehicle.fieldMeta['engineType']} options={['gas', 'diesel', 'hybrid', 'phev', 'ev']} onSave={(v) => handleCanonicalChange('engineType', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Transmission" value={vehicle.canonical.transmissionType ?? ''} meta={vehicle.fieldMeta['transmissionType']} options={['automatic', 'manual', 'cvt']} onSave={(v) => handleCanonicalChange('transmissionType', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="Vehicle Class" value={vehicle.canonical.vehicleClass ?? ''} meta={vehicle.fieldMeta['vehicleClass']} options={['compact_car', 'midsize_car', 'fullsize_car', 'compact_crossover', 'midsize_crossover', 'fullsize_suv', 'body_on_frame_suv', 'compact_truck', 'fullsize_truck', 'van']} displayTransform={(v) => v.replace(/_/g, ' ')} onSave={(v) => handleCanonicalChange('vehicleClass', v)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
              <EditableFieldRow label="EPA Combined" value={vehicle.canonical.epaCombinedMpg != null ? String(vehicle.canonical.epaCombinedMpg) : ''} meta={vehicle.fieldMeta['epaCombinedMpg']} inputType="number" suffix=" mpg" onSave={(v) => handleCanonicalChange('epaCombinedMpg', v ? Number(v) : undefined)} placeholder="—" registerActiveEditor={registerActiveDetailEditor} />
            </div>
          </Section>

          {/* Listing & Condition */}
          <Section title="Listing & Condition" collapsible>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <EditableFieldRow
                label="Title Status"
                value={vehicle.user.titleStatus}
                options={['clean', 'salvage', 'rebuilt', 'lemon', 'unknown']}
                displayTransform={(v) => TITLE_STATUS_LABELS[v] ?? v}
                onSave={(v) => handleUserChange('titleStatus', v as typeof vehicle.user.titleStatus)}
                registerActiveEditor={registerActiveDetailEditor}
              />
              <EditableFieldRow
                label="Condition"
                value={vehicle.user.conditionLevel}
                options={['excellent', 'average', 'mild_mods', 'poor']}
                displayTransform={(v) => CONDITION_LEVEL_LABELS[v] ?? v}
                onSave={(v) => handleUserChange('conditionLevel', v as typeof vehicle.user.conditionLevel)}
                registerActiveEditor={registerActiveDetailEditor}
              />
              <EditableFieldRow
                label="Modification Level"
                value={vehicle.user.modificationLevel ?? 'stock'}
                options={['stock', 'low', 'medium', 'high']}
                displayTransform={(v) => MODIFICATION_LEVEL_LABELS[v] ?? v}
                onSave={(v) => handleUserChange('modificationLevel', v as typeof vehicle.user.modificationLevel)}
                registerActiveEditor={registerActiveDetailEditor}
              />
              <EditableFieldRow
                label="Source"
                value={vehicle.listing.source}
                options={['ksl', 'facebook', 'carscom', 'craigslist', 'dealer', 'manual', 'raw_text']}
                displayTransform={(v) => LISTING_SOURCE_LABELS[v] ?? v}
                onSave={(v) => handleListingChange('source', v as typeof vehicle.listing.source)}
                registerActiveEditor={registerActiveDetailEditor}
              />
              <EditableFieldRow
                label="Location"
                value={vehicle.listing.location ?? ''}
                onSave={(v) => handleListingChange('location', v ? v : undefined)}
                placeholder="—"
                registerActiveEditor={registerActiveDetailEditor}
              />
              <EditableFieldRow
                label="Listing URL"
                value={vehicle.listing.sourceUrl ?? ''}
                onSave={(v) => handleListingChange('sourceUrl', v ? v : undefined)}
                placeholder="—"
                registerActiveEditor={registerActiveDetailEditor}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Condition is relative to what's typical for the vehicle's age. Modification level captures lift, tires, suspension, drivetrain, or overland changes.
            </p>
          </Section>

          {/* MPG Model */}
          <Section title="Realistic MPG">
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Realistic MPG</span>
                <span className="font-medium tabular-nums">{formatMpg(computed.realisticMpg)}</span>
              </div>
              <details className="group/mpg">
                <summary className="text-xs text-slate-400 cursor-pointer select-none list-none flex items-center gap-1">
                  <span className="group-open/mpg:rotate-90 transition-transform text-[10px]">&#9654;</span>
                  Adjustment factors
                </summary>
                <div className="pl-3 space-y-0.5 text-xs text-slate-500 mt-1">
                  <div className="flex justify-between">
                    <span>Base factor ({vehicle.canonical.vehicleClass?.replace(/_/g, ' ') ?? '—'} / {vehicle.canonical.drivetrain ?? '—'})</span>
                    <span className="tabular-nums">{computed.mpgFactors.base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Age factor</span>
                    <span className="tabular-nums">{computed.mpgFactors.age.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Condition factor ({vehicle.user.conditionLevel})</span>
                    <span className="tabular-nums">{computed.mpgFactors.condition.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Usage factor ({assumptions.usagePattern.replace(/_/g, ' ')})</span>
                    <span className="tabular-nums">{computed.mpgFactors.usage.toFixed(2)}</span>
                  </div>
                </div>
              </details>
              <EditableField
                label="Override MPG"
                currentValue={vehicle.user.overrides.realisticMpg}
                computedValue={computed.realisticMpg}
                onSave={(v) => handleOverride('realisticMpg', v)}
                onClear={() => {
                  void applyVehicleUpdate({
                    'user.overrides.realisticMpg': undefined,
                  });
                }}
              />
            </div>
          </Section>

          {/* Cost Model */}
          <Section title="Monthly Cost Model">
            <div className="text-sm space-y-1">
              {/* Baseline tier */}
              <details className="group/baseline">
                <summary className="flex justify-between font-medium text-slate-800 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden items-center">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 group-open/baseline:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    Baseline monthly
                  </span>
                  <span className="tabular-nums">{formatCurrency(computed.baselineMonthly)}</span>
                </summary>
                <div className="mt-1 pl-4 space-y-0.5">
                  <div className="text-xs text-slate-400 mb-1">Recurring operating costs</div>
                  <CostLine label="Fuel" value={computed.fuelMonthly} />
                  <CostLine label="Routine maintenance" value={computed.routineMonthly} overridable onOverride={(v) => handleOverride('routineMonthly', v)} currentOverride={vehicle.user.overrides.routineMonthly} />
                  <CostLine label="Expected repairs" value={computed.expectedRepairsMonthly} overridable onOverride={(v) => handleOverride('expectedRepairsMonthly', v)} currentOverride={vehicle.user.overrides.expectedRepairsMonthly} />
                  {computed.registrationMonthly > 0 && (
                    <CostLine label="Registration & fees" value={computed.registrationMonthly} />
                  )}
                  {computed.parkingAndTollsMonthly > 0 && (
                    <CostLine label="Parking & tolls" value={computed.parkingAndTollsMonthly} />
                  )}
                </div>
              </details>

              {/* Insurance tier */}
              <details className="group/ins">
                <summary className="flex justify-between items-center text-slate-700 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 group-open/ins:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    Insurance
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums font-medium">{formatCurrency(computed.insuranceMonthly)}</span>
                    {vehicle.user.overrides.insuranceMonthly != null && (
                      <span className="text-[10px] text-violet-500 font-medium">override</span>
                    )}
                  </div>
                </summary>
                <div className="mt-1 pl-4 space-y-0.5">
                  <div className="text-xs text-slate-400 mb-1">
                    {insurance.coverageMode === 'full_coverage' ? 'Full coverage' : 'Liability only'}
                    {' · '}
                    {assumptions.driverAgeRange.replace(/_/g, '–').replace('under-', '<').replace('over-', '>')} · {assumptions.drivingRecord} record
                  </div>
                  <CostLine label="Liability" value={insurance.liabilityMonthly} />
                  {insurance.coverageMode === 'full_coverage' && (
                    <CostLine label="Comp + collision" value={insurance.compCollisionMonthly} />
                  )}
                </div>
              </details>

              {/* Reserve tier */}
              <details className="group/res">
                <summary className="flex justify-between items-center text-slate-700 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 group-open/res:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    Major repair reserve
                  </span>
                  <span className="tabular-nums font-medium italic text-slate-500">{formatCurrency(computed.majorRepairReserveMonthly)}</span>
                </summary>
                <div className="mt-1 pl-4 space-y-0.5">
                  <div className="text-xs text-slate-400">Expected major repair exposure over {assumptions.ownershipYears}-year horizon, amortized monthly</div>
                  <CostLine label="Major repair reserve" value={computed.majorRepairReserveMonthly} italic overridable onOverride={(v) => handleOverride('majorRepairReserveMonthly', v)} currentOverride={vehicle.user.overrides.majorRepairReserveMonthly} />
                </div>
              </details>

              {/* All-in tier */}
              <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-200 mt-2">
                <span>All-in monthly</span>
                <span className="tabular-nums">{formatCurrency(computed.allInMonthly)}</span>
              </div>
              <div className="text-xs text-slate-400">Baseline + Insurance + Reserve</div>
            </div>

            {/* Catch-up */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Catch-up cost / fees</span>
                <input
                  type="number"
                  className="w-24 text-right px-2 py-1 border border-slate-200 rounded text-sm tabular-nums"
                  value={vehicle.user.catchUpCost}
                  onChange={(e) => handleCatchUpChange(Number(e.target.value) || 0)}
                  min={0}
                  step={100}
                />
              </div>
            </div>

            {/* Aggregated */}
            <div className="mt-3 pt-3 border-t border-slate-200 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {isCurrentCar ? 'First-year operating cost' : 'First-year cost'}
                </span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.firstYearCost)}</span>
              </div>
              {isCurrentCar && (
                <div className="text-xs text-slate-400">Operating costs only — no purchase cost.</div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Total cost at {assumptions.ownershipYears}-year horizon</span>
                <span className="font-semibold tabular-nums">{formatCurrency(computed.totalCostAtHorizon)}</span>
              </div>
            </div>
          </Section>

          {/* Resale Model */}
          <Section title={isCurrentCar ? 'Depreciation Projection' : 'Resale Projection'}>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Current market value est.</span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.currentMarketValueEstimate)}</span>
              </div>
              <EditableField
                label="Override market value"
                currentValue={vehicle.user.overrides.currentMarketValue}
                computedValue={computed.currentMarketValueEstimate}
                onSave={(v) => handleOverride('currentMarketValue', v)}
                onClear={() => {
                  void applyVehicleUpdate({
                    'user.overrides.currentMarketValue': undefined,
                  });
                }}
              />
              <div className="flex justify-between">
                <span className="text-slate-600">Future value est. ({assumptions.ownershipYears}yr)</span>
                <span className="font-medium tabular-nums">{formatCurrency(computed.futureResaleValueEstimate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{isCurrentCar ? 'Depreciation' : 'Resale loss'}</span>
                <span className={`font-medium tabular-nums ${computed.resaleLoss > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {computed.resaleLoss > 0 ? '-' : '+'}{formatCurrency(Math.abs(computed.resaleLoss))}
                </span>
              </div>
              {isCurrentCar && (
                <div className="text-xs text-slate-400">Depreciation = current value minus projected future value. Added to total cost of keeping this vehicle.</div>
              )}
              <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500">
                <span className="font-medium text-slate-600">Profile: </span>
                {profileInfo?.label ?? vehicle.user.depreciationProfileId} — {profileInfo?.description ?? ''}
              </div>
            </div>
          </Section>

          {/* Capability */}
          {computed.dimensions['capability'] && (
            <Section title="Capability Score">
              <div className="text-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{computed.dimensions['capability'].value.toFixed(1)}</span>
                  <span className="text-slate-500">/10 — {computed.dimensions['capability'].label}</span>
                </div>
                <details className="mt-2 group/cap">
                  <summary className="text-xs text-slate-400 cursor-pointer select-none list-none flex items-center gap-1">
                    <span className="group-open/cap:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    Factor breakdown
                  </summary>
                  <div className="space-y-1 mt-1 pl-3">
                    {computed.dimensions['capability'].factors.map((f, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-600">{f.name}</span>
                        <span className="tabular-nums text-slate-500">+{f.impact.toFixed(1)} {f.note && <span className="text-slate-400">({f.note})</span>}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </Section>
          )}

          {/* Notes */}
          <Section title="Notes">
            <textarea
              className="w-full h-24 px-3 py-2 text-sm border border-slate-200 rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Add notes about this vehicle..."
              value={vehicle.user.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </Section>

          {/* Tags */}
          <Section title="Tags">
            <TagManager
              tags={vehicle.user.tags}
              onChange={(tags) => handleUserChange('tags', tags)}
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this vehicle?"
        message={`${vehicle.canonical.year} ${vehicle.canonical.make} ${vehicle.canonical.model}${vehicle.canonical.trim ? ' ' + vehicle.canonical.trim : ''} will be permanently removed from the board. This cannot be undone. Consider archiving instead if you want to keep the record.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          setConfirmDelete(false);
          const label = `${vehicle.canonical.year} ${vehicle.canonical.make} ${vehicle.canonical.model}`;
          await removeVehicle(vehicle.id);
          showToast(`Deleted ${label}`, 'success');
          closeDetailDrawer();
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmArchiveCurrentCar}
        title="Archive your current car?"
        message="This is marked as your current car. Archiving it will remove the sell scenario and the keep-vs-buy comparison will no longer work until you mark another vehicle as your current car."
        confirmLabel="Archive anyway"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          setConfirmArchiveCurrentCar(false);
          toggleArchive(vehicle.id, vehicle.user.archived);
        }}
        onCancel={() => setConfirmArchiveCurrentCar(false)}
      />
    </>
  );
}

function Section({ title, children, collapsible, defaultOpen = true }: { title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  if (collapsible) {
    return (
      <details open={defaultOpen || undefined} className="p-4 border-b border-slate-100 group">
        <summary className="text-sm font-semibold text-slate-800 cursor-pointer select-none list-none flex items-center gap-1">
          <span className="text-slate-400 group-open:rotate-90 transition-transform text-xs">&#9654;</span>
          {title}
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    );
  }
  return (
    <div className="p-4 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, meta }: { label: string; value: string; meta?: import('../../types').FieldMeta }) {
  return (
    <div className="p-2 bg-slate-50 rounded">
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {meta && <FieldStatusBadge meta={meta} />}
      </div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

const TITLE_STATUS_LABELS: Record<string, string> = {
  clean: 'Clean',
  salvage: 'Salvage',
  rebuilt: 'Rebuilt',
  lemon: 'Lemon',
  unknown: 'Unknown',
};

const CONDITION_LEVEL_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  average: 'Average',
  mild_mods: 'Mild mods / wear',
  poor: 'Poor / heavy mods',
};

const MODIFICATION_LEVEL_LABELS: Record<string, string> = {
  stock: 'Stock',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function EditableStatCard({
  label,
  rawValue,
  displayValue,
  meta,
  onSave,
  min,
  step,
}: {
  label: string;
  rawValue: number;
  displayValue: string;
  meta?: import('../../types').FieldMeta;
  onSave: (value: number) => void;
  min?: number;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(rawValue));

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed !== rawValue) {
      onSave(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-2 bg-white rounded ring-2 ring-blue-400">
        <div className="text-xs text-slate-500">{label}</div>
        <input
          autoFocus
          type="number"
          min={min}
          step={step}
          className="w-full mt-0.5 text-base font-semibold tabular-nums bg-transparent border-0 p-0 focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group/stat p-2 bg-slate-50 rounded hover:bg-slate-100 text-left transition-colors w-full cursor-pointer relative"
      onClick={() => {
        setDraft(String(rawValue));
        setEditing(true);
      }}
      title={`Edit ${label.toLowerCase()}`}
      aria-label={`Edit ${label.toLowerCase()}`}
    >
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {meta && <FieldStatusBadge meta={meta} />}
        <Pencil size={10} className="text-slate-300 opacity-0 group-hover/stat:opacity-100 transition-opacity ml-auto" />
      </div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{displayValue}</div>
    </button>
  );
}

function EditableFieldRow({ label, value, meta, onSave, options, inputType, displayTransform, placeholder, suffix, registerActiveEditor }: {
  label: string;
  value: string;
  meta?: import('../../types').FieldMeta;
  onSave: (value: string) => void | Promise<void>;
  options?: string[];
  inputType?: 'text' | 'number';
  displayTransform?: (v: string) => string;
  placeholder?: string;
  suffix?: string;
  registerActiveEditor?: (editor: ActiveDetailEditor | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isCommittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const displayed = value ? (displayTransform ? displayTransform(value) : value) : placeholder ?? '—';
  const displayOption = (option: string) => option ? (displayTransform ? displayTransform(option) : option) : '—';

  const commit = async (nextDraft = draft) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    try {
      if (nextDraft !== value) {
        await onSave(nextDraft);
      }
    } finally {
      isCommittingRef.current = false;
      setEditing(false);
    }
  };

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!registerActiveEditor) return;
    if (!editing || options) {
      registerActiveEditor(null);
      return;
    }

    registerActiveEditor({
      commitIfDirty: () => {
        const nextDraft = inputRef.current?.value ?? draft;
        return commit(nextDraft);
      },
    });

    return () => {
      registerActiveEditor(null);
    };
  }, [commit, draft, editing, options, registerActiveEditor]);

  const handleSelectChange = async (nextDraft: string) => {
    setDraft(nextDraft);
    if (nextDraft === value) {
      setEditing(false);
      return;
    }
    await commit(nextDraft);
  };

  if (editing) {
    return (
      <div className="flex justify-between items-start py-0.5">
        <span className="text-slate-500 text-xs pt-1">{label}</span>
        {options ? (
          <select
            autoFocus
            className="text-xs px-1.5 py-0.5 border border-blue-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={draft}
            onChange={(e) => {
              void handleSelectChange(e.currentTarget.value);
            }}
            onBlur={() => {
              if (!isCommittingRef.current) {
                setEditing(false);
              }
            }}
          >
            <option value="">—</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {displayOption(option)}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            ref={inputRef}
            type={inputType ?? 'text'}
            className="w-28 text-xs text-right px-1.5 py-0.5 border border-blue-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { void commit(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void commit();
              }
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 group/field"
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`${value ? 'text-slate-800' : 'text-slate-400'}`}>{displayed}{value && suffix ? suffix : ''}</span>
        <FieldStatusBadge meta={meta} />
        <Pencil size={10} className="text-slate-300 opacity-0 group-hover/field:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function TagManager({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (tags.some((existing) => existing.toLowerCase() === t)) {
      setDraft('');
      return;
    }
    onChange([...tags, t]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-slate-400 hover:text-red-500 cursor-pointer rounded-full hover:bg-slate-200 p-0.5"
              aria-label={`Remove tag ${tag}`}
              title={`Remove tag`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-slate-400 py-0.5">No tags yet</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a tag (e.g. awd, family, commute)…"
          className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="New tag"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!draft.trim()}
          className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CostLine({ label, value, italic, currentOverride }: {
  label: string;
  value: number;
  italic?: boolean;
  overridable?: boolean;
  onOverride?: (v: number) => void;
  currentOverride?: number;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-slate-600 ${italic ? 'italic' : ''}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`tabular-nums ${italic ? 'italic text-slate-500' : 'text-slate-700'}`}>
          {formatCurrency(value)}
        </span>
        {currentOverride != null && (
          <span className="text-[10px] text-violet-500 font-medium">override</span>
        )}
      </div>
    </div>
  );
}
