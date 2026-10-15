import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import { Appointment, SlotLock, User, type AppointmentDoc } from "@/server/models";
import type { AppointmentStatus } from "@/lib/constants";
import { STATUS_LABELS } from "@/lib/constants";
import { ApiError, badRequest, conflict, forbidden, notFound } from "@/server/lib/errors";
import { formatDateTime, istToUtc } from "@/lib/time";
import { dayAvailability, eligibleStaff, loadBookableServices, validateBookingWindow } from "./availability";
import { lockBlocks, summariseServices } from "./availability-core";
import { getSettings, type Settings } from "./settings";
import { notifyBooking } from "./notifications";
import { consumeForServices } from "./inventory";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRef(): string {
  let ref = "VG";
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return ref;
}

const isDuplicate = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Insert unique 5-minute locks; returns false if any block is already taken. */
async function acquireLocks(resourceId: Types.ObjectId, blocks: Date[], appointmentId: Types.ObjectId): Promise<boolean> {
  if (!blocks.length) return true;
  try {
    await SlotLock.insertMany(
      blocks.map((slot) => ({ resourceId, slot, appointmentId })),
      { ordered: true },
    );
    return true;
  } catch (err) {
    if (!isDuplicate(err) && !(err as { writeErrors?: unknown[] }).writeErrors) throw err;
    await SlotLock.deleteMany({ appointmentId, resourceId, slot: { $in: blocks } });
    return false;
  }
}

export async function releaseLocks(appointmentId: Types.ObjectId) {
  await SlotLock.deleteMany({ appointmentId });
}

export interface CustomerInput {
  userId?: string;
  name: string;
  phone: string;
  email?: string;
}

/** Registered customers book as themselves; guests get (or reuse) a guest profile by phone. */
export async function resolveCustomer(c: CustomerInput) {
  if (c.userId) {
    const user = await User.findById(c.userId);
    if (!user) throw notFound("Customer not found.");
    if (!user.phone) {
      user.phone = c.phone;
      await user.save();
    }
    return { id: user._id as Types.ObjectId, snapshot: { name: c.name, phone: c.phone, email: c.email ?? user.email ?? undefined } };
  }
  const upsert = () =>
    User.findOneAndUpdate(
      { phone: c.phone, isGuest: true },
      {
        $set: { name: c.name, ...(c.email ? { email: c.email } : {}) },
        $setOnInsert: { isGuest: true, role: "customer", phone: c.phone },
      },
      { upsert: true, new: true },
    );
  let guest;
  try {
    guest = await upsert();
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    guest = await upsert(); // lost an insert race; the second attempt finds the row
  }
  return { id: guest!._id as Types.ObjectId, snapshot: { name: c.name, phone: c.phone, email: c.email } };
}

export interface CreateBookingInput {
  serviceIds: Types.ObjectId[];
  staffId?: Types.ObjectId | null;
  dateKey: string;
  minutes: number;
  customer: CustomerInput;
  notes?: string;
  source: "online" | "walk_in" | "phone" | "staff";
  paymentPreference?: "pay_at_salon" | "online";
  actor?: { id: string; name: string } | null;
  idempotencyKey?: string;
  initialStatus?: AppointmentStatus;
}

export async function createBooking(input: CreateBookingInput) {
  const settings = await getSettings();
  const online = input.source === "online";
  if (online && !settings.booking?.onlineEnabled)
    throw new ApiError(403, "Online booking is currently unavailable. Please contact the salon.", "booking_disabled");

  if (input.idempotencyKey) {
    const existing = await Appointment.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
  }

  const services = await loadBookableServices(input.serviceIds, { online });
  if (online) validateBookingWindow(input.dateKey, settings);
  const preferred = online && !settings.booking?.staffSelectionEnabled ? null : (input.staffId ?? null);
  const staff = await eligibleStaff(services, preferred);
  if (preferred && !staff.length) throw badRequest("The selected stylist does not offer these services.", "staffId");

  const slots = await dayAvailability({ dateKey: input.dateKey, services, staff, settings, forStaff: !online });
  const slot = slots.find((s) => s.minutes === input.minutes);
  if (!slot) throw conflict("Sorry, that time is no longer available. Please choose another slot.");

  const summary = summariseServices(services);
  const start = istToUtc(input.dateKey, input.minutes);
  const end = new Date(start.getTime() + summary.durationMin * 60_000);
  const blocks = lockBlocks(start, summary.durationMin + summary.bufferMin);
  const customer = await resolveCustomer(input.customer);
  const appointmentId = new Types.ObjectId();

  let assigned: Types.ObjectId | null = null;
  for (const candidate of slot.staffIds) {
    const resource = new Types.ObjectId(candidate);
    if (await acquireLocks(resource, blocks, appointmentId)) {
      assigned = resource;
      break;
    }
  }
  if (!assigned) throw conflict("Sorry, that time was just booked by someone else. Please choose another slot.");

  const status: AppointmentStatus =
    input.initialStatus ?? (online ? (settings.booking?.autoConfirm ? "confirmed" : "pending") : "confirmed");

  let appt;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        appt = await Appointment.create({
          _id: appointmentId,
          ref: generateRef(),
          customerId: customer.id,
          customer: customer.snapshot,
          items: services.map((s) => ({
            serviceId: s._id,
            name: s.name,
            kind: s.kind,
            durationMin: s.durationMin,
            price: s.price,
            priceVerified: s.priceVerified !== false,
          })),
          staffId: assigned,
          start,
          end,
          durationMin: summary.durationMin,
          bufferMin: summary.bufferMin,
          status,
          source: input.source,
          paymentPreference: input.paymentPreference ?? "pay_at_salon",
          estimatedTotal: summary.total,
          customerNotes: input.notes,
          checkedInAt: status === "checked_in" ? new Date() : undefined,
          idempotencyKey: input.idempotencyKey,
          history: [{ status, by: input.actor?.id, byName: input.actor?.name ?? input.customer.name, note: `Booked (${input.source.replace("_", "-")})` }],
        });
        break;
      } catch (err) {
        // Retry only on a booking-reference collision.
        if (isDuplicate(err) && attempt < 3 && String((err as Error).message).includes("ref_")) continue;
        throw err;
      }
    }
  } catch (err) {
    await releaseLocks(appointmentId);
    if (isDuplicate(err) && input.idempotencyKey) {
      const existing = await Appointment.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }
    throw err;
  }

  await notifyBooking(status === "confirmed" ? "booking_confirmed" : "booking_received", appt);
  return appt;
}

// ---- Status workflow -------------------------------------------------------------------

export const STATUS_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "in_progress", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Transitions a stylist may make on their own appointments. */
const STYLIST_TARGETS: AppointmentStatus[] = ["in_progress", "completed"];

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return STATUS_FLOW[from]?.includes(to) ?? false;
}

interface Actor {
  id?: string;
  name: string;
}

export async function changeStatus(
  appointmentId: Types.ObjectId,
  to: AppointmentStatus,
  actor: Actor,
  opts: { note?: string; stylistId?: string } = {},
) {
  const from = (Object.keys(STATUS_FLOW) as AppointmentStatus[]).filter((s) => STATUS_FLOW[s].includes(to));
  if (!from.length) throw badRequest("That status change is not allowed.");
  if (opts.stylistId && !STYLIST_TARGETS.includes(to)) throw forbidden();

  const now = new Date();
  const set: Record<string, unknown> = { status: to };
  if (to === "checked_in") set.checkedInAt = now;
  if (to === "in_progress") set.startedAt = now;
  if (to === "completed") set.completedAt = now;
  if (to === "cancelled") set.cancelledAt = now;

  const filter: Record<string, unknown> = { _id: appointmentId, status: { $in: from } };
  if (opts.stylistId) filter.staffId = new Types.ObjectId(opts.stylistId);

  const appt = await Appointment.findOneAndUpdate(
    filter,
    {
      $set: set,
      $push: { history: { status: to, at: now, by: actor.id, byName: actor.name, note: opts.note?.slice(0, 500) } },
    },
    { new: true },
  );
  if (!appt) {
    const current = await Appointment.findById(appointmentId).select("status staffId").lean();
    if (!current) throw notFound("Appointment not found.");
    if (opts.stylistId && String(current.staffId) !== opts.stylistId) throw forbidden();
    throw conflict(`This appointment is ${STATUS_LABELS[current.status as AppointmentStatus]} and cannot be changed to ${STATUS_LABELS[to]}.`);
  }

  if (to === "cancelled" || to === "no_show") await releaseLocks(appt._id);

  if (to === "completed") {
    // Finished early: free the rest of the booked time so it can be booked again.
    const step = 5 * 60_000;
    await SlotLock.deleteMany({ appointmentId: appt._id, slot: { $gte: new Date(Math.floor(now.getTime() / step) * step) } });
    await User.updateOne({ _id: appt.customerId, firstVisitAt: { $exists: false } }, { $set: { firstVisitAt: now } });
    await User.updateOne({ _id: appt.customerId }, { $set: { lastVisitAt: now } });
    const settings = await getSettings();
    if (settings.features?.inventory) {
      const claimed = await Appointment.updateOne({ _id: appt._id, inventoryConsumed: false }, { $set: { inventoryConsumed: true } });
      if (claimed.modifiedCount) await consumeForServices(appt.items.map((i) => i.serviceId), appt._id, actor.id);
    }
  }

  if (to === "confirmed") await notifyBooking("booking_confirmed", appt);
  if (to === "cancelled") await notifyBooking("booking_cancelled", appt, opts.note);
  return appt;
}

// ---- Rescheduling / reassignment -------------------------------------------------------

export async function reschedule(
  appointmentId: Types.ObjectId,
  target: { dateKey: string; minutes: number; staffId?: Types.ObjectId | null },
  actor: Actor,
  opts: { online: boolean },
) {
  const appt = await Appointment.findById(appointmentId);
  if (!appt) throw notFound("Appointment not found.");
  if (!["pending", "confirmed"].includes(appt.status))
    throw conflict("Only pending or confirmed appointments can be rescheduled.");

  const settings = await getSettings();
  const services = await loadBookableServices(appt.items.map((i) => i.serviceId), { online: false });
  if (opts.online) validateBookingWindow(target.dateKey, settings);
  const staff = await eligibleStaff(services, target.staffId ?? null);
  if (target.staffId && !staff.length) throw badRequest("That stylist does not offer these services.", "staffId");

  const slots = await dayAvailability({
    dateKey: target.dateKey,
    services,
    staff,
    settings,
    forStaff: !opts.online,
    excludeAppointmentId: appt._id,
  });
  const slot = slots.find((s) => s.minutes === target.minutes);
  if (!slot) throw conflict("That time is not available. Please choose another slot.");

  // Prefer keeping the current stylist when they are free.
  const candidates = [...slot.staffIds].sort((a) => (a === String(appt.staffId) ? -1 : 1));
  const start = istToUtc(target.dateKey, target.minutes);
  const end = new Date(start.getTime() + appt.durationMin * 60_000);
  const newBlocks = lockBlocks(start, appt.durationMin + (appt.bufferMin ?? 0));
  const held = await SlotLock.find({ appointmentId: appt._id }).lean();

  let assigned: Types.ObjectId | null = null;
  for (const candidate of candidates) {
    const resource = new Types.ObjectId(candidate);
    const heldHere = new Set(held.filter((l) => l.resourceId.equals(resource)).map((l) => l.slot.getTime()));
    const toAcquire = newBlocks.filter((b) => !heldHere.has(b.getTime()));
    if (await acquireLocks(resource, toAcquire, appt._id)) {
      assigned = resource;
      break;
    }
  }
  if (!assigned) throw conflict("That time was just taken. Please choose another slot.");

  // Release blocks no longer needed.
  const keep = new Set(newBlocks.map((b) => b.getTime()));
  const stale = held.filter((l) => !l.resourceId.equals(assigned!) || !keep.has(l.slot.getTime())).map((l) => l._id);
  if (stale.length) await SlotLock.deleteMany({ _id: { $in: stale } });

  const previous = appt.start;
  const staffChanged = !appt.staffId.equals(assigned);
  const timeChanged = previous.getTime() !== start.getTime();
  appt.start = start;
  appt.end = end;
  appt.staffId = assigned;
  appt.reminderSentAt = undefined;
  if (appt.request?.type && !appt.request.resolved) appt.request.resolved = true;
  appt.history.push({
    status: appt.status,
    at: new Date(),
    by: actor.id ? new Types.ObjectId(actor.id) : undefined,
    byName: actor.name,
    note: timeChanged ? `Rescheduled from ${formatDateTime(previous)}` : "Stylist reassigned",
  });
  await appt.save();
  if (timeChanged) await notifyBooking("booking_rescheduled", appt, undefined, `:${start.getTime()}`);
  return { appt, staffChanged };
}

// ---- Customer self-service ------------------------------------------------------------

export function hoursUntil(appt: { start: Date }, now = new Date()) {
  return (appt.start.getTime() - now.getTime()) / 3_600_000;
}

export function assertWithinPolicy(appt: { start: Date }, settings: Settings, kind: "cancel" | "reschedule") {
  const cutoff =
    kind === "cancel" ? (settings.booking?.cancellationCutoffHours ?? 0) : (settings.booking?.rescheduleCutoffHours ?? 0);
  if (hoursUntil(appt) < cutoff) {
    throw new ApiError(
      403,
      `Appointments can only be ${kind === "cancel" ? "cancelled" : "rescheduled"} online up to ${cutoff} hour(s) before the start time. Please send a request or contact the salon.`,
      "policy",
    );
  }
}

export async function customerCancel(appt: AppointmentDoc, reason: string | undefined, name: string) {
  if (!["pending", "confirmed"].includes(appt.status)) throw conflict("This appointment can no longer be cancelled.");
  const settings = await getSettings();
  assertWithinPolicy(appt, settings, "cancel");
  return changeStatus(appt._id, "cancelled", { name }, { note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer" });
}

export async function customerRequest(
  appt: AppointmentDoc,
  type: "cancel" | "reschedule",
  reason: string | undefined,
  preferredTime: string | undefined,
) {
  if (!["pending", "confirmed"].includes(appt.status)) throw conflict("This appointment can no longer be changed.");
  await Appointment.updateOne(
    { _id: appt._id },
    { $set: { request: { type, reason, preferredTime, at: new Date(), resolved: false } } },
  );
}

// ---- Serialisation --------------------------------------------------------------------

export async function staffNameMap(ids: Types.ObjectId[]) {
  const unique = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

type Lean = AppointmentDoc;

export function serialiseForCustomer(a: Lean, staffNames: Map<string, string>) {
  return {
    id: String(a._id),
    ref: a.ref,
    status: a.status,
    start: a.start,
    end: a.end,
    durationMin: a.durationMin,
    items: a.items.map((i) => ({ name: i.name, price: i.price, durationMin: i.durationMin, priceVerified: i.priceVerified })),
    estimatedTotal: a.estimatedTotal,
    stylist: staffNames.get(String(a.staffId)) ?? null,
    customerNotes: a.customerNotes ?? "",
    customer: { name: a.customer.name },
    request: a.request?.type && !a.request.resolved ? { type: a.request.type, at: a.request.at } : null,
    invoiceId: a.invoiceId ? String(a.invoiceId) : null,
    reviewed: !!a.reviewed,
  };
}

export function serialiseForStaff(a: Lean, staffNames: Map<string, string>, opts: { internal: boolean; contact: boolean }) {
  return {
    ...serialiseForCustomer(a, staffNames),
    staffId: String(a.staffId),
    serviceIds: a.items.map((i) => String(i.serviceId)),
    customerId: String(a.customerId),
    customer: {
      name: a.customer.name,
      phone: opts.contact ? a.customer.phone : undefined,
      email: opts.contact ? a.customer.email : undefined,
    },
    source: a.source,
    bufferMin: a.bufferMin,
    serviceNotes: a.serviceNotes ?? "",
    internalNotes: opts.internal ? (a.internalNotes ?? "") : undefined,
    request: a.request?.type ? a.request : null,
    checkedInAt: a.checkedInAt,
    history: a.history.map((h) => ({ status: h.status, at: h.at, byName: h.byName, note: h.note })),
    paymentPreference: a.paymentPreference,
  };
}
