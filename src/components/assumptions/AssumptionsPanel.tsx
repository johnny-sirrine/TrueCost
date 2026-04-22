import { useEffect, useState, useMemo } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAssumptions } from '../../hooks/useAssumptions';
import { useAssumptionActions } from '../../hooks/useAssumptionActions';
import { useToastStore } from '../../store/toastStore';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { createDefaultAssumptions } from '../../data/defaultAssumptions';
import type { GlobalAssumptions } from '../../types';

export function AssumptionsPanel() {
  const { isAssumptionsPanelOpen, closeAssumptionsPanel } = useUIStore();
  const assumptions = useAssumptions();
  const { updateAssumption, resetToDefaults } = useAssumptionActions();
  const showToast = useToastStore((s) => s.showToast);
  const [confirmReset, setConfirmReset] = useState(false);

  const defaults = useMemo(() => createDefaultAssumptions(), []);

  const isChanged = (key: keyof GlobalAssumptions): boolean => {
    return assumptions[key] !== defaults[key];
  };

  const changedCount = useMemo(() => {
    return (Object.keys(defaults) as (keyof GlobalAssumptions)[])
      .filter((k) => k !== 'id' && assumptions[k] !== defaults[k]).length;
  }, [assumptions, defaults]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAssumptionsPanel();
    }
    if (isAssumptionsPanelOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isAssumptionsPanelOpen, closeAssumptionsPanel]);

  if (!isAssumptionsPanelOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={closeAssumptionsPanel} />
      <div
        className="fixed left-0 top-0 bottom-0 w-[380px] max-w-full bg-white shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assumptions-panel-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 id="assumptions-panel-title" className="text-lg font-semibold text-slate-900">Global Assumptions</h2>
            {changedCount > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {changedCount} {changedCount === 1 ? 'value' : 'values'} changed from defaults
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setConfirmReset(true)}
              disabled={changedCount === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Reset assumptions to defaults"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={closeAssumptionsPanel}
              className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"
              aria-label="Close assumptions panel"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup title="Driving">
            <NumberField
              label="Annual miles"
              value={assumptions.annualMiles}
              onChange={(v) => updateAssumption('annualMiles', v)}
              step={1000}
              min={1000}
              max={100000}
              suffix="mi/yr"
              changed={isChanged('annualMiles')}
            />
            <SelectField
              label="Usage pattern"
              value={assumptions.usagePattern}
              options={[
                { value: 'mostly_highway', label: 'Mostly highway' },
                { value: 'mixed', label: 'Mixed' },
                { value: 'city_heavy', label: 'City heavy' },
                { value: 'aggressive_short_trips', label: 'Aggressive / short trips' },
              ]}
              onChange={(v) => updateAssumption('usagePattern', v as GlobalAssumptions['usagePattern'])}
              changed={isChanged('usagePattern')}
            />
          </FieldGroup>

          <FieldGroup title="Fuel">
            <NumberField
              label="Gas price"
              value={assumptions.gasPrice}
              onChange={(v) => updateAssumption('gasPrice', v)}
              step={0.10}
              min={1}
              max={15}
              prefix="$"
              suffix="/gal"
              decimals={2}
              changed={isChanged('gasPrice')}
            />
          </FieldGroup>

          <FieldGroup title="Ownership">
            <NumberField
              label="Ownership horizon"
              value={assumptions.ownershipYears}
              onChange={(v) => updateAssumption('ownershipYears', v)}
              step={1}
              min={1}
              max={20}
              suffix="years"
              changed={isChanged('ownershipYears')}
            />
            <NumberField
              label="Sales tax rate"
              value={assumptions.salesTaxRate * 100}
              onChange={(v) => updateAssumption('salesTaxRate', v / 100)}
              step={0.25}
              min={0}
              max={15}
              suffix="%"
              decimals={2}
              changed={isChanged('salesTaxRate')}
            />
          </FieldGroup>

          <FieldGroup title="Insurance" helper="Rough estimate only. Override per vehicle for accuracy.">
            <SelectField
              label="Default coverage"
              value={assumptions.insuranceCoverageDefault}
              options={[
                { value: 'liability_only', label: 'Liability only' },
                { value: 'full_coverage', label: 'Full coverage' },
              ]}
              onChange={(v) => updateAssumption('insuranceCoverageDefault', v as GlobalAssumptions['insuranceCoverageDefault'])}
              changed={isChanged('insuranceCoverageDefault')}
            />
            <SelectField
              label="Driver age range"
              value={assumptions.driverAgeRange}
              options={[
                { value: 'under_25', label: 'Under 25' },
                { value: '25_39', label: '25\u201339' },
                { value: '40_65', label: '40\u201365' },
                { value: 'over_65', label: '65+' },
              ]}
              onChange={(v) => updateAssumption('driverAgeRange', v as GlobalAssumptions['driverAgeRange'])}
              changed={isChanged('driverAgeRange')}
            />
            <SelectField
              label="Driving record"
              value={assumptions.drivingRecord}
              options={[
                { value: 'clean', label: 'Clean' },
                { value: 'minor', label: 'Minor (1 ticket/incident)' },
                { value: 'major', label: 'Major (accident/DUI)' },
              ]}
              onChange={(v) => updateAssumption('drivingRecord', v as GlobalAssumptions['drivingRecord'])}
              changed={isChanged('drivingRecord')}
            />
          </FieldGroup>

          <FieldGroup title="Defaults">
            <SelectField
              label="Default condition"
              value={assumptions.defaultCondition}
              options={[
                { value: 'excellent', label: 'Excellent (stock)' },
                { value: 'average', label: 'Average used' },
                { value: 'mild_mods', label: 'Mild mods / wear' },
                { value: 'poor', label: 'Poor / heavy mods' },
              ]}
              onChange={(v) => updateAssumption('defaultCondition', v as GlobalAssumptions['defaultCondition'])}
              changed={isChanged('defaultCondition')}
            />
            <SelectField
              label="Optimism level"
              value={assumptions.optimismLevel}
              options={[
                { value: 'optimistic', label: 'Optimistic' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'conservative', label: 'Conservative' },
              ]}
              onChange={(v) => updateAssumption('optimismLevel', v as GlobalAssumptions['optimismLevel'])}
              changed={isChanged('optimismLevel')}
            />
          </FieldGroup>

          <FieldGroup title="Fixed Costs" helper="Same for any vehicle you'd drive. Set to $0 if not applicable.">
            <NumberField
              label="Annual registration & fees"
              value={assumptions.annualRegistrationFees}
              onChange={(v) => updateAssumption('annualRegistrationFees', v)}
              step={25}
              min={0}
              max={5000}
              prefix="$"
              suffix="/yr"
              changed={isChanged('annualRegistrationFees')}
            />
            <NumberField
              label="Monthly parking & tolls"
              value={assumptions.monthlyParkingAndTolls}
              onChange={(v) => updateAssumption('monthlyParkingAndTolls', v)}
              step={10}
              min={0}
              max={2000}
              prefix="$"
              suffix="/mo"
              changed={isChanged('monthlyParkingAndTolls')}
            />
          </FieldGroup>

          <FieldGroup title="Cost Model">
            <ToggleField
              label="Include major repair reserve in first-year cost"
              value={assumptions.includeMajorRepairReserveInFirstYear}
              onChange={(v) => updateAssumption('includeMajorRepairReserveInFirstYear', v)}
              changed={isChanged('includeMajorRepairReserveInFirstYear')}
            />
            <ToggleField
              label="Include major repair reserve in total cost"
              value={assumptions.includeMajorRepairReserveInTotalCost}
              onChange={(v) => updateAssumption('includeMajorRepairReserveInTotalCost', v)}
              changed={isChanged('includeMajorRepairReserveInTotalCost')}
            />
          </FieldGroup>

          <div className="px-4 py-3 text-xs text-slate-400">
            Changes apply immediately to all vehicles on the board.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all assumptions?"
        message={`This will restore ${changedCount} changed ${changedCount === 1 ? 'value' : 'values'} to defaults. Per-vehicle overrides are not affected.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={async () => {
          setConfirmReset(false);
          await resetToDefaults();
          showToast('Assumptions reset to defaults', 'success');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}

function FieldGroup({ title, children, helper }: { title: string; children: React.ReactNode; helper?: string }) {
  return (
    <section className="px-4 py-3 border-b border-slate-100 last:border-b-0">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">{title}</h3>
      <div className="space-y-2.5">{children}</div>
      {helper && (
        <p className="text-xs text-slate-400 mt-2 leading-snug">{helper}</p>
      )}
    </section>
  );
}

function ChangedDot({ changed }: { changed: boolean }) {
  if (!changed) return null;
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"
      title="Changed from default"
      aria-label="Changed from default"
    />
  );
}

function NumberField({
  label, value, onChange, step, min, max, prefix, suffix, decimals = 0, changed = false,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; prefix?: string; suffix?: string; decimals?: number;
  changed?: boolean;
}) {
  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };
  const outOfRange = (min !== undefined && value < min) || (max !== undefined && value > max);
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-slate-700 flex items-center gap-1.5">
        <ChangedDot changed={changed} />
        {label}
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
        <input
          type="number"
          className={`w-24 text-right px-2 py-1.5 border rounded text-sm tabular-nums focus:outline-none focus:ring-1 ${outOfRange ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'}`}
          value={decimals > 0 ? value.toFixed(decimals) : value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n)) onChange(n);
          }}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n)) {
              const clamped = clamp(n);
              if (clamped !== n) onChange(clamped);
            }
          }}
          step={step}
          min={min}
          max={max}
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange, changed = false,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  changed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-slate-700 flex items-center gap-1.5">
        <ChangedDot changed={changed} />
        {label}
      </label>
      <select
        className="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, value, onChange, changed = false }: { label: string; value: boolean; onChange: (v: boolean) => void; changed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-sm text-slate-700 flex items-center gap-1.5">
        <ChangedDot changed={changed} />
        {label}
      </label>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${value ? 'bg-blue-500' : 'bg-slate-200'}`}
        role="switch"
        aria-checked={value}
        aria-label={label}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
