import type { NextRequest } from "next/server";
import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, dateKey, int, objectId, oneOf, optStr } from "@/server/lib/validate";
import { forbidden, notFound } from "@/server/lib/errors";
import { requirePermission, type AuthUser } from "@/server/auth/session";
import { Appointment, Invoice, type AppointmentDoc } from "@/server/models";
import { APPOINTMENT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { changeStatus, reschedule, serialiseForStaff, staffNameMap } from "@/server/services/booking";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

async function load(user: AuthUser, id: string) {
  const appt = await Appointment.findById(objectId(id)).lean<AppointmentDoc>();
  if (!appt) throw notFound("Appointment not found.");
  if (!user.permissions.includes("appointments.view_all") && String(appt.staffId) !== user.id) throw notFound("Appointment not found.");
  return appt;
}

async function respond(user: AuthUser, id: string) {
  const appt = await load(user, id);
  const names = await staffNameMap([appt.staffId]);
  const invoice = appt.invoiceId ? await Invoice.findById(appt.invoiceId).select("number status balanceDue total").lean() : null;
  return json({
    appointment: serialiseForStaff(appt, names, {
      internal: user.permissions.includes("appointments.internal_notes"),
      contact: user.permissions.includes("customers.view"),
    }),
    invoice: invoice ? { id: String(invoice._id), number: invoice.number, status: invoice.status, balanceDue: invoice.balanceDue, total: invoice.total } : null,
  });
}

export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("appointments.view_all", "appointments.view_own");
  return respond(user, (await ctx.params).id);
});

export const PATCH = api<Ctx>(async (req: NextRequest, ctx) => {
  const user = await requirePermission("appointments.view_all", "appointments.view_own");
  const { id } = await ctx.params;
  const appt = await load(user, id);
  const body = await readJson(req);
  const action = oneOf(body, "action", ["status", "reschedule", "assign", "notes", "resolve_request"] as const);
  const canManage = user.permissions.includes("appointments.manage");
  const isOwn = String(appt.staffId) === user.id;
  const actor = { id: user.id, name: user.name };

  if (action === "status") {
    const to = oneOf(body, "status", APPOINTMENT_STATUSES);
    const note = optStr(body, "note", { max: 500 });
    if (canManage) await changeStatus(appt._id, to, actor, { note });
    else if (isOwn && user.permissions.includes("appointments.status_own")) await changeStatus(appt._id, to, actor, { note, stylistId: user.id });
    else throw forbidden();
    await audit(user, "appointment.status", "Appointment", id, `${appt.ref}: ${STATUS_LABELS[appt.status]} → ${STATUS_LABELS[to]}`);
  } else if (action === "reschedule" || action === "assign") {
    if (!canManage) throw forbidden();
    const staffId = body.staffId ? objectId(body.staffId, "staffId") : null;
    const target =
      action === "assign"
        ? { dateKey: dateKey(body.date), minutes: int(body, "minutes", { min: 0, max: 1439 }), staffId: objectId(body.staffId, "staffId") }
        : { dateKey: dateKey(body.date), minutes: int(body, "minutes", { min: 0, max: 1439 }), staffId };
    await reschedule(appt._id, target, actor, { online: false });
    await audit(user, `appointment.${action}`, "Appointment", id, `${appt.ref} ${action === "assign" ? "stylist changed" : "rescheduled"}`);
  } else if (action === "notes") {
    const set: Record<string, string> = {};
    const internal = clearableStr(body, "internalNotes", { max: 2000 });
    if (internal !== undefined) {
      if (!user.permissions.includes("appointments.internal_notes")) throw forbidden();
      set.internalNotes = internal;
    }
    const service = clearableStr(body, "serviceNotes", { max: 2000 });
    if (service !== undefined) {
      if (!canManage && !isOwn) throw forbidden();
      set.serviceNotes = service;
    }
    await Appointment.updateOne({ _id: appt._id }, { $set: set });
  } else {
    if (!canManage) throw forbidden();
    await Appointment.updateOne({ _id: appt._id }, { $set: { "request.resolved": true } });
    await audit(user, "appointment.request_resolved", "Appointment", id, `${appt.ref}: customer request marked resolved`);
  }
  return respond(user, id);
});
