import { Types } from "mongoose";
import { api, json, readJson } from "@/server/lib/http";
import { isObjectId, isoDate, oneOf, optObjectId, optStr } from "@/server/lib/validate";
import { badRequest, forbidden } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Appointment, TimeOff, User } from "@/server/models";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  const user = await requirePermission("staff.manage", "appointments.view_all", "availability.own");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = { end: { $gte: p.get("from") ? new Date(p.get("from")!) : new Date(Date.now() - 7 * 86_400_000) } };
  if (!user.permissions.includes("staff.manage") && !user.permissions.includes("appointments.view_all")) {
    filter.$or = [{ staffId: new Types.ObjectId(user.id) }, { staffId: null }];
  } else if (p.get("staff") && isObjectId(p.get("staff"))) {
    filter.staffId = new Types.ObjectId(p.get("staff")!);
  }
  const items = await TimeOff.find(filter).sort({ start: 1 }).limit(200).lean();
  const names = new Map((await User.find({ _id: { $in: items.map((i) => i.staffId).filter(Boolean) } }).select("name").lean()).map((u) => [String(u._id), u.name]));
  return json({
    items: items.map((t) => ({
      id: String(t._id),
      staffId: t.staffId ? String(t.staffId) : null,
      staffName: t.staffId ? (names.get(String(t.staffId)) ?? "") : "Whole salon",
      kind: t.kind,
      start: t.start,
      end: t.end,
      reason: t.reason ?? "",
    })),
  });
});

export const POST = api(async (req) => {
  const user = await requirePermission("staff.manage", "availability.own");
  const body = await readJson(req);
  const staffId = optObjectId(body, "staffId") ?? null;
  const isOwner = user.permissions.includes("staff.manage");
  if (!isOwner && (!staffId || String(staffId) !== user.id)) throw forbidden("You can only add leave for yourself.");
  const kind = oneOf(body, "kind", ["holiday", "closure", "leave", "block"] as const);
  if (!staffId && !["holiday", "closure", "block"].includes(kind)) throw badRequest("Choose a staff member for leave.", "staffId");
  const start = isoDate(body.start, "start");
  const end = isoDate(body.end, "end");
  if (end <= start) throw badRequest("End must be after start.", "end");
  if (end.getTime() - start.getTime() > 366 * 86_400_000) throw badRequest("Time off cannot exceed a year.", "end");

  const item = await TimeOff.create({ staffId, kind, start, end, reason: optStr(body, "reason", { max: 200 }), createdBy: user.id });
  // Existing bookings are not cancelled automatically; report clashes so they can be moved.
  const clashes = await Appointment.find({
    ...(staffId ? { staffId } : {}),
    status: { $in: ACTIVE_STATUSES },
    start: { $lt: end },
    end: { $gt: start },
  })
    .select("ref start customer.name")
    .limit(50)
    .lean();
  await audit(user, "timeoff.create", "TimeOff", String(item._id), `${kind} ${formatDateTime(start)} – ${formatDateTime(end)}`);
  return json({ id: String(item._id), clashes: clashes.map((c) => ({ id: String(c._id), ref: c.ref, start: c.start, customer: c.customer.name })) }, 201);
});
