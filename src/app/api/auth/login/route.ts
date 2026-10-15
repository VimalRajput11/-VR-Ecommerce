import { api, json, readJson } from "@/server/lib/http";
import { email, str } from "@/server/lib/validate";
import { ApiError } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { User } from "@/server/models";

export const POST = api(async (req) => {
  const ip = clientIp(req);
  rateLimit(`login-ip:${ip}`, 30, 15 * 60_000);
  const body = await readJson(req);
  const mail = email(body);
  const password = str(body, "password", { max: 128, label: "Password" });
  rateLimit(`login-email:${mail}`, 10, 15 * 60_000);

  const user = await User.findOne({ email: mail, isGuest: false }).select("+passwordHash");
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw new ApiError(401, "Incorrect email or password.", "invalid_credentials");
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Please contact the salon.", "inactive");

  user.lastLoginAt = new Date();
  await user.save();
  await createSession(String(user._id), { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ user: { id: String(user._id), name: user.name, role: user.role } });
});
