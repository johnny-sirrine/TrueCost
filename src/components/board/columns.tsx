import { createColumnHelper } from '@tanstack/react-table';
import { useState } from 'react';
import { Star, Pin, Trash2 } from 'lucide-react';
import type { ComputedVehicle } from '../../hooks/useComputedBoard';
import type { GlobalAssumptions } from '../../types';
import { formatCurrency, formatMiles, formatMpg } from '../../lib/formatters';
import { DEAL_QUALITY_COLORS, LISTING_SOURCE_LABELS } from '../../lib/constants';
import { CellTooltip } from './CellTooltip';
import { InlineEditableCell } from './InlineEditableCell';

const col = createColumnHelper<ComputedVehicle>();

export interface BoardTableMeta {
  openDetailDrawer: (vehicleId: string) => void;
  assumptions: GlobalAssumptions;
  onRatingChange: (vehicleId: string, rating: number | undefined) => void;
  onLocationChange: (vehicleId: string, location: string) => Promise<void> | void;
  onNotesChange: (vehicleId: string, notes: string) => Promise<void> | void;
  onDeleteVehicle: (vehicleId: string) => void;
  onTogglePin: (vehicleId: string, currentPinned: boolean) => void;
}

/** Row of 5 stars with a hover preview: hovering star N paints 1..N amber.
 *  Clicking star N sets the rating to N (or clears it if N was already the
 *  current rating). Kept as a local component so the hover state is
 *  per-row and doesn't force re-render of the whole table. */
function RatingStars({
  rating,
  onChange,
}: {
  rating: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // When hovering, the preview wins over the saved rating.
  const effective = hovered ?? rating ?? 0;
  return (
    <div
      className="flex gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= effective;
        return (
          <button
            key={s}
            onClick={() => onChange(rating === s ? undefined : s)}
            onMouseEnter={() => setHovered(s)}
            onFocus={() => setHovered(s)}
            onBlur={() => setHovered(null)}
            className="p-0 cursor-pointer hover:scale-110 transition-transform"
            aria-label={`Rate ${s} star${s === 1 ? '' : 's'}`}
            aria-pressed={s <= (rating ?? 0)}
          >
            <Star
              size={14}
              className={
                filled
                  ? hovered !== null
                    ? 'fill-amber-300 text-amber-300'
                    : 'fill-amber-400 text-amber-400'
                  : 'text-slate-300'
              }
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

/** Summary-column → component-column relationships. The parent is a
 *  regular leaf column that computes its own value; the children are
 *  also leaves that are hidden by default and surfaced via a chevron
 *  on the parent's header. Keep the child order matching visual
 *  left-to-right order in the table so re-ordering the `boardColumns`
 *  array stays in sync with this map. */
export const COLUMN_FAMILIES: Record<string, string[]> = {
  allIn: ['insurance', 'baseline'],
  firstYear: ['salesTax'],
  totalCost: ['resaleLoss'],
};

/** Reverse lookup: child id → parent id. Computed once. Used by the
 *  toolbar dropdown to group children visually under their parent. */
export const CHILD_TO_PARENT: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_FAMILIES).flatMap(([parent, children]) =>
    children.map((child) => [child, parent]),
  ),
);

const fc = formatCurrency;

// Column header descriptions for tooltips
const H: Record<string, string> = {
  source: 'Where the listing was found. Click to visit original listing.',
  vehicle: 'Year, make, model, trim. Click to open full details.',
  location: 'Listing location from the source when available. Blank means it was not provided.',
  notes: 'Your notes for this vehicle. Wraps in the table, shows up to 4 lines, and can be edited inline.',
  rating: 'Your personal rating. Click a star to rate, click again to clear.',
  price: 'Seller\'s asking price before tax.',
  salesTax: 'Sales tax on purchase price, based on your configured rate.',
  mileage: 'Current odometer reading.',
  drivetrain: 'Drive configuration (AWD, 4WD, FWD, RWD).',
  mpg: 'Estimated real-world fuel economy, adjusted for age, condition, and driving pattern.',
  insurance: 'Estimated monthly insurance cost. Rough estimate based on coverage type, vehicle value, and driver demographics.',
  baseline: 'Monthly operating cost: fuel + routine maintenance + expected repairs + registration + parking/tolls.',
  allIn: 'Baseline + insurance + a prudent monthly reserve for major repairs.',
  firstYear: 'Total first-year outlay: purchase + tax + 12 months all-in operating + catch-up.',
  resaleLoss: 'Projected change in value: purchase cost (incl. tax) minus estimated future resale.',
  totalCost: 'Total ownership cost: operating expenses plus net resale loss (or minus gain).',
  capability: 'Off-road / rough-road capability score (0–10).',
  deal: 'Deal quality based on price vs. market value, mileage, title, and retention.',
  fuel: 'Monthly fuel cost: annual miles ÷ MPG × gas price ÷ 12.',
  routine: 'Monthly routine maintenance: oil, tires, brakes, filters.',
  repairs: 'Monthly expected repair costs based on vehicle age and condition.',
  reserve: 'Monthly set-aside for major repairs, spread over ownership horizon.',
  catchUp: 'One-time costs: deferred maintenance, dealer fees not in sticker price, etc.',
  resale: 'Estimated private-party resale value at end of ownership horizon.',
  confidence: 'Data confidence based on field provenance (extracted, inferred, assumed).',
};

function Hdr({ label, tip }: { label: string; tip?: string }) {
  if (!tip) return <>{label}</>;
  return <CellTooltip content={tip}><span>{label}</span></CellTooltip>;
}

/** Muted "/mo" suffix used on every monthly-cost cell value. Mirrors the
 *  column-header convention ("Ins./mo", "Baseline/mo", etc.) so the value
 *  carries its unit too. Kept small and de-emphasized so it doesn't crowd
 *  the number. */
function PerMo() {
  return <span className="text-[10px] text-slate-400 ml-0.5">/mo</span>;
}

export const boardColumns = [
  col.display({
    id: 'pin',
    header: '',
    size: 36,
    cell: ({ row, table }) => {
      const meta = table.options.meta as BoardTableMeta;
      const v = row.original.vehicle;
      const pinned = v.user.pinned;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            meta.onTogglePin(v.id, pinned);
          }}
          className={`p-1 -m-1 rounded cursor-pointer transition-colors ${
            pinned ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400'
          }`}
          aria-label={pinned ? 'Unpin vehicle' : 'Pin vehicle'}
          aria-pressed={pinned}
          title={pinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin size={14} aria-hidden="true" />
        </button>
      );
    },
  }),

  col.accessor((r) => r.vehicle.listing.source, {
    id: 'source',
    header: () => <Hdr label="Source" tip={H.source} />,
    size: 80,
    cell: ({ row }) => {
      const { source, sourceUrl } = row.original.vehicle.listing;
      const label = LISTING_SOURCE_LABELS[source] ?? source;
      if (sourceUrl) {
        return (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
        );
      }
      return <span className="text-xs text-slate-500">{label}</span>;
    },
  }),

  col.accessor(
    (r) => `${r.vehicle.canonical.year} ${r.vehicle.canonical.make} ${r.vehicle.canonical.model}`,
    {
      id: 'vehicle',
      header: () => <Hdr label="Vehicle" tip={H.vehicle} />,
      size: 220,
      minSize: 180,
      maxSize: 420,
      enableResizing: true,
      cell: ({ row, table }) => {
        const { year, make, model, trim } = row.original.vehicle.canonical;
        const { titleStatus } = row.original.vehicle.user;
        const meta = table.options.meta as BoardTableMeta;
        return (
          <div
            className="flex flex-col cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              meta.openDetailDrawer(row.original.vehicle.id);
            }}
          >
            <span className="font-medium text-slate-900 group-hover:text-blue-700 group-hover:underline">
              {year} {make} {model}
              {trim && <span className="text-slate-500 font-normal"> {trim}</span>}
            </span>
            <div className="flex items-center gap-1.5">
              {titleStatus !== 'clean' && (
                <span className="text-xs text-amber-600 font-medium">{titleStatus} title</span>
              )}
            </div>
          </div>
        );
      },
    },
  ),

  col.accessor((r) => r.vehicle.listing.location, {
    id: 'location',
    header: () => <Hdr label="Location" tip={H.location} />,
    size: 140,
    minSize: 120,
    maxSize: 280,
    enableResizing: true,
    cell: ({ row, getValue, table }) => {
      const location = getValue();
      const meta = table.options.meta as BoardTableMeta;
      if (row.original.vehicle.user.isCurrentCar) {
        return <span className="text-xs text-slate-400">{location ?? '—'}</span>;
      }
      return (
        <InlineEditableCell
          value={location ?? ''}
          placeholder="Add location"
          onSave={(nextValue) => meta.onLocationChange(row.original.vehicle.id, nextValue)}
        />
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.userRating ?? 0, {
    id: 'rating',
    header: () => <Hdr label="My Rating" tip={H.rating} />,
    size: 100,
    cell: ({ row, table }) => {
      const meta = table.options.meta as BoardTableMeta;
      const rating = row.original.vehicle.user.userRating;
      return (
        <RatingStars
          rating={rating}
          onChange={(next) => meta.onRatingChange(row.original.vehicle.id, next)}
        />
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.listingPrice, {
    id: 'price',
    header: () => <Hdr label="Price" tip={H.price} />,
    size: 90,
    cell: ({ row, table }) => {
      const v = row.original.vehicle;
      if (v.user.isCurrentCar) {
        return <CellTooltip content="Current car — no purchase cost."><span className="text-slate-400">—</span></CellTooltip>;
      }
      const meta = table.options.meta as BoardTableMeta;
      const price = v.user.listingPrice;
      const rate = meta.assumptions.salesTaxRate;
      const tip = `Listing price. With ${(rate * 100).toFixed(1)}% sales tax: ${fc(price * (1 + rate))} effective purchase cost.`;
      return (
        <CellTooltip content={tip}>
          <span className="font-medium tabular-nums">{fc(price)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.mileage, {
    id: 'mileage',
    header: () => <Hdr label="Miles" tip={H.mileage} />,
    size: 100,
    cell: ({ row }) => {
      const v = row.original.vehicle;
      const age = new Date().getFullYear() - v.canonical.year;
      const expected = Math.min(age * 12000, 180000);
      const diff = v.user.mileage - expected;
      const label = diff > 10000 ? 'high' : diff < -10000 ? 'low' : 'average';
      const tip = `${formatMiles(v.user.mileage)} on a ${age}-year-old vehicle. Expected ~${formatMiles(expected)} for age (${label}).`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{formatMiles(v.user.mileage)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.vehicle.canonical.drivetrain, {
    id: 'drivetrain',
    header: () => <Hdr label="Drive" tip={H.drivetrain} />,
    size: 60,
    cell: ({ getValue }) => (
      <span className="text-xs uppercase text-slate-500">{getValue() ?? '—'}</span>
    ),
  }),

  col.accessor((r) => r.computed.realisticMpg, {
    id: 'mpg',
    header: () => <Hdr label="MPG" tip={H.mpg} />,
    size: 75,
    cell: ({ row }) => {
      const c = row.original.computed;
      const epa = row.original.vehicle.canonical.epaCombinedMpg;
      const tip = epa
        ? `EPA combined: ${epa}. Adjusted to ${c.realisticMpg.toFixed(1)} for age, condition, and driving pattern.`
        : `Estimated ${c.realisticMpg.toFixed(1)} mpg based on vehicle class and driving pattern.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{formatMpg(c.realisticMpg)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.insuranceMonthly, {
    id: 'insurance',
    header: () => <Hdr label="Ins./mo" tip={H.insurance} />,
    size: 85,
    cell: ({ row }) => {
      const c = row.original.computed;
      const v = row.original.vehicle;
      const isOverride = v.user.overrides.insuranceMonthly !== undefined;
      const tip = isOverride
        ? `User override: ${fc(c.insuranceMonthly)}/mo.`
        : `Rough estimate: ${fc(c.insuranceMonthly)}/mo. Based on coverage type, vehicle value, and driver demographics.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">
            {fc(c.insuranceMonthly)}
            {isOverride && <span className="text-[10px] text-violet-500 ml-0.5">*</span>}
            <PerMo />
          </span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.baselineMonthly, {
    id: 'baseline',
    header: () => <Hdr label="Baseline/mo" tip={H.baseline} />,
    size: 105,
    cell: ({ row }) => {
      const c = row.original.computed;
      const parts = [`Fuel ${fc(c.fuelMonthly)}`, `Routine ${fc(c.routineMonthly)}`, `Repairs ${fc(c.expectedRepairsMonthly)}`];
      if (c.registrationMonthly > 0) parts.push(`Reg ${fc(c.registrationMonthly)}`);
      if (c.parkingAndTollsMonthly > 0) parts.push(`Parking ${fc(c.parkingAndTollsMonthly)}`);
      const tip = `${parts.join(' + ')} = ${fc(c.baselineMonthly)}/mo.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums font-medium text-slate-800">{fc(c.baselineMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.allInMonthly, {
    id: 'allIn',
    header: () => <Hdr label="All-In/mo" tip={H.allIn} />,
    size: 95,
    cell: ({ row }) => {
      const c = row.original.computed;
      const tip = `Baseline ${fc(c.baselineMonthly)} + Insurance ${fc(c.insuranceMonthly)} + Reserve ${fc(c.majorRepairReserveMonthly)} = ${fc(c.allInMonthly)}/mo.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums font-medium text-slate-700">{fc(c.allInMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.listingPrice, {
    id: 'salesTax',
    header: () => <Hdr label="Tax" tip={H.salesTax} />,
    size: 75,
    cell: ({ row, table }) => {
      const v = row.original.vehicle;
      if (v.user.isCurrentCar) {
        return <span className="text-slate-400">—</span>;
      }
      const meta = table.options.meta as BoardTableMeta;
      const price = v.user.listingPrice;
      const rate = meta.assumptions.salesTaxRate;
      const tax = Math.round(price * rate);
      const tip = `${(rate * 100).toFixed(1)}% sales tax on ${fc(price)}. Included in 1st year cost and resale loss calculation.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-500">{fc(tax)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.firstYearCost, {
    id: 'firstYear',
    header: () => <Hdr label="1st Year Cost" tip={H.firstYear} />,
    size: 95,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const v = row.original.vehicle;
      const meta = table.options.meta as BoardTableMeta;
      const isCurrentCar = v.user.isCurrentCar;
      let tip: string;
      if (isCurrentCar) {
        const ops = (c.baselineMonthly + c.insuranceMonthly) * 12;
        const catchUp = v.user.catchUpCost;
        tip = `12mo operating ${fc(ops)}`;
        if (catchUp > 0) tip += ` + Catch-up ${fc(catchUp)}`;
        tip += ` = ${fc(c.firstYearCost)}. No purchase cost (current car).`;
      } else {
        const tax = Math.round(v.user.listingPrice * meta.assumptions.salesTaxRate);
        const ops = (c.baselineMonthly + c.insuranceMonthly) * 12;
        const catchUp = v.user.catchUpCost;
        tip = `Purchase ${fc(v.user.listingPrice)} + Tax ${fc(tax)} + 12mo operating ${fc(ops)}`;
        if (catchUp > 0) tip += ` + Catch-up ${fc(catchUp)}`;
        tip += ` = ${fc(c.firstYearCost)}`;
      }
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums font-medium">{fc(c.firstYearCost)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.resaleLoss, {
    id: 'resaleLoss',
    header: () => <Hdr label="Resale Loss" tip={H.resaleLoss} />,
    size: 100,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const v = row.original.vehicle;
      const meta = table.options.meta as BoardTableMeta;
      const isCurrentCar = v.user.isCurrentCar;
      let tip: string;
      if (isCurrentCar) {
        tip = `Current value ${fc(c.currentMarketValueEstimate)} → Future ${fc(c.futureResaleValueEstimate)}. Depreciation: ${fc(c.resaleLoss)}.`;
      } else {
        const effective = v.user.listingPrice * (1 + meta.assumptions.salesTaxRate);
        const label = c.resaleLoss > 0 ? 'Loss' : 'Gain';
        tip = `Paid ${fc(effective)} (incl. tax). Est. future value ${fc(c.futureResaleValueEstimate)}. ${label}: ${fc(Math.abs(c.resaleLoss))}.`;
      }
      return (
        <CellTooltip content={tip}>
          <span className={`tabular-nums ${c.resaleLoss > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {c.resaleLoss > 0 ? '-' : '+'}{fc(Math.abs(c.resaleLoss))}
          </span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.totalCostAtHorizon, {
    id: 'totalCost',
    header: ({ table }) => {
      const meta = table.options.meta as BoardTableMeta;
      const label = `${meta.assumptions.ownershipYears}-Year Cost`;
      return <Hdr label={label} tip={H.totalCost} />;
    },
    size: 110,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const meta = table.options.meta as BoardTableMeta;
      const yrs = meta.assumptions.ownershipYears;
      const ops = c.totalCostAtHorizon - c.resaleLoss;
      const resaleLabel = c.resaleLoss >= 0 ? `+ Resale loss ${fc(c.resaleLoss)}` : `− Resale gain ${fc(Math.abs(c.resaleLoss))}`;
      const tip = `${yrs}yr operating ${fc(ops)} ${resaleLabel} = ${fc(c.totalCostAtHorizon)} total ownership cost.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums font-semibold">{fc(c.totalCostAtHorizon)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.dimensions['capability']?.value ?? 0, {
    id: 'capability',
    header: () => <Hdr label="Capability" tip={H.capability} />,
    size: 95,
    cell: ({ row }) => {
      const dim = row.original.computed.dimensions['capability'];
      if (!dim) return <span className="text-slate-400">—</span>;
      const tip = dim.factors.map(f => `${f.name}: ${f.impact > 0 ? '+' : ''}${f.impact.toFixed(1)}${f.note ? ` (${f.note})` : ''}`).join('. ') || `Capability score: ${dim.value.toFixed(1)}/10.`;
      return (
        <CellTooltip content={tip}>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums font-medium">{dim.value.toFixed(1)}</span>
            <span className="text-xs text-slate-500">{dim.label}</span>
          </div>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.dealQuality, {
    id: 'deal',
    header: () => <Hdr label="Deal Rating" tip={H.deal} />,
    size: 100,
    cell: ({ row }) => {
      if (row.original.vehicle.user.isCurrentCar) {
        return <span className="text-xs text-slate-400">N/A</span>;
      }
      const quality = row.original.computed.dealQuality;
      const explanations = row.original.computed.dealExplanation;
      const colorClass = DEAL_QUALITY_COLORS[quality] ?? 'bg-slate-100 text-slate-600';
      const tip = explanations.join('. ') + '.';
      return (
        <CellTooltip content={tip}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
            {quality}
          </span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.notes, {
    id: 'notes',
    header: () => <Hdr label="Notes" tip={H.notes} />,
    size: 220,
    minSize: 180,
    maxSize: 480,
    enableResizing: true,
    cell: ({ row, getValue, table }) => {
      const meta = table.options.meta as BoardTableMeta;
      const notes = getValue() ?? '';
      return (
        <InlineEditableCell
          value={notes}
          placeholder="Add notes"
          multiline
          maxDisplayLines={4}
          onSave={(nextValue) => meta.onNotesChange(row.original.vehicle.id, nextValue)}
        />
      );
    },
  }),

  // Detail cost columns (hidden by default, available in column picker)
  col.accessor((r) => r.computed.fuelMonthly, {
    id: 'fuel',
    header: () => <Hdr label="Fuel/mo" tip={H.fuel} />,
    size: 85,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const meta = table.options.meta as BoardTableMeta;
      const miles = row.original.vehicle.user.overrides.annualMiles ?? meta.assumptions.annualMiles;
      const tip = `${(miles / 1000).toFixed(0)}k mi/yr ÷ ${c.realisticMpg.toFixed(1)} mpg × $${meta.assumptions.gasPrice.toFixed(2)}/gal ÷ 12`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{fc(c.fuelMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.routineMonthly, {
    id: 'routine',
    header: () => <Hdr label="Routine/mo" tip={H.routine} />,
    size: 95,
    cell: ({ row }) => {
      const c = row.original.computed;
      const tip = `Routine maintenance (oil, tires, brakes, filters) for a ${row.original.vehicle.canonical.vehicleClass?.replace(/_/g, ' ') ?? 'vehicle'} at ${formatMiles(row.original.vehicle.user.mileage)}.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{fc(c.routineMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.expectedRepairsMonthly, {
    id: 'repairs',
    header: () => <Hdr label="Repairs/mo" tip={H.repairs} />,
    size: 95,
    cell: ({ row }) => {
      const c = row.original.computed;
      const age = new Date().getFullYear() - row.original.vehicle.canonical.year;
      const tip = `Expected repair costs for a ${age}-year-old vehicle in ${row.original.vehicle.user.conditionLevel} condition.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{fc(c.expectedRepairsMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.majorRepairReserveMonthly, {
    id: 'reserve',
    header: () => <Hdr label="Reserve/mo" tip={H.reserve} />,
    size: 95,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const meta = table.options.meta as BoardTableMeta;
      const tip = `Monthly set-aside for major repairs (engine, transmission, suspension). Spread over ${meta.assumptions.ownershipYears}-year ownership horizon.`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-500 italic">{fc(c.majorRepairReserveMonthly)}<PerMo /></span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.vehicle.user.catchUpCost, {
    id: 'catchUp',
    header: () => <Hdr label="Catch-Up / Fees" tip={H.catchUp} />,
    size: 85,
    cell: ({ getValue }) => {
      const v = getValue();
      return (
        <span className="tabular-nums text-slate-500">
          {v > 0 ? fc(v) : '—'}
        </span>
      );
    },
  }),

  col.accessor((r) => r.computed.futureResaleValueEstimate, {
    id: 'resale',
    header: () => <Hdr label="Resale Est." tip={H.resale} />,
    size: 95,
    cell: ({ row, table }) => {
      const c = row.original.computed;
      const meta = table.options.meta as BoardTableMeta;
      const tip = `Current market est. ${fc(c.currentMarketValueEstimate)}. Projected to retain value over ${meta.assumptions.ownershipYears} years → ${fc(c.futureResaleValueEstimate)} (after 8% realization discount).`;
      return (
        <CellTooltip content={tip}>
          <span className="tabular-nums text-slate-600">{fc(c.futureResaleValueEstimate)}</span>
        </CellTooltip>
      );
    },
  }),

  col.accessor((r) => r.computed.confidence, {
    id: 'confidence',
    header: () => <Hdr label="Conf." tip={H.confidence} />,
    size: 55,
    cell: ({ row }) => {
      const conf = row.original.computed.confidence;
      const dotColors: Record<string, string> = { high: 'bg-emerald-400', medium: 'bg-amber-400', low: 'bg-red-400' };
      return (
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${dotColors[conf] ?? dotColors.medium}`} />
          <span className="text-xs text-slate-500 capitalize">{conf}</span>
        </div>
      );
    },
  }),

  // Trash icon — always the last column. One-click delete with an undo
  // toast (see BoardTable.tsx wiring). Kept as a separate column (not
  // nested in the row-hover overlay) so screen-reader users can find it.
  col.display({
    id: 'delete',
    header: '',
    size: 40,
    cell: ({ row, table }) => {
      const meta = table.options.meta as BoardTableMeta;
      const { year, make, model } = row.original.vehicle.canonical;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            meta.onDeleteVehicle(row.original.vehicle.id);
          }}
          aria-label={`Delete ${year} ${make} ${model}`}
          className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      );
    },
  }),
];
