/**
 * Shared helpers for route handlers: consistent JSON shapes, safe error
 * handling and session resolution. Nothing sensitive ever reaches the client.
 */

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser } from "@/lib/session";
import type { UserRecord } from "@/lib/types";

export interface ApiError {
  error: string;
  details?: unknown;
}

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ error, details }, { status });
}

/** Parses and validates a JSON body, returning a typed result or a 400. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; response?: undefined } | { data?: undefined; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: fail("Expected a JSON body", 400) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      response: fail(
        "That request did not pass validation",
        422,
        result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "body",
          message: issue.message,
        })),
      ),
    };
  }
  return { data: result.data };
}

/**
 * Wraps a handler that needs a user. Returns 401 with a helpful payload when
 * there is no session so the client can route to onboarding.
 */
export async function withUser(
  handler: (user: UserRecord) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("No session — complete onboarding first", 401);
    }
    return await handler(user);
  } catch (error) {
    return handleUnexpected(error);
  }
}

/** Never leak stack traces to the client; log them server-side instead. */
export function handleUnexpected(error: unknown): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.issues);
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[touchgrass] route error:", error);
  return fail("Something went wrong on our side", 500, { message });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
