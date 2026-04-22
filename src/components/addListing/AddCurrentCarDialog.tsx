import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { useVehicleActions } from '../../hooks/useVehicleActions';
import { useVehicleLookup } from '../../hooks/useVehicleLookup';
import { inferDepreciationProfile } from '../../data/vehicleReference';
import { buildFieldMetaFromLookup } from '../../services/vehicleResolver';
import { DerivedInfoPreview } from './DerivedInfoPreview';
import type { VehicleRow, TitleStatus, Drivetrain, TransmissionType, ConditionLevel } from '../../types';

const CONDITION_OPTIONS: { value: ConditionLevel; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'average', label: 'Average' },
  { value: 'mild_mods', label: 'Mild mods / wear' },
  { value: 'poor', label: 'Poor / heavy mods' },
];

export function AddCurrentCarDialog() {
  const { isAddCurrentCarDialogOpen, closeAddCurrentCarDialog } = useUIStore();
  const showToast = useToastStore((s) => s.showToast);
  const { addVehicle } = useVehicleActions();

  const [year, setYear] = useState(2018);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [mileage, setMileage] = useState(0);
  const [drivetrain, setDrivetrain] = useState<Drivetrain>('awd');
  const [titleStatus, setTitleStatus] = useState<TitleStatus>('clean');
  const [transmission, setTransmission] = useState<TransmissionType>('automatic');
  const [condition, setCondition] = useState<ConditionLevel>('average');

  const lookup = useVehicleLookup(year, make, model, { trim, drivetrain, transmission });

  useEffect(() => {
    if (!isAddCurrentCarDialogOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddCurrentCarDialog();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isAddCurrentCarDialogOpen, closeAddCurrentCarDialog]);

  // Validation
  const validationErrors: string[] = [];
  if (!make.trim()) validationErrors.push('Make is required');
  if (!model.trim()) validationErrors.push('Model is required');
  if (mileage <= 0) validationErrors.push('Mileage must be greater than 0');
  if (year < 1990 || year > 2030) validationErrors.push('Year must be between 1990 and 2030');
  const canSave = validationErrors.length === 0;

  if (!isAddCurrentCarDialogOpen) return null;

  const handleSave = async () => {
    if (!canSave) return;

    const now = new Date().toISOString();

    // Build provenance from lookup
    const lookupMeta = buildFieldMetaFromLookup(lookup.data, lookup.isStaticFallback, lookup.epaOptionLabel);

    const vehicle: VehicleRow = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      listing: {
        source: 'manual',
        rawTitle: `${year} ${make} ${model}`,
        sellerType: 'private',
      },
      canonical: {
        year,
        make,
        model,
        trim: trim || undefined,
        drivetrain: lookup.data?.drivetrain ?? drivetrain,
        transmissionType: lookup.data?.transmissionType ?? transmission,
        engineType: lookup.data?.engineType ?? 'gas',
        vehicleClass: lookup.data?.vehicleClass,
        bodyStyle: lookup.data?.bodyStyle,
        epaCombinedMpg: lookup.data?.combinedMpg,
        cylinders: lookup.data?.cylinders,
      },
      user: {
        listingPrice: 0,
        mileage,
        titleStatus,
        conditionLevel: condition,
        catchUpCost: 0,
        notes: '',
        tags: [],
        pinned: false,
        archived: false,
        isCurrentCar: true,
        depreciationProfileId: inferDepreciationProfile(make, model, year, titleStatus),
        overrides: {},
      },
      fieldMeta: {
        year: { origin: 'extracted', confidence: 'high' },
        make: { origin: 'extracted', confidence: 'high' },
        model: { origin: 'extracted', confidence: 'high' },
        mileage: { origin: 'extracted', confidence: 'high' },
        listingPrice: { origin: 'assumed', confidence: 'high', note: 'Current car — no purchase cost' },
        ...lookupMeta,
      },
    };

    try {
      await addVehicle(vehicle);
      showToast(`Added your ${year} ${make} ${model}`, 'success');
      resetForm();
      closeAddCurrentCarDialog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add vehicle';
      showToast(msg, 'error');
    }
  };

  const resetForm = () => {
    setYear(2018);
    setMake('');
    setModel('');
    setTrim('');
    setMileage(0);
    setDrivetrain('awd');
    setTitleStatus('clean');
    setTransmission('automatic');
    setCondition('average');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={closeAddCurrentCarDialog} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[95vw] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-current-car-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id="add-current-car-title" className="text-lg font-semibold text-slate-900">Add Your Current Car</h2>
            <p className="text-xs text-slate-400 mt-0.5">Compare the cost of keeping it vs. buying something new</p>
          </div>
          <button onClick={closeAddCurrentCarDialog} className="p-1 hover:bg-slate-100 rounded cursor-pointer" aria-label="Close add current car dialog">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Year" required>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="form-input" min={1990} max={2030} />
            </Field>
            <Field label="Make" required>
              <input type="text" value={make} onChange={(e) => setMake(e.target.value)} className="form-input" placeholder="Honda" />
            </Field>
            <Field label="Model" required>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className="form-input" placeholder="CR-V" />
            </Field>
          </div>

          <DerivedInfoPreview
            status={lookup.status}
            data={lookup.data}
            candidates={lookup.candidates}
            selectedIndex={lookup.selectedIndex}
            onSelectCandidate={lookup.selectCandidate}
            isStaticFallback={lookup.isStaticFallback}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Trim">
              <input type="text" value={trim} onChange={(e) => setTrim(e.target.value)} className="form-input" placeholder="EX-L" />
            </Field>
            <Field label="Mileage" required>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                className={`form-input ${mileage <= 0 ? 'ring-1 ring-red-300 focus:ring-red-500' : ''}`}
                min={1}
                step={1000}
              />
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Drivetrain">
              <select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value as Drivetrain)} className="form-input">
                <option value="awd">AWD</option>
                <option value="4wd">4WD</option>
                <option value="fwd">FWD</option>
                <option value="rwd">RWD</option>
              </select>
            </Field>
            <Field label="Title Status">
              <select value={titleStatus} onChange={(e) => setTitleStatus(e.target.value as TitleStatus)} className="form-input">
                <option value="clean">Clean</option>
                <option value="rebuilt">Rebuilt</option>
                <option value="salvage">Salvage</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Transmission">
              <select value={transmission} onChange={(e) => setTransmission(e.target.value as TransmissionType)} className="form-input">
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="cvt">CVT</option>
              </select>
            </Field>
            <Field label="Condition">
              <select value={condition} onChange={(e) => setCondition(e.target.value as ConditionLevel)} className="form-input">
                {CONDITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-400 -mt-1">
            Condition is relative to what's normal for the vehicle's age and mileage — "excellent" on a 15-year-old car means well-maintained for its age, not like new.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200">
          {!canSave && (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              {validationErrors.join(' · ')}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 px-5 py-4">
            <button onClick={() => { resetForm(); closeAddCurrentCarDialog(); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add Current Car
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-label="required">*</span>}
      </label>
      {children}
    </div>
  );
}
