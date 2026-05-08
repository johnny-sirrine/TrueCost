import { useState, useEffect } from 'react';
import { X, Link, FileText, PenLine } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { useVehicleActions } from '../../hooks/useVehicleActions';
import { useVehicleLookup } from '../../hooks/useVehicleLookup';
import { resolveAdapter } from '../../adapters';
import { detectSourceFromUrl } from '../../adapters/detectSource';
import { inferDepreciationProfile } from '../../data/vehicleReference';
import { buildFieldMetaFromLookup } from '../../services/vehicleResolver';
import { decodeVin, validateVin } from '../../services/vinDecoder';
import {
  getPastedTextSourceUrlWarningLines,
  isUnrecognizedPastedTextSourceUrl,
  resolveAddListingSource,
} from './sourceUrlFeedback';
import { DerivedInfoPreview } from './DerivedInfoPreview';
import type { VehicleRow, TitleStatus, Drivetrain, TransmissionType, ConditionLevel, ParseResult, FieldMeta } from '../../types';

type Tab = 'url' | 'text' | 'manual';

export function AddListingDialog() {
  const { isAddDialogOpen, closeAddDialog } = useUIStore();
  const showToast = useToastStore((s) => s.showToast);
  const { addVehicle } = useVehicleActions();

  const [tab, setTab] = useState<Tab>('text');
  const [pasteInput, setPasteInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [showTextSourceUrlWarning, setShowTextSourceUrlWarning] = useState(false);

  // Manual / review form state
  const [year, setYear] = useState<number | ''>(2020);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [price, setPrice] = useState(0);
  const [mileage, setMileage] = useState(0);
  const [drivetrain, setDrivetrain] = useState<Drivetrain>('awd');
  const [titleStatus, setTitleStatus] = useState<TitleStatus>('clean');
  const [transmission, setTransmission] = useState<TransmissionType>('automatic');
  const [sourceUrl, setSourceUrl] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<ConditionLevel>('average');

  // VIN decode state. `vin` holds the user input; `vinStatus` tracks the
  // decode request so we can show loading/error feedback; `vinDecodedFields`
  // tracks which form fields were populated by the decoder so we can stamp
  // provenance (`origin: 'external_lookup'`) when the user saves.
  const [vin, setVin] = useState('');
  const [vinStatus, setVinStatus] = useState<'idle' | 'loading' | 'decoded' | 'invalid' | 'error'>('idle');
  const [vinMessage, setVinMessage] = useState<string | null>(null);
  const [vinDecodedFields, setVinDecodedFields] = useState<Set<string>>(new Set());

  const lookupYear = typeof year === 'number' ? year : Number.NaN;
  const lookup = useVehicleLookup(lookupYear, make, model, { trim, drivetrain, transmission });

  const textSourceUrlWarnings = tab === 'text' && showTextSourceUrlWarning
    ? getPastedTextSourceUrlWarningLines(sourceUrl)
    : [];

  const resetForm = () => {
    setTab('text');
    setPasteInput('');
    setParseResult(null);
    setParseWarnings([]);
    setShowTextSourceUrlWarning(false);
    setYear(2020);
    setMake('');
    setModel('');
    setTrim('');
    setPrice(0);
    setMileage(0);
    setDrivetrain('awd');
    setTitleStatus('clean');
    setTransmission('automatic');
    setSourceUrl('');
    setLocation('');
    setCondition('average');
    setVin('');
    setVinStatus('idle');
    setVinMessage(null);
    setVinDecodedFields(new Set());
  };

  const handleClose = () => {
    resetForm();
    closeAddDialog();
  };

  useEffect(() => {
    if (!isAddDialogOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isAddDialogOpen, handleClose]);

  // Validation: required fields and reasonable bounds
  const validationErrors: string[] = [];
  if (year === '') validationErrors.push('Year is required');
  else if (year < 1990 || year > 2030) validationErrors.push('Year must be between 1990 and 2030');
  if (!make.trim()) validationErrors.push('Make is required');
  if (!model.trim()) validationErrors.push('Model is required');
  if (price <= 0) validationErrors.push('Price must be greater than $0');
  if (mileage <= 0) validationErrors.push('Mileage must be greater than 0');
  const canSave = validationErrors.length === 0;

  if (!isAddDialogOpen) return null;

  const resetReviewForm = (nextYear: number | '' = '') => {
    setYear(nextYear);
    setMake('');
    setModel('');
    setTrim('');
    setPrice(0);
    setMileage(0);
    setDrivetrain('awd');
    setTitleStatus('clean');
    setTransmission('automatic');
    setCondition('average');
    setLocation('');
    setVin('');
    setVinStatus('idle');
    setVinMessage(null);
    setVinDecodedFields(new Set());
  };

  const handleParse = async () => {
    const trimmedInput = pasteInput.trim();
    const existingSourceUrl = sourceUrl.trim();
    const adapter = resolveAdapter(trimmedInput);
    if (!adapter) {
      if (tab === 'url') {
        const detectedSource = detectSourceFromUrl(trimmedInput) ?? 'dealer';
        const warnings = [
          'Automatic extraction from pasted URLs is not supported yet.',
          'We only saved the source URL from this step.',
          detectedSource === 'dealer'
            ? 'This URL doesn’t match a supported source we can identify confidently.'
            : `Source detected from URL: ${detectedSource}.`,
          detectedSource === 'dealer'
            ? 'We kept the URL, but did not infer the source.'
            : 'Paste the listing text on the Text tab or enter the vehicle details manually before saving.',
          detectedSource === 'dealer'
            ? 'Continue by entering the vehicle details manually or pasting listing text on the Text tab.'
            : 'Paste the listing text on the Text tab or enter the vehicle details manually before saving.',
        ];

        resetReviewForm();
        setShowTextSourceUrlWarning(false);
        setParseResult({
          listing: {
            source: detectedSource,
            sourceUrl: trimmedInput,
          },
          canonical: {},
          fieldMeta: {},
          warnings,
        });
        setParseWarnings(warnings);
        setSourceUrl(trimmedInput);
        return;
      }

      setParseWarnings(['Could not determine how to parse this input.']);
      return;
    }
    const result = await adapter.parse(pasteInput);
    resetReviewForm();
    setParseResult(result);
    setParseWarnings(result.warnings);

    // Pre-fill only fields the adapter was actually confident about.
    // Everything else stays blank/default so the review step reflects
    // only what we truly know from the pasted input.
    if (result.canonical.year !== undefined) setYear(result.canonical.year);
    if (result.canonical.make) setMake(result.canonical.make);
    if (result.canonical.model) setModel(result.canonical.model);
    if (result.canonical.trim) setTrim(result.canonical.trim);
    if (result.canonical.drivetrain) setDrivetrain(result.canonical.drivetrain);
    if (result.canonical.transmissionType) setTransmission(result.canonical.transmissionType);
    if (result.suggestedPrice) setPrice(result.suggestedPrice);
    if (result.suggestedMileage) setMileage(result.suggestedMileage);
    if (result.suggestedTitleStatus === 'rebuilt' || result.suggestedTitleStatus === 'salvage' || result.suggestedTitleStatus === 'clean') {
      setTitleStatus(result.suggestedTitleStatus);
    }
    if (result.listing.sourceUrl && !existingSourceUrl) setSourceUrl(result.listing.sourceUrl);
    if (result.listing.location) setLocation(result.listing.location);
  };

  /** Decode the entered VIN and pre-fill empty form fields. We deliberately
   *  only populate fields that are still at their default/empty state —
   *  never overwrite a value the user typed. vPIC output is treated as
   *  high-signal hints but the EPA resolver remains the source of truth
   *  for MPG/class. */
  const handleVinDecode = async () => {
    const trimmed = vin.trim();
    if (!trimmed) {
      setVinStatus('idle');
      setVinMessage(null);
      return;
    }

    const validation = validateVin(trimmed);
    if (!validation.valid) {
      setVinStatus('invalid');
      setVinMessage(validation.reason ?? 'Invalid VIN');
      return;
    }

    setVinStatus('loading');
    setVinMessage(null);

    const decoded = await decodeVin(trimmed);
    if (!decoded) {
      setVinStatus('error');
      setVinMessage("Couldn't decode this VIN (NHTSA unreachable or unknown VIN).");
      return;
    }

    // Track which fields we populated so we can stamp provenance on save.
    const populated = new Set<string>();
    if (decoded.year && (year === '' || year === 2020)) {
      setYear(decoded.year);
      populated.add('year');
    }
    if (decoded.make && !make.trim()) {
      setMake(decoded.make);
      populated.add('make');
    }
    if (decoded.model && !model.trim()) {
      setModel(decoded.model);
      populated.add('model');
    }
    if (decoded.trim && !trim.trim()) {
      setTrim(decoded.trim);
      populated.add('trim');
    }
    if (decoded.drivetrain && drivetrain === 'awd') {
      setDrivetrain(decoded.drivetrain);
      populated.add('drivetrain');
    }
    setVinDecodedFields(populated);
    setVinStatus('decoded');
    setVinMessage(
      decoded.vpicErrorText && decoded.vpicErrorText !== '0'
        ? `Decoded with NHTSA notes: ${decoded.vpicErrorText}`
        : null,
    );
  };

  const handleSave = async () => {
    if (tab === 'text' && isUnrecognizedPastedTextSourceUrl(sourceUrl)) {
      setShowTextSourceUrlWarning(true);
    }
    if (!canSave) return;
    if (typeof year !== 'number') return;

    const vehicleYear = year;

    const now = new Date().toISOString();

    // Build provenance from lookup
    const lookupMeta = buildFieldMetaFromLookup(lookup.data, lookup.isStaticFallback, lookup.epaOptionLabel);

    const fieldMeta: Record<string, FieldMeta> = {
      ...parseResult?.fieldMeta,
      ...lookupMeta,
    };

    // Tag manual entries
    if (tab === 'manual') {
      ['year', 'make', 'model', 'listingPrice', 'mileage'].forEach((f) => {
        fieldMeta[f] = { origin: 'extracted', confidence: 'high' };
      });
      if (location.trim()) {
        fieldMeta.location = { origin: 'extracted', confidence: 'high' };
      }
    }

    // VIN-decoded fields take precedence over the 'extracted' tag above,
    // since the VIN decoder is a higher-trust external source than a
    // blank manual-entry default.
    const vinValidation = vin.trim() ? validateVin(vin.trim()) : null;
    if (vinValidation?.valid && vinValidation.normalized) {
      fieldMeta.vin = { origin: 'extracted', confidence: 'high' };
      for (const field of vinDecodedFields) {
        fieldMeta[field] = {
          origin: 'external_lookup',
          confidence: 'high',
          note: 'NHTSA vPIC VIN decoder',
        };
      }
    }

    // Source resolution, priority order:
    //   1. If the user typed a recognized Source URL, classify that URL.
    //   2. Otherwise fall back to whatever the adapter detected.
    //   3. Otherwise use the tab default for the entry path.
    const sourceUrlTrimmed = sourceUrl.trim();
    const resolvedSource = resolveAddListingSource({
      tab,
      sourceUrl,
      parsedListingSource: parseResult?.listing.source,
    });

    const vehicle: VehicleRow = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      listing: {
        source: resolvedSource,
        sourceUrl: sourceUrlTrimmed || parseResult?.listing.sourceUrl || undefined,
        rawTitle: parseResult?.listing.rawTitle ?? `${vehicleYear} ${make} ${model}`,
        rawDescription: parseResult?.listing.rawDescription,
        rawPrice: price,
        rawMileage: mileage,
        sellerType: 'unknown',
        location: location.trim() || parseResult?.listing.location || undefined,
        titleStatusRaw: titleStatus,
        vin: vinValidation?.valid ? vinValidation.normalized : undefined,
      },
      canonical: {
        year: vehicleYear,
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
        listingPrice: price,
        mileage,
        titleStatus,
        conditionLevel: condition,
        catchUpCost: 0,
        notes: '',
        tags: [],
        pinned: false,
        archived: false,
        isCurrentCar: false,
        depreciationProfileId: inferDepreciationProfile(make, model, vehicleYear, titleStatus),
        overrides: {},
      },
      fieldMeta,
    };

    try {
      await addVehicle(vehicle);
      showToast(`Added ${vehicleYear} ${make} ${model} to the board`, 'success');
      resetForm();
      closeAddDialog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add vehicle';
      showToast(msg, 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={handleClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[95vw] max-h-[90vh] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-listing-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="add-listing-title" className="text-lg font-semibold text-slate-900">Add Listing</h2>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded" aria-label="Close add listing dialog">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200" role="tablist" aria-label="Input method">
          {([
            { id: 'text' as Tab, label: 'Paste Text', icon: FileText },
            { id: 'url' as Tab, label: 'Paste URL', icon: Link },
            { id: 'manual' as Tab, label: 'Manual Entry', icon: PenLine },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setParseResult(null);
                setParseWarnings([]);
                setShowTextSourceUrlWarning(false);
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer ${
                tab === id
                  ? 'border-blue-500 text-blue-600 font-semibold bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
              role="tab"
              aria-selected={tab === id}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* URL or Text paste area */}
          {(tab === 'url' || tab === 'text') && !parseResult && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                {tab === 'url' ? (
                  <>
                    <div className="font-medium text-slate-700 mb-1">Supported listing sources</div>
                    <div>Paste a listing URL to capture its source and URL. Automatic extraction from listing pages is not supported yet in this version, so you'll fill in the vehicle details manually after continuing.</div>
                  </>
                ) : (
                  <>
                    <div className="font-medium text-slate-700 mb-1">Paste listing text</div>
                    <div>Paste any listing copy (title, price, mileage, description). We'll attempt to extract fields; you'll review and fix before saving.</div>
                  </>
                )}
              </div>
              <textarea
                className="w-full h-32 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                placeholder={tab === 'url'
                  ? 'https://www.example.com/listing/...'
                  : 'Example:\n2018 Honda CR-V EX-L AWD\n$22,500 \u00b7 48,000 miles\nClean title, one owner, well maintained...'}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
              />
              {tab === 'text' && (
                <FormField label="Source URL (optional)">
                  <OptionalSourceUrlField
                    value={sourceUrl}
                    onChange={(value) => {
                      setSourceUrl(value);
                      setShowTextSourceUrlWarning(false);
                    }}
                    onBlur={() => setShowTextSourceUrlWarning(true)}
                    warningLines={textSourceUrlWarnings}
                  />
                </FormField>
              )}
              <button
                onClick={handleParse}
                disabled={!pasteInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {tab === 'url' ? 'Continue' : 'Parse'}
              </button>
            </div>
          )}

          {/* Warnings from parsing */}
          {parseWarnings.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm font-medium text-amber-800 mb-1">Parser Notes</div>
              {parseWarnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-700">{w}</div>
              ))}
            </div>
          )}

          {/* Form (always shown for manual, shown after parse for URL/text) */}
          {(tab === 'manual' || parseResult) && (
            <div className="space-y-4">
              {tab !== 'manual' && (
                <div className="text-xs text-slate-500 mb-2">
                  {tab === 'url'
                    ? 'URL paste currently saves the source URL only. Fill in the vehicle details below before saving.'
                    : 'Review and correct the extracted fields below before saving.'}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Year" required>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                    className="form-input"
                    min={1990}
                    max={2030}
                    placeholder="2018"
                  />
                </FormField>
                <FormField label="Make" required>
                  <input type="text" value={make} onChange={(e) => setMake(e.target.value)} className="form-input" placeholder="Toyota" />
                </FormField>
                <FormField label="Model" required>
                  <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className="form-input" placeholder="4Runner" />
                </FormField>
              </div>

              <FormField label="VIN (optional)">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => {
                      setVin(e.target.value.toUpperCase());
                      if (vinStatus !== 'idle') {
                        setVinStatus('idle');
                        setVinMessage(null);
                      }
                    }}
                    onBlur={handleVinDecode}
                    className={`form-input font-mono uppercase tracking-wider ${
                      vinStatus === 'invalid' || vinStatus === 'error'
                        ? 'ring-1 ring-amber-300'
                        : ''
                    }`}
                    placeholder="1HGCM82633A004352"
                    maxLength={17}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {vinStatus === 'loading' && (
                    <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                </div>
                {vinMessage && (
                  <p className={`text-xs mt-1 ${
                    vinStatus === 'invalid' || vinStatus === 'error'
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}>
                    {vinMessage}
                  </p>
                )}
                {vinStatus === 'decoded' && vinDecodedFields.size > 0 && (
                  <p className="text-xs mt-1 text-emerald-600">
                    Decoded {Array.from(vinDecodedFields).join(', ')} from VIN.
                  </p>
                )}
              </FormField>

              <DerivedInfoPreview
                status={lookup.status}
                data={lookup.data}
                candidates={lookup.candidates}
                selectedIndex={lookup.selectedIndex}
                onSelectCandidate={lookup.selectCandidate}
                isStaticFallback={lookup.isStaticFallback}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Trim">
                  <input type="text" value={trim} onChange={(e) => setTrim(e.target.value)} className="form-input" placeholder="EX-L" />
                </FormField>
                <FormField label="Price ($)" required>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className={`form-input ${price <= 0 ? 'ring-1 ring-red-300 focus:ring-red-500' : ''}`}
                    min={1}
                    step={100}
                  />
                </FormField>
                <FormField label="Mileage" required>
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(Number(e.target.value))}
                    className={`form-input ${mileage <= 0 ? 'ring-1 ring-red-300 focus:ring-red-500' : ''}`}
                    min={1}
                    step={1000}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <FormField label="Drivetrain">
                  <select value={drivetrain} onChange={(e) => setDrivetrain(e.target.value as Drivetrain)} className="form-input">
                    <option value="awd">AWD</option>
                    <option value="4wd">4WD</option>
                    <option value="fwd">FWD</option>
                    <option value="rwd">RWD</option>
                  </select>
                </FormField>
                <FormField label="Title Status">
                  <select value={titleStatus} onChange={(e) => setTitleStatus(e.target.value as TitleStatus)} className="form-input">
                    <option value="clean">Clean</option>
                    <option value="rebuilt">Rebuilt</option>
                    <option value="salvage">Salvage</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </FormField>
                <FormField label="Transmission">
                  <select value={transmission} onChange={(e) => setTransmission(e.target.value as TransmissionType)} className="form-input">
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                    <option value="cvt">CVT</option>
                  </select>
                </FormField>
                <FormField label="Condition">
                  <select value={condition} onChange={(e) => setCondition(e.target.value as ConditionLevel)} className="form-input">
                    <option value="excellent">Excellent</option>
                    <option value="average">Average</option>
                    <option value="mild_mods">Mild mods / wear</option>
                    <option value="poor">Poor / heavy mods</option>
                  </select>
                </FormField>
              </div>
              <p className="text-xs text-slate-400 -mt-2">
                Condition is relative to what's typical for the vehicle's age and mileage — "excellent" means well-maintained for its age, not like new.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Location (optional)">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="form-input"
                    placeholder="Salt Lake City, UT"
                  />
                </FormField>
                <FormField label="Source URL (optional)">
                  <OptionalSourceUrlField
                    value={sourceUrl}
                    onChange={(value) => {
                      setSourceUrl(value);
                      if (tab === 'text') setShowTextSourceUrlWarning(false);
                    }}
                    onBlur={() => {
                      if (tab === 'text') setShowTextSourceUrlWarning(true);
                    }}
                    warningLines={tab === 'text' ? textSourceUrlWarnings : []}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(tab === 'manual' || parseResult) && (
          <div className="border-t border-slate-200">
            {!canSave && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                {validationErrors.join(' · ')}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 px-5 py-4">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Add to Board
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
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

function OptionalSourceUrlField({
  value,
  onChange,
  onBlur,
  warningLines,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  warningLines: string[];
}) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="form-input"
        placeholder="https://..."
      />
      {warningLines.length > 0 && (
        <div className="mt-2 space-y-1">
          {warningLines.map((line) => (
            <p key={line} className="text-xs text-amber-700">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
