/**
 * Pulls the highest number out of a salary string like "$140k–$180k" or
 * "€45,000 - €60,000". Values under 1000 are treated as thousands ("140" →
 * 140,000). Returns null when there's nothing numeric to compare.
 */
export function parseSalaryMax(salaryText: string | null | undefined): number | null {
  if (!salaryText) return null;
  const numbers = (salaryText.match(/\d[\d,]*/g) || [])
    .map((n) => parseInt(n.replace(/,/g, ''), 10))
    .map((n) => (n < 1000 ? n * 1000 : n));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

// One monetary amount: "$108,800", "108,800", "$150k", "150k", or "$120000".
const AMOUNT_SRC = String.raw`([$€£]\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{2,4}(?:\.\d+)?\s*[kK]|(?<=[$€£]\s{0,2})\d{4,7})`;
const RANGE_RE = new RegExp(`${AMOUNT_SRC}\\s*(?:[-–—~]|to)\\s*${AMOUNT_SRC}`, 'g');
const SINGLE_RE = new RegExp(AMOUNT_SRC.replace('([$€£]\\s*)?', '([$€£]\\s*)'), 'g');
const CONTEXT_RE = /salar|compensation|\bpay\b|\bbase\b|annual|annum|OTE|per year|\/yr|remuneration|USD|CAD|EUR|GBP|AUD/i;
const CURRENCY_CODE_RE = /^\s*(USD|CAD|EUR|GBP|AUD|CHF|NZD)\b/;

function normalizeAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (/[kK]$/.test(cleaned)) return Math.round(parseFloat(cleaned) * 1000);
  return Math.round(parseFloat(cleaned));
}

/**
 * Finds a salary mention inside free posting text — used when a job board's
 * API exposes no structured salary (Jobicy stopped returning its salary
 * fields; Remotive's is often blank). Deliberately conservative: amounts must
 * look like plausible annual figures (so "$150M initiative", "$99/mo", and
 * "401(k)" don't match) and need either a currency marker or salary-ish
 * wording nearby.
 */
export function extractSalaryText(text: string | null | undefined): string | null {
  if (!text) return null;
  const plausible = (value: number) => value >= 10000 && value <= 1500000;
  const hasContext = (index: number, length: number) =>
    CONTEXT_RE.test(text.slice(Math.max(0, index - 60), index + length + 60));

  RANGE_RE.lastIndex = 0;
  for (const match of text.matchAll(RANGE_RE)) {
    const [full, sym1, amt1, sym2, amt2] = match;
    const lo = normalizeAmount(amt1);
    const hi = normalizeAmount(amt2);
    if (!plausible(lo) || !plausible(hi) || lo > hi) continue;
    if (!sym1 && !sym2 && !hasContext(match.index, full.length)) continue;
    const code = CURRENCY_CODE_RE.exec(text.slice(match.index + full.length))?.[1];
    return full.replace(/\s+/g, ' ').trim() + (code ? ` ${code}` : '');
  }

  SINGLE_RE.lastIndex = 0;
  for (const match of text.matchAll(SINGLE_RE)) {
    const [full, , amount] = match;
    if (!plausible(normalizeAmount(amount))) continue;
    if (!hasContext(match.index, full.length)) continue;
    const code = CURRENCY_CODE_RE.exec(text.slice(match.index + full.length))?.[1];
    return full.replace(/\s+/g, ' ').trim() + (code ? ` ${code}` : '');
  }
  return null;
}

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
