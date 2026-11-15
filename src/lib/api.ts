import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Shared HTTP layer for every API route.
 *
 * Guarantees per request:
 *   * personalized responses are never cacheable (no PII in shared caches);
 *   * mutations are rejected when the Origin does not match the app host
 *     (CSRF defence in depth on top of SameSite=Lax cookies);
 *   * authentication is verified with Supabase, never taken from a header;
 *   * role checks run server-side against the user's own profile row;
 *   * errors are logged with a request id but no personal data, and never
 *     leak internals to the client.
 */

export type SessionProfile = {
  id: string;
  role: "practitioner" | "recruiter" | "reviewer" | "admin";
  visibility: "private" | "recruiters_only" | "public";
  consent_at: string | null;
  consent_policy_version: string | null;
  deletion_requested_at: string | null;
};

export type RouteContext = {
  request: NextRequest;
  requestId: string;
  supabase: SupabaseClient;
  user: User;
  profile: SessionProfile;
};

type AuthMode = "required" | "optional" | "public";

type RouteOptions = {
  auth?: AuthMode;
  /** Rejects requests whose Origin header does not match the app host. */
  mutation?: boolean;
  roles?: Array<SessionProfile["role"]>;
  /**
   * Erasure endpoints must stay reachable while an account is frozen, so the
   * user can cancel or complete the deletion they asked for.
   */
  allowPendingDeletion?: boolean;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
} as const;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { ...NO_STORE_HEADERS } });
}

export function created(data: unknown): NextResponse {
  return ok(data, 201);
}

export function okCsv(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers: { ...NO_STORE_HEADERS } }
  );
}

function allowedOrigins(): string[] {
  const { appUrl } = getPublicEnv();
  const origins = new Set<string>();
  try {
    origins.add(new URL(appUrl).origin);
  } catch {
    // ignore malformed config
  }
  return Array.from(origins);
}

/**
 * Same-origin check for state-changing requests. A missing Origin header is
 * allowed (server-to-server and non-browser clients), because those requests
 * still need a valid session cookie that a cross-site page cannot send.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (host && origin === `https://${host}`) return true;
  if (host && origin === `http://${host}`) return true;

  return allowedOrigins().includes(origin);
}

/** Parses and validates a JSON body, returning a 400 with field-level detail. */
export async function readJson<Schema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: Schema
): Promise<z.infer<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "invalid_input",
      "Some fields need attention.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }

  return parsed.data as z.infer<Schema>;
}

/**
 * Wraps a route handler with configuration, origin, auth, role and error
 * handling. `auth: "required"` routes always receive a verified user.
 */
export function apiRoute(
  handler: (context: RouteContext) => Promise<NextResponse>,
  options: RouteOptions = {}
) {
  const authMode: AuthMode = options.auth ?? "required";

  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();

    // One line per request: method, path, status, duration. No query strings
    // (they can carry filters that look like data), no bodies, no headers.
    const logRequest = (response: NextResponse, userId?: string): NextResponse => {
      logger.info(
        "api_request",
        {
          method: request.method,
          path: request.nextUrl.pathname,
          status: response.status,
          ms: Date.now() - startedAt,
        },
        userId,
        requestId
      );
      return response;
    };

    try {
      if (!isSupabaseConfigured()) {
        return logRequest(fail(503, "not_configured", "Forge is not connected to its database yet."));
      }

      if (options.mutation && !isSameOrigin(request)) {
        logger.warn("Blocked cross-origin mutation", { path: request.nextUrl.pathname }, undefined, requestId);
        return logRequest(fail(403, "cross_origin", "This request did not come from Forge."));
      }

      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return logRequest(fail(503, "not_configured", "Forge is not connected to its database yet."));
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authMode === "required" && (!user || authError)) {
        return logRequest(fail(401, "unauthenticated", "Sign in to continue."));
      }

      if (authMode !== "required" && authMode !== "optional") {
        // Public routes get a synthetic empty context; no profile fetch.
        return logRequest(
          await handler({
            request,
            requestId,
            supabase,
            user: null as unknown as User,
            profile: null as unknown as SessionProfile,
          })
        );
      }

      if (!user) {
        return logRequest(
          await handler({
            request,
            requestId,
            supabase,
            user: null as unknown as User,
            profile: null as unknown as SessionProfile,
          })
        );
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, visibility, consent_at, consent_policy_version, deletion_requested_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        logger.error("Profile lookup failed for session", { error: profileError.message }, user.id, requestId);
        return fail(500, "profile_unavailable", "We could not load your Forge profile.");
      }

      const profile = (profileRow as SessionProfile | null) ?? {
        id: user.id,
        role: "practitioner" as const,
        visibility: "private" as const,
        consent_at: null,
        consent_policy_version: null,
        deletion_requested_at: null,
      };

      if (profile.deletion_requested_at && !options.allowPendingDeletion) {
        return logRequest(
          fail(
            409,
            "account_scheduled_for_deletion",
            "This account is scheduled for deletion. Cancel the request before making changes."
          )
        );
      }

      if (options.roles && !options.roles.includes(profile.role)) {
        logger.warn("Role check failed", { role: profile.role, path: request.nextUrl.pathname }, user.id, requestId);
        return logRequest(fail(403, "forbidden", "You do not have access to this resource."), user.id);
      }

      return logRequest(await handler({ request, requestId, supabase, user, profile }), user.id);
    } catch (error) {
      if (error instanceof HttpError) {
        return logRequest(fail(error.status, error.code, error.message, error.details));
      }

      logger.error(
        "Unhandled API error",
        {
          path: request.nextUrl.pathname,
          error: error instanceof Error ? error.message : String(error),
        },
        undefined,
        requestId
      );

      return logRequest(fail(500, "internal_error", "Something went wrong on our side.", { requestId }));
    }
  };
}
