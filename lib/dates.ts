/** Dates are local YYYY-MM-DD keys, so a day is the learner's day. */

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function today(): string {
  return dateKey(new Date());
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "4 Oct", with the year only when it isn't this one. */
export function formatDay(k: string): string {
  const d = parseKey(k);
  const y = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

/** Monday of the week containing `k`. */
export function weekStart(k: string): string {
  const d = parseKey(k);
  const dow = (d.getDay() + 6) % 7;
  return addDays(k, -dow);
}
