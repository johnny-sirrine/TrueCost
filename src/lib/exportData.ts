import type { VehicleRow, GlobalAssumptions } from '../types';
import type { ComputedVehicle } from '../hooks/useComputedBoard';

/**
 * Escape a cell for CSV output. Quotes if it contains comma, quote, or newline.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

/**
 * Flatten a computed vehicle into a CSV row. Only user-visible / analyst-useful fields.
 */
export function vehiclesToCsv(computed: ComputedVehicle[]): string {
  const headers = [
    'Year', 'Make', 'Model', 'Trim',
    'Listing Price', 'Catch-Up Cost', 'Fees', 'Mileage', 'Title Status', 'Condition', 'Modification Level',
    'Drivetrain', 'Transmission', 'Engine', 'EPA MPG',
    'Realistic MPG',
    'Fuel $/mo', 'Routine $/mo', 'Expected Repairs $/mo', 'Insurance $/mo',
    'Baseline $/mo', 'All-in $/mo',
    'First Year Cost', 'Total Cost at Horizon',
    'Market Value Est.', 'Future Resale Est.', 'Resale Loss',
    'Deal Quality', 'Confidence',
    'Is Current Car', 'Pinned', 'Archived',
    'User Rating', 'Tags',
    'Source', 'Location', 'Source URL',
    'Created At', 'Updated At',
  ];

  const rows = computed.map(({ vehicle, computed: c }) => csvRow([
    vehicle.canonical.year,
    vehicle.canonical.make,
    vehicle.canonical.model,
    vehicle.canonical.trim ?? '',
    vehicle.user.listingPrice,
    vehicle.user.catchUpCost,
    vehicle.user.feesCost ?? 0,
    vehicle.user.mileage,
    vehicle.user.titleStatus,
    vehicle.user.conditionLevel,
    vehicle.user.modificationLevel ?? 'stock',
    vehicle.canonical.drivetrain ?? '',
    vehicle.canonical.transmissionType ?? '',
    vehicle.canonical.engineType ?? '',
    vehicle.canonical.epaCombinedMpg ?? '',
    Math.round(c.realisticMpg * 10) / 10,
    Math.round(c.fuelMonthly),
    Math.round(c.routineMonthly),
    Math.round(c.expectedRepairsMonthly),
    Math.round(c.insuranceMonthly),
    Math.round(c.baselineMonthly),
    Math.round(c.allInMonthly),
    Math.round(c.firstYearCost),
    Math.round(c.totalCostAtHorizon),
    Math.round(c.currentMarketValueEstimate),
    Math.round(c.futureResaleValueEstimate),
    Math.round(c.resaleLoss),
    c.dealQuality,
    c.confidence,
    vehicle.user.isCurrentCar ? 'yes' : 'no',
    vehicle.user.pinned ? 'yes' : 'no',
    vehicle.user.archived ? 'yes' : 'no',
    vehicle.user.userRating ?? '',
    vehicle.user.tags.join('; '),
    vehicle.listing.source,
    vehicle.listing.location ?? '',
    vehicle.listing.sourceUrl ?? '',
    vehicle.createdAt,
    vehicle.updatedAt,
  ]));

  return [csvRow(headers), ...rows].join('\n');
}

/**
 * Full JSON export: raw vehicles + assumptions. Suitable for backup / restore.
 */
export function exportJson(vehicles: VehicleRow[], assumptions: GlobalAssumptions): string {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    assumptions,
    vehicles,
  }, null, 2);
}

/**
 * Trigger a browser download for a text blob.
 */
export function downloadTextFile(contents: string, filename: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function filenameStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
