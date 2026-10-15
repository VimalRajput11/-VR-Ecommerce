import { api, json, readJson } from "@/server/lib/http";
import { optEmail, optPhone, optStr, str } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { ContactMessage } from "@/server/models";

export const POST = api(async (req) => {
  rateLimit(`contact:${clientIp(req)}`, 5, 30 * 60_000);
  const body = await readJson(req);
  // Honeypot field: real visitors never fill it in.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true }, 201);
  const mail = optEmail(body);
  const ph = optPhone(body);
  if (!mail && !ph) throw badRequest("Please share a phone number or email so we can reply.", "phone");
  await ContactMessage.create({
    name: str(body, "name", { max: 100, label: "Name" }),
    email: mail,
    phone: ph,
    subject: optStr(body, "subject", { max: 60 }),
    message: str(body, "message", { max: 2000, label: "Message" }),
  });
  return json({ ok: true }, 201);
});
