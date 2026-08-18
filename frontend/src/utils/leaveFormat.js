export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatAnnualPl(item) {
  if (item.adjustmentNote) return `${item.baseDays} + ${item.adjustmentNote}`;
  const sign = item.adjustment < 0 ? '-' : '+';
  return `${item.baseDays} ${sign} ${Math.abs(item.adjustment)}`;
}

// Matches a parenthesized signed number like "(-7.5)", or a bare optionally
// signed number like "24.5", "-7.5", "+15" — but only when the sign sits
// directly against the digits, so "10 - 3" (space either side of the minus)
// is deliberately NOT read as a signed "-3" term.
const TERM_PATTERN = /\(\s*-?\d+(?:\.\d+)?\s*\)|[+-]?\d+(?:\.\d+)?/g;

/**
 * Accepts either a single plain number, or several signed numbers added
 * together (as HR spreadsheets often write a carried-over balance), e.g.
 * "24.5 + (-7.5)", "(-2) + 2.5", "1 + 2.5", "17.5 (-0.5)". Returns
 * { value, note } where note is the original text when it was a multi-term
 * expression (null for a plain single number), or null if the input couldn't
 * be confidently understood as a sum of numbers (e.g. it contains a bare
 * "-" meant as subtraction, or other stray characters).
 */
export function parseNumberOrSum(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return { value: undefined, note: null };

  const plain = Number(trimmed);
  if (Number.isFinite(plain)) return { value: plain, note: null };

  const matches = [...trimmed.matchAll(TERM_PATTERN)];
  if (!matches.length) return null;

  // Each gap between terms (and before the first / after the last) must be
  // only whitespace and at most one "+" separator — anything else (a bare
  // "-", doubled "+", stray characters) means the input wasn't understood.
  const GAP_PATTERN = /^\s*\+?\s*$/;
  let cursor = 0;
  for (const match of matches) {
    if (!GAP_PATTERN.test(trimmed.slice(cursor, match.index))) return null;
    cursor = match.index + match[0].length;
  }
  if (!GAP_PATTERN.test(trimmed.slice(cursor))) return null;

  const value = matches.reduce((sum, match) => sum + Number(match[0].replace(/[()\s]/g, '')), 0);
  return { value, note: trimmed };
}

// "28/08/2026" (DD/MM/YYYY). Parses the "YYYY-MM-DD" string directly rather
// than going through Date's local-timezone getters, which can shift the
// displayed day by one depending on the viewer's timezone.
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function ordinal(day) {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

export function reportYear() {
  return new Date().getFullYear();
}

export function reportTitle() {
  const now = new Date();
  const year = now.getFullYear();
  const to = `${ordinal(now.getDate())} ${now.toLocaleString('en-US', { month: 'long' })} ${year}`;
  return `Employee absence report from date 1st January ${year} to ${to}`;
}
