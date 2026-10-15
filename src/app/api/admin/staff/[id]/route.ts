import { api, json, readJson } from "@/server/lib/http";
import { bool, clearableStr, email, objectId, objectIdArray, oneOf, optPhone, optStr } from "@/server/lib/validate";
import { badRequest, conflict, forbidden, notFound } from "@/server/lib/errors";
import { destroyAllSessionsFor, requirePermission } from "@/server/auth/session";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { User, type UserDoc } from "@/server/models";
import { parseBreaks, parseExtraPermissions, parseWorkingHours, serialiseStaff } from "@/server/services/staff";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("staff.manage", "availability.own");
  const id = objectId((await ctx.params).id);
  const target = await User.findOne({ _id: id, role: { $in: ["owner", "receptionist", "stylist"] } }).lean<UserDoc>();
  if (!target) throw notFound("Staff member not found.");
  const isOwner = user.permissions.includes("staff.manage");
  const isSelf = String(target._id) === user.id;
  if (!isOwner && !isSelf) throw forbidden();

  const body = await readJson(req);
  const set: Record<string, unknown> = {};

  // Availability: the owner for anyone, staff for themselves.
  if ("workingHours" in body) set["staff.workingHours"] = parseWorkingHours(body.workingHours);
  if ("breaks" in body) set["staff.breaks"] = parseBreaks(body.breaks, true);

  if (isOwner) {
    const name = optStr(body, "name", { min: 1, max: 100 });
    if (name) set.name = name;
    if ("email" in body) {
      const mail = email(body);
      if (await User.exists({ email: mail, isGuest: false, _id: { $ne: id } })) throw conflict("Another account uses this email.");
      set.email = mail;
    }
    if ("phone" in body) set.phone = optPhone(body) ?? "";
    const title = clearableStr(body, "title", { max: 80 });
    if (title !== undefined) set["staff.title"] = title;
    const bio = clearableStr(body, "bio", { max: 600 });
    if (bio !== undefined) set["staff.bio"] = bio;
    const bookable = bool(body, "bookable");
    if (bookable !== undefined) set["staff.bookable"] = bookable;
    if ("services" in body) set["staff.services"] = objectIdArray(body, "services", { max: 200 });

    if (target.role !== "owner") {
      if ("role" in body) set.role = oneOf(body, "role", ["receptionist", "stylist"] as const);
      if ("extraPermissions" in body) set.extraPermissions = parseExtraPermissions(body.extraPermissions);
      const active = bool(body, "active");
      if (active !== undefined) set.active = active;
    } else if ("role" in body || body.active === false) {
      throw badRequest("The owner account's role and status cannot be changed.");
    }

    if (body.newPassword !== undefined) {
      const err = validatePasswordStrength(body.newPassword);
      if (err) throw badRequest(err, "newPassword");
      set.passwordHash = await hashPassword(body.newPassword as string);
    }
  }

  const updated = await User.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean<UserDoc>();
  if (set.active === false || set.passwordHash || set.role) await destroyAllSessionsFor(String(id));
  const fields = Object.keys(set).map((k) => (k === "passwordHash" ? "password reset" : k.replace("staff.", "")));
  await audit(user, "staff.update", "User", String(id), `Updated ${target.name}: ${fields.join(", ")}`);
  return json({ staff: serialiseStaff(updated!) });
});
