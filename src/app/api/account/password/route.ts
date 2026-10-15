import { api, json, readJson } from "@/server/lib/http";
import { str } from "@/server/lib/validate";
import { ApiError, badRequest } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessionsFor, requireUser } from "@/server/auth/session";
import { User } from "@/server/models";
import { audit } from "@/server/services/audit";

export const POST = api(async (req) => {
  const auth = await requireUser();
  rateLimit(`password:${auth.id}`, 10, 15 * 60_000);
  const body = await readJson(req);
  const current = str(body, "currentPassword", { max: 128, label: "Current password" });
  const error = validatePasswordStrength(body.newPassword);
  if (error) throw badRequest(error, "newPassword");

  const user = await User.findById(auth.id).select("+passwordHash");
  if (!user || !(await verifyPassword(current, user.passwordHash)))
    throw new ApiError(400, "Current password is incorrect.", "bad_request", "currentPassword");
  user.passwordHash = await hashPassword(body.newPassword as string);
  await user.save();
  // Sign out every other device, then start a fresh session here.
  await destroyAllSessionsFor(auth.id);
  await createSession(auth.id, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  if (auth.role !== "customer") await audit(auth, "user.password", "User", auth.id, "Changed own password");
  return json({ ok: true });
});
