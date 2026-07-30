/**
 * Formats a salary range with an explicit currency indication, e.g.
 * "$140,000–$180,000 USD" or "€45,000–€60,000 EUR". Postings come from many
 * countries, so the ISO code is always appended when known — a bare "$" is
 * ambiguous across USD/CAD/AUD and friends.
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): string | null {
  const lo = min && min > 0 ? min : null;
  const hi = max && max > 0 ? max : null;
  if (!lo && !hi) return null;

  const code = (currency || '').trim().toUpperCase();
  const format = (value: number): string => {
    if (code) {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: code,
          maximumFractionDigits: 0,
        }).format(value);
      } catch {
        // Unknown/invalid currency code — fall through to a plain number.
      }
    }
    return value.toLocaleString('en-US');
  };

  const range = lo && hi && lo !== hi ? `${format(lo)}–${format(hi)}` : format((lo ?? hi) as number);
  return code ? `${range} ${code}` : range;
}
