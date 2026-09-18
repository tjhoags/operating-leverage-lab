/** Presentation helpers. Pure functions; rounding happens only here. */

function currencyFormatter(currency: string, decimals: number, signDisplay: 'auto' | 'always' | 'exceptZero'): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay,
    });
  } catch {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay,
    });
  }
}

export interface MoneyOptions {
  decimals?: number;
  signed?: boolean;
}

export function formatMoney(value: number | undefined, currency: string, options: MoneyOptions = {}): string {
  if (value === undefined || !Number.isFinite(value)) return 'undefined';
  const decimals = options.decimals ?? 0;
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return currencyFormatter(currency, decimals, options.signed ? 'exceptZero' : 'auto').format(safe);
}

export function formatNumber(value: number | undefined, decimals = 0, signed = false): string {
  if (value === undefined || !Number.isFinite(value)) return 'undefined';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(safe);
}

export function formatHours(value: number | undefined, decimals = 0, signed = false): string {
  if (value === undefined || !Number.isFinite(value)) return 'undefined';
  return `${formatNumber(value, decimals, signed)} h`;
}

export function formatPercent(fraction: number | undefined, decimals = 0, signed = false): string {
  if (fraction === undefined || !Number.isFinite(fraction)) return 'undefined';
  return `${formatNumber(fraction * 100, decimals, signed)}%`;
}

export function formatMonths(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} months`;
}

/** Short currency form for chart axes: $4k, -$7k, $350. */
export function formatMoneyCompact(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  let symbol = '';
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(1);
    symbol = parts.find((p) => p.type === 'currency')?.value ?? '';
  } catch {
    symbol = `${currency} `;
  }
  if (abs >= 1_000_000) return `${sign}${symbol}${trimZeros(abs / 1_000_000)}m`;
  if (abs >= 1_000) return `${sign}${symbol}${trimZeros(abs / 1_000)}k`;
  return `${sign}${symbol}${trimZeros(abs)}`;
}

function trimZeros(n: number): string {
  return String(Number(n.toFixed(2)));
}
