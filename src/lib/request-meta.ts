import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getIpHashPepper } from "@/lib/env";

/** SHA-256 of a salted IP. Raw IPs are never stored or logged. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const normalized = ip.split(",")[0]?.trim();
  if (!normalized || normalized === "unknown") return null;
  return createHash("sha256").update(`${getIpHashPepper()}:${normalized}`).digest("hex");
}

/** Pseudonymous reference used in accountability records that outlive an account. */
export function hashUserRef(userId: string): string {
  return createHash("sha256").update(`user:${getIpHashPepper()}:${userId}`).digest("hex");
}

/** Opaque reference for incident tracking (no personal data). */
export function breachReference(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `FRG-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Client IP from the proxy headers Vercel sets, falling back to none. */
export function requestIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    null
  );
}
