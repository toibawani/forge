import test from "node:test";
import assert from "node:assert/strict";

import { isValidTimeZone, localDay, previousDay } from "./timezone.ts";

test("an unknown zone is rejected, a known one is not", () => {
  assert.equal(isValidTimeZone("Asia/Kolkata"), true);
  assert.equal(isValidTimeZone("America/New_York"), true);
  assert.equal(isValidTimeZone("Mars/Olympus_Mons"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("a late-night attempt lands on the local day, not the UTC day", () => {
  // 20:30 UTC is 02:00 the next morning in Kolkata.
  const instant = new Date("2026-03-14T20:30:00Z");

  assert.equal(localDay(instant, "UTC"), "2026-03-14");
  assert.equal(localDay(instant, "Asia/Kolkata"), "2026-03-15");
});

test("the same instant can be two different days for two people", () => {
  const instant = new Date("2026-07-01T02:00:00Z");

  assert.equal(localDay(instant, "Asia/Kolkata"), "2026-07-01");
  // 19:00 on 30 June in Los Angeles.
  assert.equal(localDay(instant, "America/Los_Angeles"), "2026-06-30");
});

test("daylight saving shifts the boundary rather than breaking it", () => {
  // New York springs forward at 07:00 UTC on 8 March 2026.
  assert.equal(localDay(new Date("2026-03-08T06:59:00Z"), "America/New_York"), "2026-03-08");
  assert.equal(localDay(new Date("2026-03-09T03:59:00Z"), "America/New_York"), "2026-03-08");
  assert.equal(localDay(new Date("2026-03-09T04:00:00Z"), "America/New_York"), "2026-03-09");
});

test("an invalid zone falls back to UTC instead of throwing", () => {
  const instant = new Date("2026-01-01T23:30:00Z");
  assert.equal(localDay(instant, "Not/AZone"), "2026-01-01");
});

test("stepping back a day crosses months and years", () => {
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(previousDay("2026-01-01"), "2025-12-31");
  assert.equal(previousDay("2024-03-01"), "2024-02-29");
});
