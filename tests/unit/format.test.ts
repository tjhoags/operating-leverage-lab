import { describe, expect, it } from 'vitest';
import { formatHours, formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '../../src/model';

describe('display formatting', () => {
  it('formats money with sign conventions and never shows negative zero', () => {
    expect(formatMoney(3500, 'USD', { signed: true })).toBe('+$3,500');
    expect(formatMoney(-7200, 'USD')).toBe('-$7,200');
    expect(formatMoney(-0.001, 'USD', { signed: true })).toBe('$0');
    expect(formatMoney(4.5, 'USD', { decimals: 2 })).toBe('$4.50');
    expect(formatMoney(0.5833, 'USD', { decimals: 3 })).toBe('$0.583');
    expect(formatMoney(undefined, 'USD')).toBe('undefined');
    expect(formatMoney(Number.NaN, 'USD')).toBe('undefined');
  });

  it('formats other currencies and falls back for unknown codes', () => {
    expect(formatMoney(1200, 'EUR')).toBe('€1,200');
    expect(formatMoney(1200, 'GBP')).toBe('£1,200');
    expect(formatMoney(1200, 'ZZZ')).toMatch(/1,200/);
  });

  it('formats hours, percentages and compact axis labels', () => {
    expect(formatHours(100)).toBe('100 h');
    expect(formatHours(-50, 0, true)).toBe('-50 h');
    expect(formatPercent(0.25)).toBe('25%');
    expect(formatNumber(1075.25, 1)).toBe('1,075.3');
    expect(formatMoneyCompact(4000, 'USD')).toBe('$4k');
    expect(formatMoneyCompact(-7000, 'USD')).toBe('-$7k');
    expect(formatMoneyCompact(350, 'USD')).toBe('$350');
    expect(formatMoneyCompact(1_250_000, 'USD')).toBe('$1.25m');
  });
});
