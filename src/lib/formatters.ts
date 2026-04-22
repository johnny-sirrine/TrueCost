export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMiles(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value)) + ' mi';
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatMpg(value: number): string {
  return Math.round(value) + ' mpg';
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}

export function formatYearMakeModel(year: number, make: string, model: string, trim?: string): string {
  const parts = [String(year), make, model];
  if (trim) parts.push(trim);
  return parts.join(' ');
}
