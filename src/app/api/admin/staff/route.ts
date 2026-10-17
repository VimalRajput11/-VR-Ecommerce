import { api, json, readJson } from "@/server/lib/http";
import { email, objectIdArray, oneOf, optPhone, optStr, str } from "@/server/lib/validate";
import { badRequest, conflict, forbidden } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { User, type UserDoc } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { parseExtraPermissions, serialiseStaff } from "@/server/services/staff";
import { audit } from "@/server/services/audit";

export const GET = api(async () => {
  // Anyone who books or bills needs the stylist list; full profiles need staff.manage.
  const user = await requirePermission("staff.manage", "appointments.manage", "appointments.view_all", "availability.own");
  const filter = user.permissions.includes("staff.manage")
    ? { role: { $in: ["owner", "receptionist", "stylist"] }, deletedAt: { $exists: false } }
    : user.permissions.includes("appointments.view_all") || user.permissions.includes("appointments.manage")
      ? { role: { $in: ["owner", "receptionist", "stylist"] }, active: true, deletedAt: { $exists: false } }
      : { _id: user.id };
  const staff = await User.find(filter).sort({ role: 1, name: 1 }).lean<UserDoc[]>();
  const full = user.permissions.includes("staff.manage");
  return json({
    staff: staff.map((s) => {
      const data = serialiseStaff(s);
      return full || String(s._id) === user.id
        ? data
        : { id: data.id, name: data.name, role: data.role, title: data.title, bookable: data.bookable, active: data.active, services: data.services };
    }),
  });
});

export const POST = api(async (req) => {
  const user = await requirePermission("staff.manage");
  const settings = await getSettings();
  if (!settings.features?.staffAccounts) throw forbidden("Staff accounts are disabled in settings.");
  const body = await readJson(req);
  const role = oneOf(body, "role", ["receptionist", "stylist"] as const);
  const mail = email(body);
  const pwError = validatePasswordStrength(body.password);
  if (pwError) throw badRequest(`Temporary password: ${pwError}`, "password");
  if (await User.exists({ email: mail, isGuest: false })) throw conflict("An account with this email already exists.");

  const staff = await User.create({
    name: str(body, "name", { max: 100, label: "Name" }),
    email: mail,
    phone: optPhone(body),
    role,
    passwordHash: await hashPassword(body.password as string),
    extraPermissions: "extraPermissions" in body ? parseExtraPermissions(body.extraPermissions) : [],
    staff: {
      title: optStr(body, "title", { max: 80 }),
      bookable: body.bookable === true || role === "stylist",
      services: "services" in body ? objectIdArray(body, "services", { max: 200 }) : [],
    },
  });
  await audit(user, "staff.create", "User", String(staff._id), `Added ${role} ${staff.name}`);
  return json({ staff: serialiseStaff(staff.toObject()) }, 201);
});
