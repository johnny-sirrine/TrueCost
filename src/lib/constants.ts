export const CURRENT_YEAR = new Date().getFullYear();

export const LISTING_SOURCE_LABELS: Record<string, string> = {
  ksl: 'KSL',
  facebook: 'Facebook',
  carscom: 'Cars.com',
  craigslist: 'Craigslist',
  dealer: 'Dealer',
  manual: 'Manual',
  raw_text: 'Pasted Text',
};

export const DEAL_QUALITY_COLORS: Record<string, string> = {
  Strong: 'bg-emerald-100 text-emerald-800',
  'Fair+': 'bg-sky-100 text-sky-800',
  Fair: 'bg-amber-100 text-amber-800',
  Weak: 'bg-orange-100 text-orange-800',
  Terrible: 'bg-red-100 text-red-800',
  Suspicious: 'bg-purple-100 text-purple-800',
};

export const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-400',
  medium: 'bg-amber-400',
  low: 'bg-red-400',
};

export const FIELD_ORIGIN_LABELS: Record<string, string> = {
  extracted: 'Extracted',
  external_lookup: 'EPA Lookup',
  inferred: 'Inferred',
  assumed: 'Assumed',
  overridden: 'Override',
};

export const FIELD_ORIGIN_COLORS: Record<string, string> = {
  extracted: 'bg-emerald-100 text-emerald-700',
  external_lookup: 'bg-teal-100 text-teal-700',
  inferred: 'bg-sky-100 text-sky-700',
  assumed: 'bg-slate-100 text-slate-600',
  overridden: 'bg-violet-100 text-violet-700',
};
