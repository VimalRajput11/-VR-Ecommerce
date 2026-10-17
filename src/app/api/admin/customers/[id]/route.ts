import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, objectId, optEmail, optPhone, optStr } from "@/server/lib/validate";
import { forbidden, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Appointment, Invoice, User, type AppointmentDoc } from "@/server/models";
import { staffNameMap } from "@/server/services/booking";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("customers.view");
  const id = objectId((await ctx.params).id);
  const customer = await User.findOne({ _id: id, role: "customer" }).lean();
  if (!customer) throw notFound("Customer not found.");
  const [appointments, invoices] = await Promise.all([
    Appointment.find({ customerId: id }).sort({ start: -1 }).limit(100).lean<AppointmentDoc[]>(),
    Invoice.find({ customerId: id }).sort({ issuedAt: -1 }).limit(100).lean(),
  ]);
  const names = await staffNameMap(appointments.map((a) => a.staffId));
  const live = invoices.filter((i) => i.status !== "void");
  const canSeeNotes = user.permissions.includes("customers.manage") || user.permissions.includes("appointments.internal_notes");
  // Visits = completed appointments + bills made without an appointment (walk-ins).
  const walkInBills = live.filter((i) => !i.appointmentId);
  const billDates = live.map((i) => i.issuedAt.getTime());
  const visitDates = [customer.firstVisitAt, customer.lastVisitAt].filter((d): d is Date => !!d).map((d) => d.getTime()).concat(billDates);
  const firstVisitAt = visitDates.length ? new Date(Math.min(...visitDates)) : null;
  const lastVisitAt = visitDates.length ? new Date(Math.max(...visitDates)) : null;
  return json({
    customer: {
      id: String(customer._id),
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      isGuest: !!customer.isGuest,
      preferences: customer.preferences ?? "",
      internalNotes: canSeeNotes ? (customer.internalNotes ?? "") : undefined,
      marketingConsent: !!customer.marketingConsent,
      loyaltyPoints: customer.loyaltyPoints ?? 0,
      firstVisitAt,
      lastVisitAt,
      createdAt: customer.createdAt,
    },
    summary: {
      visits: appointments.filter((a) => a.status === "completed").length + walkInBills.length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
      noShows: appointments.filter((a) => a.status === "no_show").length,
      billed: live.reduce((s, i) => s + i.total, 0),
      paid: live.reduce((s, i) => s + i.amountPaid - i.amountRefunded, 0),
      due: live.reduce((s, i) => s + i.balanceDue, 0),
    },
    appointments: appointments.map((a) => ({
      id: String(a._id),
      ref: a.ref,
      start: a.start,
      status: a.status,
      services: a.items.map((i) => i.name).join(", "),
      stylist: names.get(String(a.staffId)) ?? "",
      serviceNotes: a.serviceNotes ?? "",
    })),
    invoices: invoices.map((i) => ({ id: String(i._id), number: i.number, issuedAt: i.issuedAt, total: i.total, balanceDue: i.balanceDue, status: i.status })),
  });
});

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("customers.manage", "appointments.internal_notes");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {};
  const full = user.permissions.includes("customers.manage");
  if (full) {
    const name = optStr(body, "name", { min: 1, max: 100 });
    if (name) set.name = name;
    if ("phone" in body) set.phone = optPhone(body) ?? "";
    if ("email" in body) set.email = optEmail(body) ?? "";
    const prefs = clearableStr(body, "preferences", { max: 1000 });
    if (prefs !== undefined) set.preferences = prefs;
    // Recorded by staff when the customer agrees at the salon to receive offers (e.g. on WhatsApp).
    if (typeof body.marketingConsent === "boolean") set.marketingConsent = body.marketingConsent;
  } else if (["name", "phone", "email", "preferences", "marketingConsent"].some((k) => k in body)) {
    throw forbidden();
  }
  const notes = clearableStr(body, "internalNotes", { max: 2000 });
  if (notes !== undefined) set.internalNotes = notes;
  const customer = await User.findOneAndUpdate({ _id: id, role: "customer" }, { $set: set }, { new: true, runValidators: true }).lean();
  if (!customer) throw notFound("Customer not found.");
  await audit(user, "customer.update", "User", String(id), `Updated customer ${customer.name}: ${Object.keys(set).join(", ")}`);
  return json({ ok: true });
});
