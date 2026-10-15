import { api, json, readJson } from "@/server/lib/http";
import { email, optPhone, str } from "@/server/lib/validate";
import { badRequest, conflict } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { User } from "@/server/models";

export const POST = api(async (req) => {
  const ip = clientIp(req);
  rateLimit(`register:${ip}`, 10, 60 * 60_000);
  const body = await readJson(req);
  const name = str(body, "name", { max: 100, label: "Name" });
  const mail = email(body);
  const phone = optPhone(body);
  const passwordError = validatePasswordStrength(body.password);
  if (passwordError) throw badRequest(passwordError, "password");
  if (body.acceptTerms !== true) throw badRequest("Please accept the terms and privacy policy.", "acceptTerms");

  if (await User.exists({ email: mail, isGuest: false })) throw conflict("An account with this email already exists. Please sign in.");
  const user = await User.create({
    name,
    email: mail,
    phone,
    passwordHash: await hashPassword(body.password as string),
    role: "customer",
    marketingConsent: body.marketingConsent === true,
  });
  await createSession(String(user._id), { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ user: { id: String(user._id), name: user.name, role: user.role } }, 201);
});
