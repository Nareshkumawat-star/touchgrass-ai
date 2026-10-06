/**
 * Anonymous sessions.
 *
 * TouchGrass AI has no accounts by design: the fastest way to get someone
 * outside is to not ask them for a password. Each browser gets an anonymous
 * user record identified by an HMAC-signed cookie, so the id cannot simply be
 * guessed or edited. A production fork would swap this for a real auth provider
 * without touching anything else — everything else keys off `UserRecord.id`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appConfig } from "@/lib/config";
import { getStore } from "@/lib/db";
import type { UserRecord } from "@/lib/types";

function secret(): string {
  // A development default keeps the app runnable out of the box; production
  // deployments must set SESSION_SECRET (documented in .env.example).
  return process.env.SESSION_SECRET?.trim() || "touchgrass-dev-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function serializeSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function parseSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const userId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(userId);
  if (signature.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return parseSession(store.get(appConfig.sessionCookie)?.value);
}

export async function setSession(userId: string, isDemo: boolean): Promise<void> {
  const store = await cookies();
  store.set(appConfig.sessionCookie, serializeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: isDemo ? 60 * 60 * 6 : 60 * 60 * 24 * 180,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(appConfig.sessionCookie);
}

/** The signed-in (anonymous) user, or null. */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const store = await getStore();
  return store.getUser(userId);
}
