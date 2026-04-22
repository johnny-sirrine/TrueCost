import * as Tooltip from '@radix-ui/react-tooltip';
import type { FieldMeta } from '../../types';
import { FIELD_ORIGIN_LABELS, FIELD_ORIGIN_COLORS } from '../../lib/constants';

const ORIGIN_EXPLANATIONS: Record<string, string> = {
  extracted: 'Pulled directly from listing data.',
  external_lookup: 'Matched from EPA fueleconomy.gov vehicle database.',
  inferred: 'Derived from other known fields (e.g. drivetrain from trim name).',
  assumed: 'No source data — using a default estimate. Click to set the real value.',
  overridden: 'Manually set by you.',
};

interface FieldStatusBadgeProps {
  meta?: FieldMeta;
}

export function FieldStatusBadge({ meta }: FieldStatusBadgeProps) {
  const origin = meta?.origin ?? 'assumed';
  const label = meta ? (FIELD_ORIGIN_LABELS[origin] ?? origin) : 'Assumed';
  const colorClass = meta ? (FIELD_ORIGIN_COLORS[origin] ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-500';
  const explanation = meta?.note
    ? `${ORIGIN_EXPLANATIONS[origin] ?? ''} ${meta.note}`
    : ORIGIN_EXPLANATIONS[origin] ?? '';

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-default ${colorClass}`}
        >
          {label}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="max-w-xs px-2.5 py-1.5 text-xs text-white bg-slate-800 rounded-md shadow-lg z-[100]"
          sideOffset={4}
        >
          {explanation}
          <Tooltip.Arrow className="fill-slate-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
