/**
 * History & recalls section for DetailDrawer.
 *
 * Presents the screening-tier `HistoryReport` produced by
 * `useHistoryReport`: severity-coded flag list, sources-checked summary,
 * mandatory disclaimer, and a manual refresh button.
 *
 * Displays only what's in the report — all provenance and disclaimer
 * strings come from the resolver, not from this component.
 */

import { AlertTriangle, ExternalLink, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { useHistoryReport } from '../../hooks/useHistoryReport';
import type { HistoryFlag, HistorySeverity, VehicleRow } from '../../types';

interface HistorySectionProps {
  vehicle: VehicleRow;
}

const SEVERITY_CLASSES: Record<HistorySeverity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
};

const SEVERITY_LABEL: Record<HistorySeverity, string> = {
  critical: 'Critical',
  watch: 'Watch',
  info: 'Info',
};

const SOURCE_LABEL: Record<string, string> = {
  nhtsa_recalls: 'NHTSA safety recalls',
  nhtsa_vpic: 'NHTSA vPIC',
  user_override: 'You',
};

export function HistorySection({ vehicle }: HistorySectionProps) {
  const { status, report, errors, isStale, refresh } = useHistoryReport(
    vehicle.id,
    vehicle.historyReport,
    {
      year: vehicle.canonical.year,
      make: vehicle.canonical.make,
      model: vehicle.canonical.model,
      vin: vehicle.listing.vin,
    },
  );

  return (
    <div className="space-y-3">
      {/* Action row */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          {report?.lastChecked ? (
            <>
              Last checked{' '}
              <span title={report.lastChecked}>
                {formatRelative(report.lastChecked)}
              </span>
              {isStale && <span className="ml-1 text-amber-600">(refresh recommended)</span>}
            </>
          ) : (
            <>Not checked yet.</>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={status === 'loading'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} />
          {report ? 'Refresh' : 'Check recalls'}
        </button>
      </div>

      {/* Error banner — surfaces per-provider failures without hiding cached flags */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Couldn't reach some history sources:</div>
            <ul className="mt-0.5">
              {errors.map((e, i) => (
                <li key={i}>{SOURCE_LABEL[e.source] ?? e.source}: {e.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Flag list */}
      {report && report.flags.length > 0 && (
        <ul className="space-y-2">
          {report.flags.map((flag) => (
            <FlagItem key={flag.id} flag={flag} />
          ))}
        </ul>
      )}

      {/* Empty state — only after a successful check */}
      {report && report.flags.length === 0 && report.sourcesChecked.length > 0 && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          <Info size={13} className="shrink-0" />
          <span>No open recalls found in NHTSA for this year/make/model.</span>
        </div>
      )}

      {/* Sources-checked chip row */}
      {report && report.sourcesChecked.length > 0 && (
        <div className="text-xs text-slate-500">
          Checked: {report.sourcesChecked.map((s) => SOURCE_LABEL[s] ?? s).join(', ')}
        </div>
      )}

      {/* Disclaimer — baked into the report; always rendered when a
       *   report exists so users can't mistake "0 flags" for "clean". */}
      {report?.disclaimer && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
          <ShieldAlert size={13} className="shrink-0 mt-0.5 text-slate-400" />
          <span>{report.disclaimer}</span>
        </div>
      )}

      {/* Manual-check deep links. Always rendered so users have a path
       *   to free signal we can't fetch automatically (NICB theft/salvage)
       *   and to VIN-specific recall data we don't query in-app. */}
      <ManualChecks vin={vehicle.listing.vin} />

      {/* Initial prompt when no report exists */}
      {!report && status !== 'loading' && (
        <p className="text-xs text-slate-500">
          Click "Check recalls" to query NHTSA for open safety campaigns on this year/make/model.
          No VIN required. Opt-in — no network traffic until you click.
        </p>
      )}
    </div>
  );
}

/** Manual click-through links to free data sources we can't fetch
 *  automatically from the browser. NICB is CAPTCHA-gated; NHTSA has a
 *  per-VIN recalls page whose coverage overlaps but is not identical to
 *  the year/make/model API we already call. Both open in new tabs with
 *  `noopener noreferrer` so they can't reach back into this window. */
function ManualChecks({ vin }: { vin: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-slate-600">Free manual checks</div>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2 text-xs text-slate-600">
          <ExternalLink size={11} className="shrink-0 mt-0.5 text-slate-400" />
          <div className="flex-1 min-w-0">
            <a
              href="https://www.nicb.org/vincheck"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-700 hover:text-blue-600 underline decoration-dotted hover:decoration-solid"
            >
              NICB VINCheck
            </a>
            <span className="text-slate-500"> — free theft + insurer-reported salvage signal. Participating insurers only, not comprehensive.</span>
          </div>
        </li>
        {vin && (
          <li className="flex items-start gap-2 text-xs text-slate-600">
            <ExternalLink size={11} className="shrink-0 mt-0.5 text-slate-400" />
            <div className="flex-1 min-w-0">
              <a
                href={`https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-700 hover:text-blue-600 underline decoration-dotted hover:decoration-solid"
              >
                NHTSA recalls by VIN
              </a>
              <span className="text-slate-500"> — VIN-specific open safety recalls (complements the year/make/model check above).</span>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

function FlagItem({ flag }: { flag: HistoryFlag }) {
  return (
    <li className={`border rounded px-3 py-2 text-sm ${SEVERITY_CLASSES[flag.severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-white/60">
            {SEVERITY_LABEL[flag.severity]}
          </span>
          <span className="font-medium truncate">{flag.title}</span>
        </div>
        {flag.link && (
          <a
            href={flag.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-0.5 text-xs underline decoration-dotted hover:decoration-solid"
          >
            Details <ExternalLink size={10} />
          </a>
        )}
      </div>
      {flag.detail && (
        <p className="text-xs mt-1 text-slate-700/90 leading-relaxed">{flag.detail}</p>
      )}
      {flag.identifier && (
        <p className="text-[10px] mt-1 text-slate-500 font-mono">NHTSA {flag.identifier}</p>
      )}
    </li>
  );
}

/** Render an ISO timestamp as a short relative string ("2d ago"). Kept
 *  minimal — no i18n, no date-fns dependency. Falls back to absolute
 *  locale date for anything older than ~60 days. */
function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}
