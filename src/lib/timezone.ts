/**
 * Which calendar day a person practised on.
 *
 * A day is local, not UTC. Someone in Kolkata practising at 01:30 has practised
 * on the day their calendar says, and a New Yorker's day is 23 or 25 hours long
 * twice a year. The database stores the UTC instant on the attempt and derives
 * the local day from the profile's timezone in a trigger, so the day can be
 * recomputed and cannot be set by a client.
 */

/** True when the runtime can resolve the zone. */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The local calendar day of an instant, as `YYYY-MM-DD`.
 *
 * Falls back to UTC for an unknown zone rather than throwing: a bad stored
 * timezone should not stop a page rendering, and UTC is the documented default.
 */
export function localDay(instant: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return instant.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

/** The local day before `day`, stepping the calendar rather than 86 400 seconds. */
export function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  const stepped = new Date(Date.UTC(year, month - 1, date));
  stepped.setUTCDate(stepped.getUTCDate() - 1);
  return stepped.toISOString().slice(0, 10);
}
