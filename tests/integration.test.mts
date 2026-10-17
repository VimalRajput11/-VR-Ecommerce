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
const pos = await import("../src/server/services/pos");
const payroll = await import("../src/server/services/payroll");
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

  // ------------------------------------------------------------ POS billing
  describe("POS billing", () => {
    const stylist = () => new Types.ObjectId(stylistId);
    const ownerOid = () => new Types.ObjectId(ownerId);
    let key = 0;
    const k = () => `test-key-${++key}`;
    const cut = (allocations?: { staffId: Types.ObjectId; percent: number }[]) => [{ serviceId: cutId, qty: 1, allocations }];
    const inv = (id: Types.ObjectId) => models.Invoice.findById(id).lean();

    before(async () => {
      await BusinessSettings.updateOne({ _id: "business" }, { $set: { "payments.card": true, "payments.upi": true, "tax.enabled": false } });
    });

    test("split payment settles a bill and staff shares drive commission", async () => {
      const r = await pos.finalizeBill(
        { customer: customer(1001), services: cut([{ staffId: stylist(), percent: 60 }, { staffId: ownerOid(), percent: 40 }]) },
        [{ method: "cash", amount: 20000 }, { method: "upi", amount: 30000 }],
        owner(),
        { idempotencyKey: k() },
      );
      assert.deepEqual(r.failures, []);
      const i = await inv(r.invoiceId);
      assert.equal(i!.status, "paid");
      assert.equal(i!.balanceDue, 0);
      assert.equal(await Payment.countDocuments({ invoiceId: r.invoiceId, kind: "payment" }), 2);
      await models.PayProfile.updateOne({ userId: stylist() }, { $set: { commissionPercent: 10, monthlySalary: 0 } }, { upsert: true });
      const [row] = await payroll.payrollStatement(dateKeyIST().slice(0, 7), stylist());
      assert.ok(row.serviceSales >= 30000); // includes 60% of this ₹500 cut
      assert.equal(row.commission, Math.round(row.serviceSales / 10));
      // The owner did no other services this month, so they are credited exactly their 40% share.
      await models.PayProfile.updateOne({ userId: ownerOid() }, { $set: { commissionPercent: 5 } }, { upsert: true });
      const [ownerRow] = await payroll.payrollStatement(dateKeyIST().slice(0, 7), ownerOid());
      assert.equal(ownerRow.serviceSales, 20000);
      assert.equal(ownerRow.commission, 1000);
    });

    test("partial payment leaves the remaining balance; cash over the balance gives change", async () => {
      const part = await pos.finalizeBill({ customer: customer(1002), services: cut() }, [{ method: "upi", amount: 30000 }], owner(), { idempotencyKey: k() });
      const p = await inv(part.invoiceId);
      assert.equal(p!.status, "partially_paid");
      assert.equal(p!.balanceDue, 20000);

      const cash = await pos.finalizeBill({ customer: customer(1003), services: cut() }, [{ method: "cash", amount: 60000 }], owner(), { idempotencyKey: k() });
      assert.equal(cash.change, 10000);
      const c = await inv(cash.invoiceId);
      assert.equal(c!.status, "paid");
      assert.equal(c!.amountPaid, 50000);
      await assert.rejects(pos.finalizeBill({ customer: customer(1004), services: cut() }, [{ method: "card", amount: 50001 }], owner(), { idempotencyKey: k() }), { status: 400 });
    });

    test("the same finalize request never creates two invoices", async () => {
      const key1 = k();
      const run = () => pos.finalizeBill({ customer: customer(1005), services: cut() }, [{ method: "cash", amount: 50000 }], owner(), { idempotencyKey: key1 });
      const [a, b] = await Promise.all([run(), run()]);
      assert.equal(String(a.invoiceId), String(b.invoiceId));
      assert.ok(a.duplicate || b.duplicate);
      const again = await run();
      assert.equal(again.duplicate, true);
      assert.equal(await models.Invoice.countDocuments({ idempotencyKey: key1 }), 1);
      assert.equal(await Payment.countDocuments({ invoiceId: a.invoiceId }), 1);
    });

    test("advance deposit, redemption, overdraw and concurrent use are audited and never go negative", async () => {
      const dep = await pos.finalizeBill({ customer: customer(1010), advances: [{ amount: 50000 }] }, [{ method: "cash", amount: 50000 }], owner(), { idempotencyKey: k() });
      const customerId = (await inv(dep.invoiceId))!.customerId;
      assert.equal((await User.findById(customerId).lean())!.advanceBalance, 50000);

      await assert.rejects(
        pos.finalizeBill({ customer: { ...customer(1010), userId: String(customerId) }, services: cut() }, [{ method: "advance", amount: 50001 }], owner(), { idempotencyKey: k() }),
        { status: 400 },
      );
      // Two bills each trying to use the full ₹500 at once: only one deduction can succeed.
      const both = await Promise.all(
        [0, 1].map(() =>
          pos.finalizeBill({ customer: { ...customer(1010), userId: String(customerId) }, services: cut() }, [{ method: "advance", amount: 50000 }], owner(), { idempotencyKey: k() }).catch((e) => e),
        ),
      );
      const balance = (await User.findById(customerId).lean())!.advanceBalance;
      assert.equal(balance, 0);
      const redeemed = await models.AdvanceTransaction.find({ customerId, type: "redeem" }).lean();
      assert.equal(redeemed.reduce((s, t) => s + t.amount, 0), 50000);
      assert.equal(redeemed[0].balanceBefore, 50000);
      assert.equal(redeemed[0].balanceAfter, 0);
      assert.ok(both.some((r) => r instanceof Error || (r.failures && r.failures.length)));

      // A refund to advance credits it back with its own record.
      const paidId = both.find((r) => !(r instanceof Error) && !r.failures.length).invoiceId;
      await billing.refundPayment(paidId, { amount: 10000, method: "advance", reason: "test" }, owner());
      assert.equal((await User.findById(customerId).lean())!.advanceBalance, 10000);
      assert.equal(await models.AdvanceTransaction.countDocuments({ customerId, type: "refund" }), 1);
    });

    test("gift cards are issued once paid, redeemed up to their balance, and rejected when expired", async () => {
      await assert.rejects(pos.finalizeBill({ customer: customer(1020), giftCards: [{ amount: 100000 }] }, [{ method: "upi", amount: 50000 }], owner(), { idempotencyKey: k() }), { status: 400 });
      const sold = await pos.finalizeBill({ customer: customer(1020), giftCards: [{ amount: 100000 }] }, [{ method: "upi", amount: 100000 }], owner(), { idempotencyKey: k() });
      const code = (await inv(sold.invoiceId))!.lines[0].giftCardCode!;
      assert.match(code, /^GC-/);
      assert.equal((await pos.giftCardStatus(code)).balance, 100000);

      await pos.finalizeBill({ customer: customer(1021), services: cut() }, [{ method: "giftcard", amount: 40000, giftCardCode: code }, { method: "cash", amount: 10000 }], owner(), { idempotencyKey: k() });
      assert.equal((await pos.giftCardStatus(code)).balance, 60000);
      await assert.rejects(pos.finalizeBill({ customer: customer(1022), services: [{ serviceId: colourId, qty: 1 }] }, [{ method: "giftcard", amount: 70000, giftCardCode: code }], owner(), { idempotencyKey: k() }), { status: 400 });
      await models.GiftCard.updateOne({ code }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      await assert.rejects(pos.finalizeBill({ customer: customer(1023), services: cut() }, [{ method: "giftcard", amount: 1000, giftCardCode: code }], owner(), { idempotencyKey: k() }), { status: 400 });
    });

    test("memberships start once paid and discount later bills; the quote matches the final invoice", async () => {
      const plan = await models.MembershipPlan.create({ name: "Gold", price: 200000, durationDays: 365, servicePercent: 10 });
      const sale = await pos.finalizeBill({ customer: customer(1030), memberships: [{ planId: plan._id }] }, [{ method: "cash", amount: 200000 }], owner(), { idempotencyKey: k() });
      const customerId = (await inv(sale.invoiceId))!.customerId;
      assert.ok(await billing.activeMembership(customerId));

      const input = { customer: { ...customer(1030), userId: String(customerId) }, services: cut() };
      const quote = await billing.quoteInvoice(input, owner());
      assert.equal(quote.totals.discountTotal, 5000);
      assert.equal(quote.totals.total, 45000);
      const r = await pos.finalizeBill(input, [{ method: "cash", amount: 45000 }], owner(), { idempotencyKey: k() });
      const i = await inv(r.invoiceId);
      assert.equal(i!.total, quote.totals.total);
      assert.equal(i!.lines[0].discount, 5000);
      assert.equal(i!.status, "paid");
    });

    test("staff shares are validated on the server", async () => {
      await assert.rejects(
        pos.finalizeBill({ customer: customer(1040), services: cut([{ staffId: stylist(), percent: 70 }, { staffId: ownerOid(), percent: 40 }]) }, [], owner(), { idempotencyKey: k() }),
        { status: 400 },
      );
      await BusinessSettings.updateOne({ _id: "business" }, { $set: { "billing.requireFullAllocation": true } });
      await assert.rejects(pos.finalizeBill({ customer: customer(1041), services: cut() }, [], owner(), { idempotencyKey: k() }), { status: 400 });
      await assert.rejects(pos.finalizeBill({ customer: customer(1042), services: cut([{ staffId: stylist(), percent: 50 }]) }, [], owner(), { idempotencyKey: k() }), { status: 400 });
      await BusinessSettings.updateOne({ _id: "business" }, { $set: { "billing.requireFullAllocation": false } });
    });

    test("saved bills: incomplete drafts save, stale edits are refused, finalizing twice is safe", async () => {
      const draft = await pos.saveDraft({ services: [{ serviceId: String(cutId), qty: 1 }] }, { services: cut() }, owner(), {});
      assert.equal(draft.status, "open");
      assert.match(draft.number, /^D-\d{4}$/);
      const v2 = await pos.saveDraft({ customer: customer(1050), services: [] }, { customer: customer(1050), services: cut() }, owner(), { id: draft._id, version: 1 });
      assert.equal(v2.version, 2);
      assert.equal(v2.previewTotal, 50000);
      await assert.rejects(pos.saveDraft({}, { services: cut() }, owner(), { id: draft._id, version: 1 }), { status: 409 });

      const first = await pos.finalizeBill({ customer: customer(1050), services: cut() }, [{ method: "cash", amount: 50000 }], owner(), { idempotencyKey: k(), draftId: draft._id });
      assert.equal((await models.BillDraft.findById(draft._id).lean())!.status, "finalized");
      const second = await pos.finalizeBill({ customer: customer(1050), services: cut() }, [{ method: "cash", amount: 50000 }], owner(), { idempotencyKey: k(), draftId: draft._id });
      assert.equal(second.duplicate, true);
      assert.equal(String(second.invoiceId), String(first.invoiceId));
    });

    test("owner-issued gift cards work like sold ones and record no sale", async () => {
      const card = await pos.issueGiftCard({ amount: 30000, note: "Diwali gift" }, owner());
      assert.match(card.code, /^GC-/);
      assert.equal((await pos.giftCardStatus(card.code)).balance, 30000);
      assert.equal(await models.Invoice.countDocuments({ "lines.giftCardCode": card.code }), 0);
      await pos.finalizeBill({ customer: customer(1070), services: cut() }, [{ method: "giftcard", amount: 30000, giftCardCode: card.code }, { method: "cash", amount: 20000 }], owner(), { idempotencyKey: k() });
      assert.equal((await pos.giftCardStatus(card.code)).balance, 0);
      await assert.rejects(pos.finalizeBill({ customer: customer(1071), services: cut() }, [{ method: "giftcard", amount: 100, giftCardCode: card.code }], owner(), { idempotencyKey: k() }), { status: 400 });
    });

    test("advance and gift card payments can't be recorded outside the billing flow", async () => {
      const i = await billing.createInvoice({ customer: customer(1060), services: cut() }, owner());
      await assert.rejects(billing.recordPayment(i._id, { amount: 1000, method: "advance" }, owner()), { status: 400 });
      await assert.rejects(billing.recordPayment(i._id, { amount: 1000, method: "giftcard" }, owner()), { status: 400 });
    });

    test("deleting one customer removes only their history and gives back coupon uses", async () => {
      const reset = await import("../src/server/services/customers-reset");
      await Coupon.create({ code: "ONEOFF", title: "One off", type: "flat", value: 1000, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), maxRedemptions: 5 });
      const r = await pos.finalizeBill({ customer: customer(1080), services: cut(), couponCode: "ONEOFF" }, [{ method: "cash", amount: 49000 }], owner(), { idempotencyKey: k() });
      const victim = (await models.Invoice.findById(r.invoiceId).lean())!.customerId;
      const others = await User.countDocuments({ role: "customer", _id: { $ne: victim } });
      assert.equal((await Coupon.findOne({ code: "ONEOFF" }).lean())!.redemptions, 1);

      const res = await reset.deleteCustomer(victim, owner());
      assert.equal(res.invoices, 1);
      assert.equal(await User.exists({ _id: victim }), null);
      assert.equal(await models.Invoice.countDocuments({ customerId: victim }), 0);
      assert.equal(await Payment.countDocuments({ invoiceId: r.invoiceId }), 0);
      assert.equal((await Coupon.findOne({ code: "ONEOFF" }).lean())!.redemptions, 0);
      assert.equal(await User.countDocuments({ role: "customer" }), others);
      await assert.rejects(reset.deleteCustomer(victim, owner()), { status: 404 });
    });

    test("deleting staff: no history removes them, history keeps the name but blocks sign-in, upcoming bookings block it", async () => {
      const { deleteStaff } = await import("../src/server/services/staff-delete");
      const fresh = await User.create({ name: "New Desk", email: "newdesk@test.local", role: "receptionist" });
      assert.deepEqual(await deleteStaff(fresh._id, owner()), { removed: "deleted" });
      assert.equal(await User.exists({ _id: fresh._id }), null);

      const paid = await User.create({ name: "Old Stylist", email: "old@test.local", role: "stylist", passwordHash: "x", staff: { bookable: true } });
      await models.PayEntry.create({ userId: paid._id, month: "2026-01", type: "payment", amount: 1000, date: "2026-01-31" });
      await models.Session.create({ tokenHash: "t-old", userId: paid._id, expiresAt: new Date(Date.now() + 3_600_000) });
      assert.deepEqual(await deleteStaff(paid._id, owner()), { removed: "archived" });
      const kept = await User.findById(paid._id).select("+passwordHash").lean();
      assert.equal(kept!.name, "Old Stylist");
      assert.equal(kept!.email, undefined);
      assert.equal(kept!.passwordHash, undefined);
      assert.equal(kept!.active, false);
      assert.equal(await User.exists({ email: "old@test.local" }), null);
      assert.equal(await models.Session.countDocuments({ userId: paid._id }), 0);

      // The test stylist has upcoming appointments from earlier tests.
      const upcoming = await Appointment.countDocuments({ staffId: stylistId, status: { $in: ["pending", "confirmed"] }, start: { $gte: new Date() } });
      if (upcoming) await assert.rejects(deleteStaff(new Types.ObjectId(stylistId), owner()), { status: 409 });
      await assert.rejects(deleteStaff(new Types.ObjectId(ownerId), owner()), { status: 409 });
    });

    // Runs last: wipes every customer in the test database.
    test("deleting all customers removes their history and keeps staff and services", async () => {
      const reset = await import("../src/server/services/customers-reset");
      assert.ok((await User.countDocuments({ role: "customer" })) > 0);
      const r = await reset.deleteAllCustomers(owner());
      assert.ok(r.customers > 0 && r.invoices > 0);
      assert.equal(await User.countDocuments({ role: "customer" }), 0);
      assert.equal(await models.Invoice.countDocuments(), 0);
      assert.equal(await Payment.countDocuments(), 0);
      assert.equal(await Appointment.countDocuments(), 0);
      assert.equal(await models.AdvanceTransaction.countDocuments(), 0);
      assert.equal(await models.CustomerMembership.countDocuments(), 0);
      assert.equal(await models.BillDraft.countDocuments(), 0);
      assert.ok(await User.exists({ _id: ownerId }));
      assert.ok(await Service.exists({ _id: cutId }));
      await assert.rejects(reset.deleteAllCustomers({ id: stylistId, name: "Stylist", role: "stylist", permissions: permissionsFor("stylist") }), { status: 403 });
    });
  });
});
