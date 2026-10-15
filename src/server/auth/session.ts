import { cookies } from "next/headers";
import { cache } from "react";
import { connectDB } from "@/server/db";
import { Session, User } from "@/server/models";
import { permissionsFor, type Permission } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { forbidden, unauthorized } from "@/server/lib/errors";
import { randomToken, sha256 } from "./password";

export const SESSION_COOKIE = "vg_session";
const SESSION_DAYS = 14;

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  permissions: Permission[];
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await Session.create({
    tokenHash: sha256(token),
    userId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDB();
    await Session.deleteOne({ tokenHash: sha256(token) });
  }
  store.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsFor(userId: string) {
  await Session.deleteMany({ userId });
}

/** Current signed-in user, or null. Memoised per request. */
export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  await connectDB();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user || !user.active || user.isGuest) return null;
  const role = user.role as Role;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role,
    permissions: permissionsFor(role, user.extraPermissions ?? []),
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export function can(user: AuthUser | null, permission: Permission): boolean {
  return !!user && user.permissions.includes(permission);
}

/** Requires the user to hold at least one of the given permissions. */
export async function requirePermission(...permissions: Permission[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!permissions.some((p) => user.permissions.includes(p))) throw forbidden();
  return user;
}
