import type { Cents } from './types';

export const CURRENCIES: { code: string; label: string; locale: string }[] = [
  { code: 'USD', label: 'US Dollar ($)', locale: 'en-US' },
  { code: 'GBP', label: 'British Pound (£)', locale: 'en-GB' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)', locale: 'en-CA' },
  { code: 'AUD', label: 'Australian Dollar (A$)', locale: 'en-AU' },
  { code: 'EUR', label: 'Euro (€)', locale: 'en-IE' },
  { code: 'NZD', label: 'New Zealand Dollar (NZ$)', locale: 'en-NZ' },
  { code: 'INR', label: 'Indian Rupee (₹)', locale: 'en-IN' },
  { code: 'PKR', label: 'Pakistani Rupee (Rs)', locale: 'en-PK' },
  { code: 'ZAR', label: 'South African Rand (R)', locale: 'en-ZA' },
  { code: 'SGD', label: 'Singapore Dollar (S$)', locale: 'en-SG' },
];

const cache = new Map<string, Intl.NumberFormat>();
const fmt = (currency: string, compact = false) => {
  const key = currency + compact;
  if (!cache.has(key)) {
    const locale = CURRENCIES.find((c) => c.code === currency)?.locale ?? 'en-US';
    try {
      cache.set(key, new Intl.NumberFormat(locale, compact
        ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
        : { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } catch {
      cache.set(key, new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }));
    }
  }
  return cache.get(key)!;
};

export const formatMoney = (c: Cents, currency = 'USD') => fmt(currency).format(c === 0 ? 0 : c / 100);
export const formatCompact = (c: Cents, currency = 'USD') => fmt(currency, true).format(c / 100);
export const currencySymbol = (currency = 'USD') =>
  fmt(currency).formatToParts(0).find((p) => p.type === 'currency')?.value ?? '$';

/** Parses user input like "1,234.50" or "$20" into cents. Returns null when invalid. */
export const parseMoney = (input: string | number): Cents | null => {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  if ((cleaned.match(/\./g) || []).length > 1) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};
export const centsToInput = (c: Cents | undefined) => (c === undefined || c === null ? '' : (c / 100).toFixed(2));
export const sum = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0);
export const pct = (part: number, whole: number) => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);
