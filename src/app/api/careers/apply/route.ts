import { api, json, readJson } from "@/server/lib/http";
import { isObjectId, objectId, optEmail, optInt, optStr, phone, str } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { JobApplication, JobOpening } from "@/server/models";
import { parsePortfolioUrl } from "@/server/services/careers";

/** Public job application. Applies to an open role, or as a general application. */
export const POST = api(async (req) => {
  rateLimit(`careers:${clientIp(req)}`, 5, 60 * 60_000);
  const body = await readJson(req);
  // Honeypot field: real visitors never fill it in.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true }, 201);
  if (body.consent !== true) throw badRequest("Please agree to us storing your details for hiring.", "consent");

  let openingId = null;
  let position = "General application";
  if (body.openingId && isObjectId(body.openingId)) {
    const opening = await JobOpening.findOne({ _id: objectId(body.openingId), active: true, archived: { $ne: true } }).lean();
    if (!opening) throw badRequest("This position is no longer open. Please choose another or send a general application.", "openingId");
    openingId = opening._id;
    position = opening.title;
  }

  const ph = phone(body);
  // Stop accidental double submissions for the same role.
  const recent = await JobApplication.exists({ phone: ph, openingId, createdAt: { $gt: new Date(Date.now() - 24 * 3_600_000) } });
  if (recent) return json({ ok: true, duplicate: true }, 200);

  await JobApplication.create({
    openingId,
    position,
    name: str(body, "name", { max: 100, label: "Name" }),
    phone: ph,
    email: optEmail(body),
    city: optStr(body, "city", { max: 80 }),
    experienceYears: optInt(body, "experienceYears", { min: 0, max: 60, label: "Experience" }) ?? 0,
    skills: optStr(body, "skills", { max: 500 }),
    portfolioUrl: parsePortfolioUrl(optStr(body, "portfolioUrl", { max: 300 })),
    message: optStr(body, "message", { max: 2000 }),
  });
  return json({ ok: true }, 201);
});
