// Integration tests against a real MongoDB (a dedicated test database that is dropped first).
// Set MONGODB_URI_TEST to override; the suite is skipped if no server is reachable.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";

const TEST_URI = process.env.MONGODB_URI_TEST ?? "mongodb://127.0.0.1:27017/vg_saloon_test";
process.env.MONGODB_URI = TEST_URI;

let available = true;
try {
  const probe = await mongoose.createConnection(TEST_URI, { serverSelectionTimeoutMS: 2000 }).asPromise();
  await probe.close();
} catch {
  available = false;
}

const { connectDB, disconnectDB } = await import("../src/server/db");
const models = await import("../src/server/models");
const booking = await import("../src/server/services/booking");
const billing = await import("../src/server/services/billing");
const { permissionsFor } = await import("../src/lib/permissions");
const { addDaysToKey, dateKeyIST } = await import("../src/lib/time");

const { User, Service, ServiceCategory, BusinessSettings, Appointment, SlotLock, Coupon, Payment } = models;

const DAY = addDaysToKey(dateKeyIST(), 2);
let ownerId: string;
let stylistId: string;
let cutId: Types.ObjectId;
let colourId: Types.ObjectId;
const owner = () => ({ id: ownerId, name: "Owner", role: "owner" as const, permissions: permissionsFor("owner") });
const customer = (n: number) => ({ name: `Test Customer ${n}`, phone: `98765${String(n).padStart(5, "0")}` });

describe("integration (MongoDB)", { skip: !available && "MongoDB not reachable" }, () => {
  before(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    for (const m of Object.values(models)) {
      if (typeof m === "function" && "createIndexes" in m) await (m as unknown as mongoose.Model<unknown>).createIndexes();
    }
    await BusinessSettings.create({
      _id: "business",
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: false, open: "09:00", close: "21:00", breaks: [] })),
      booking: { onlineEnabled: true, slotIntervalMin: 15, minLeadMinutes: 0, maxAdvanceDays: 60, staffSelectionEnabled: true, guestBookingEnabled: true },
      notifications: { email: false, sms: false, whatsapp: false },
    });
    const o = await User.create({ name: "Owner", email: "owner@test.local", role: "owner", staff: { bookable: true } });
    const s = await User.create({ name: "Stylist", email: "stylist@test.local", role: "stylist", staff: { bookable: true } });
    ownerId = String(o._id);
    stylistId = String(s._id);
    const cat = await ServiceCategory.create({ name: "Hair", slug: "hair" });
    cutId = (await Service.create({ name: "Cut", slug: "cut", categoryId: cat._id, durationMin: 60, bufferMin: 15, price: 50000, priceVerified: true }))._id;
    colourId = (await Service.create({ name: "Colour", slug: "colour", categoryId: cat._id, durationMin: 30, price: 100000, priceVerified: true, taxable: true }))._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  });

  const book = (minutes: number, n: number, staffId: string | null = ownerId, extra: Partial<Parameters<typeof booking.createBooking>[0]> = {}) =>
    booking.createBooking({
      serviceIds: [cutId],
      staffId: staffId ? new Types.ObjectId(staffId) : null,
      dateKey: DAY,
      minutes,
      customer: customer(n),
      source: "online",
      ...extra,
    });

  test("concurrent requests for the same stylist and time: exactly one succeeds", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => book(10 * 60, i)));
    const ok = results.filter((r) => r.status === "fulfilled");
    assert.equal(ok.length, 1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      assert.equal((r as PromiseRejectedResult).reason.status, 409);
    }
    assert.equal(await Appointment.countDocuments({ staffId: ownerId, status: { $ne: "cancelled" } }), 1);
  });

  test("overlapping times (including buffer) are rejected; adjacent times are allowed", async () => {
    // 10:00-11:00 + 15 min buffer is booked above; 10:30 and 11:00 overlap, 11:15 is free.
    await assert.rejects(book(10 * 60 + 30, 50), { status: 409 });
    await assert.rejects(book(11 * 60, 51), { status: 409 });
    const ok = await book(11 * 60 + 15, 52);
    assert.equal(ok.status, "pending");
  });

  test("'any stylist' bookings spread across free stylists without double booking", async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => book(14 * 60, 100 + i, null)));
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof book>>>[];
    assert.equal(ok.length, 2);
    assert.notEqual(String(ok[0].value.staffId), String(ok[1].value.staffId));
  });

  test("cancelling releases the slot for rebooking", async () => {
    const appt = await book(16 * 60, 200);
    await assert.rejects(book(16 * 60, 201), { status: 409 });
    await booking.changeStatus(appt._id, "cancelled", { name: "Owner" });
    assert.equal(await SlotLock.countDocuments({ appointmentId: appt._id }), 0);
    const again = await book(16 * 60, 202);
    assert.ok(again._id);
  });

  test("rescheduling moves the booking and frees the old time", async () => {
    const appt = await book(18 * 60, 300);
    // Overlapping move (same stylist, 30 minutes later) must work against its own locks.
    await booking.reschedule(appt._id, { dateKey: DAY, minutes: 18 * 60 + 30, staffId: new Types.ObjectId(ownerId) }, { name: "Owner" }, { online: false });
    const moved = await Appointment.findById(appt._id);
    assert.equal(moved!.start.getTime() - appt.start.getTime(), 30 * 60_000);
    // 18:00-18:30 is now too short for a 60+15 min booking, but 19:45 is blocked until 19:45.
    await assert.rejects(book(19 * 60 + 30, 301), { status: 409 });
    const after = await book(19 * 60 + 45, 302);
    assert.ok(after._id);
  });

  test("invalid status transitions are refused", async () => {
    const appt = await book(9 * 60, 400, stylistId);
    await assert.rejects(booking.changeStatus(appt._id, "completed", { name: "Owner" }), { status: 409 });
    await booking.changeStatus(appt._id, "confirmed", { name: "Owner" });
    await booking.changeStatus(appt._id, "checked_in", { name: "Owner" });
    // A stylist can only act on their own appointments.
    await assert.rejects(booking.changeStatus(appt._id, "in_progress", { name: "X" }, { stylistId: ownerId }), { status: 403 });
    await booking.changeStatus(appt._id, "in_progress", { name: "Stylist" }, { stylistId });
    await booking.changeStatus(appt._id, "completed", { name: "Stylist" }, { stylistId });
  });

  test("completing early frees the remaining time for new bookings", async () => {
    const appt = await book(17 * 60, 450, stylistId);
    for (const s of ["confirmed", "checked_in", "in_progress", "completed"] as const) await booking.changeStatus(appt._id, s, { name: "Owner" });
    const next = await book(17 * 60, 451, stylistId);
    assert.ok(next._id);
  });

  test("idempotency key prevents duplicate submissions", async () => {
    const a = await book(12 * 60 + 30, 500, stylistId, { idempotencyKey: "guest:abc123" });
    const b = await book(12 * 60 + 30, 500, stylistId, { idempotencyKey: "guest:abc123" });
    assert.equal(String(a._id), String(b._id));
  });

  test("billing: server-side totals with tax, payments and refunds stay consistent", async () => {
    await BusinessSettings.updateOne({ _id: "business" }, { $set: { "tax.enabled": true, "tax.rateBps": 1800, "tax.inclusive": false } });
    const appt = await book(20 * 60, 600, stylistId);
    const inv = await billing.createInvoice({ appointmentId: appt._id, services: [{ serviceId: colourId, qty: 1 }] }, owner());
    assert.equal(inv.subtotal, 150000);
    assert.equal(inv.tax?.amount, 27000);
    assert.equal(inv.total, 177000);
    await assert.rejects(billing.createInvoice({ appointmentId: appt._id }, owner()), { status: 409 });

    await assert.rejects(billing.recordPayment(inv._id, { amount: 177001, method: "cash" }, owner()), { status: 409 });
    await billing.recordPayment(inv._id, { amount: 77000, method: "upi" }, owner());
    let fresh = await models.Invoice.findById(inv._id);
    assert.equal(fresh!.status, "partially_paid");
    assert.equal(fresh!.balanceDue, 100000);
    await billing.recordPayment(inv._id, { amount: 100000, method: "cash" }, owner());
    fresh = await models.Invoice.findById(inv._id);
    assert.equal(fresh!.status, "paid");

    await assert.rejects(billing.voidInvoice(inv._id, "test", owner()), { status: 409 });
    await assert.rejects(billing.refundPayment(inv._id, { amount: 177001, method: "cash", reason: "x" }, owner()), { status: 409 });
    await billing.refundPayment(inv._id, { amount: 2000, method: "cash", reason: "goodwill" }, owner());
    fresh = await models.Invoice.findById(inv._id);
    assert.equal(fresh!.status, "partially_refunded");
    await BusinessSettings.updateOne({ _id: "business" }, { $set: { "tax.enabled": false } });
  });

  test("disabled payment methods are rejected", async () => {
    const inv = await billing.createInvoice({ customer: customer(700), services: [{ serviceId: cutId, qty: 1 }] }, owner());
    await assert.rejects(billing.recordPayment(inv._id, { amount: 100, method: "card" }, owner()), { status: 400 });
    await assert.rejects(billing.recordPayment(inv._id, { amount: 100, method: "online" }, owner()), { status: 400 });
  });

  test("gateway payments are applied once even if delivered twice", async () => {
    const inv = await billing.createInvoice({ customer: customer(800), services: [{ serviceId: cutId, qty: 1 }] }, owner());
    const [a, b] = await Promise.all([
      billing.recordPayment(inv._id, { amount: 20000, method: "online", gatewayPaymentId: "pay_TEST1" }, null),
      billing.recordPayment(inv._id, { amount: 20000, method: "online", gatewayPaymentId: "pay_TEST1" }, null),
    ]);
    assert.ok(a.duplicate || b.duplicate);
    assert.equal(await Payment.countDocuments({ gatewayPaymentId: "pay_TEST1" }), 1);
    const fresh = await models.Invoice.findById(inv._id);
    assert.equal(fresh!.amountPaid, 20000);
  });

  test("coupon redemption limits hold under concurrency and never go negative", async () => {
    await Coupon.create({
      code: "ONCE",
      title: "One use",
      type: "flat",
      value: 999999,
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
      maxRedemptions: 1,
      perCustomerLimit: 5,
    });
    const results = await Promise.allSettled(
      [0, 1, 2].map((i) => billing.createInvoice({ customer: customer(900 + i), services: [{ serviceId: cutId, qty: 1 }], couponCode: "ONCE" }, owner())),
    );
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof billing.createInvoice>>>[];
    assert.equal(ok.length, 1);
    assert.equal(ok[0].value.total, 0); // flat discount larger than the bill is capped at the subtotal
    assert.equal((await Coupon.findOne({ code: "ONCE" }))!.redemptions, 1);
  });

  test("receptionist discounts are capped by settings", async () => {
    const receptionist = { id: ownerId, name: "Front desk", role: "receptionist" as const, permissions: permissionsFor("receptionist") };
    await assert.rejects(
      billing.createInvoice({ customer: customer(950), services: [{ serviceId: cutId, qty: 1 }], manualDiscount: { type: "percent", value: 50, reason: "x" } }, receptionist),
      { status: 403 },
    );
    const inv = await billing.createInvoice({ customer: customer(951), services: [{ serviceId: cutId, qty: 1 }], manualDiscount: { type: "percent", value: 10, reason: "regular" } }, receptionist);
    assert.equal(inv.total, 45000);
  });
});
