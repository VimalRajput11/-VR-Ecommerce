import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, lockBlocks, summariseServices } from "../src/server/services/availability-core";
import { allocationError, computeTotals, couponDiscount, deriveInvoiceStatus, loyaltyPointsFor, membershipLineDiscounts, planPayments } from "../src/server/services/billing-core";
import { dateKeyIST, formatDate, formatTime, istToUtc, minutesOfDayIST, isValidDateKey, addDaysToKey } from "../src/lib/time";
import { formatINR } from "../src/lib/money";
import { permissionsFor } from "../src/lib/permissions";
import { normalisePhone, escapeRegex } from "../src/server/lib/validate";
import { canTransition } from "../src/server/services/booking";

describe("time (Asia/Kolkata)", () => {
  test("converts IST wall clock to UTC and back", () => {
    const d = istToUtc("2026-10-15", 10 * 60 + 30);
    assert.equal(d.toISOString(), "2026-10-15T05:00:00.000Z");
    assert.equal(minutesOfDayIST(d), 630);
    assert.equal(dateKeyIST(new Date("2026-10-15T19:00:00Z")), "2026-10-16"); // 00:30 IST next day
  });
  test("formats DD/MM/YYYY and 12-hour times", () => {
    const d = istToUtc("2026-03-05", 14 * 60 + 5);
    assert.equal(formatDate(d), "05/03/2026");
    assert.equal(formatTime(d), "2:05 PM");
    assert.equal(formatTime(istToUtc("2026-03-05", 0)), "12:00 AM");
  });
  test("validates date keys", () => {
    assert.equal(isValidDateKey("2026-02-30"), false);
    assert.equal(isValidDateKey("2026-02-28"), true);
    assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01");
  });
  test("formats INR", () => {
    assert.match(formatINR(123456), /₹\s?1,234\.56/);
  });
});

describe("availability engine", () => {
  const base = {
    dateKey: "2026-10-20",
    now: istToUtc("2026-10-19", 9 * 60),
    durationMin: 60,
    bufferMin: 0,
    intervalMin: 30,
    minLeadMinutes: 0,
    salon: { closed: false, open: "10:00", close: "13:00", breaks: [] },
    closures: [],
  };

  test("offers slots inside opening hours that fit the duration", () => {
    const slots = computeSlots({ ...base, staff: [{ id: "a", hours: null, breaks: [], busy: [] }] });
    assert.deepEqual(slots.map((s) => s.minutes), [600, 630, 660, 690, 720]);
  });

  test("never overlaps an existing appointment (incl. buffer)", () => {
    const busy = [{ start: istToUtc(base.dateKey, 660), end: istToUtc(base.dateKey, 720) }]; // 11:00-12:00
    const slots = computeSlots({ ...base, bufferMin: 15, staff: [{ id: "a", hours: null, breaks: [], busy }] });
    // 10:00 + 60 + 15 buffer = 11:15 overlaps; only 12:00 fits (12:00-13:00, buffer may run past close).
    assert.deepEqual(slots.map((s) => s.minutes), [720]);
  });

  test("respects salon breaks, closures and closed days", () => {
    const withBreak = computeSlots({ ...base, salon: { ...base.salon, breaks: [{ start: "11:00", end: "11:30" }] }, staff: [{ id: "a", hours: null, breaks: [], busy: [] }] });
    assert.deepEqual(withBreak.map((s) => s.minutes), [600, 690, 720]); // 10:00-11:00 ends as the break starts
    const closed = computeSlots({ ...base, salon: { ...base.salon, closed: true }, staff: [{ id: "a", hours: null, breaks: [], busy: [] }] });
    assert.equal(closed.length, 0);
    const closure = computeSlots({ ...base, closures: [{ start: istToUtc(base.dateKey, 0), end: istToUtc(base.dateKey, 24 * 60) }], staff: [{ id: "a", hours: null, breaks: [], busy: [] }] });
    assert.equal(closure.length, 0);
  });

  test("uses per-stylist hours and lists every free stylist", () => {
    const slots = computeSlots({
      ...base,
      staff: [
        { id: "a", hours: { open: "11:00", close: "13:00" }, breaks: [], busy: [] },
        { id: "b", hours: null, breaks: [], busy: [] },
      ],
    });
    assert.deepEqual(slots.find((s) => s.minutes === 600)?.staffIds, ["b"]);
    assert.deepEqual(slots.find((s) => s.minutes === 660)?.staffIds, ["a", "b"]);
  });

  test("applies the minimum lead time", () => {
    const slots = computeSlots({ ...base, now: istToUtc(base.dateKey, 9 * 60 + 50), minLeadMinutes: 60, staff: [{ id: "a", hours: null, breaks: [], busy: [] }] });
    assert.equal(slots[0].minutes, 660);
  });

  test("summarises services and lock blocks", () => {
    const s = summariseServices([{ durationMin: 30, bufferMin: 5, price: 30000 }, { durationMin: 45, bufferMin: 10, price: 50000, priceVerified: false }]);
    assert.deepEqual(s, { durationMin: 75, bufferMin: 10, total: 80000, allPricesVerified: false });
    assert.equal(lockBlocks(istToUtc("2026-10-20", 600), 75).length, 15);
  });
});

describe("billing maths", () => {
  test("exclusive tax applied after discount", () => {
    const t = computeTotals({ lines: [{ amount: 100000 }], discount: 10000, tax: { enabled: true, rateBps: 1800 } });
    assert.deepEqual(t, { subtotal: 100000, discountTotal: 10000, taxAmount: 16200, total: 106200, taxableAmount: 90000 });
  });
  test("inclusive tax is extracted, total unchanged", () => {
    const t = computeTotals({ lines: [{ amount: 118000 }], discount: 0, tax: { enabled: true, rateBps: 1800, inclusive: true } });
    assert.equal(t.taxAmount, 18000);
    assert.equal(t.total, 118000);
  });
  test("tax only on taxable lines; discount never makes total negative", () => {
    const t = computeTotals({ lines: [{ amount: 50000 }, { amount: 50000, taxable: false }], discount: 0, tax: { enabled: true, rateBps: 1000 } });
    assert.equal(t.taxAmount, 5000);
    const neg = computeTotals({ lines: [{ amount: 1000 }], discount: 999999, tax: { enabled: true, rateBps: 1800 } });
    assert.equal(neg.total, 0);
    assert.equal(neg.discountTotal, 1000);
  });
  test("tax disabled means no tax", () => {
    assert.equal(computeTotals({ lines: [{ amount: 1000 }], discount: 0, tax: { enabled: false, rateBps: 1800 } }).taxAmount, 0);
  });

  const coupon = {
    type: "percent",
    value: 20,
    maxDiscount: 30000,
    minSubtotal: 50000,
    startsAt: new Date("2026-01-01"),
    endsAt: new Date("2026-12-31"),
    active: true,
    maxRedemptions: 10,
    redemptions: 0,
    perCustomerLimit: 1,
  };
  const ctx = { eligibleSubtotal: 200000, subtotal: 200000, now: new Date("2026-06-01"), customerRedemptions: 0, isFirstVisit: false };

  test("coupon percent discount is capped", () => {
    assert.equal(couponDiscount(coupon, ctx), 30000);
    assert.equal(couponDiscount({ ...coupon, maxDiscount: 0 }, ctx), 40000);
    assert.equal(couponDiscount({ ...coupon, type: "flat", value: 500000, maxDiscount: 0 }, ctx), 200000);
  });
  test("coupon eligibility rules are enforced", () => {
    assert.throws(() => couponDiscount(coupon, { ...ctx, now: new Date("2027-01-02") }), /expired/);
    assert.throws(() => couponDiscount(coupon, { ...ctx, now: new Date("2025-12-01") }), /not valid yet/);
    assert.throws(() => couponDiscount({ ...coupon, redemptions: 10 }, ctx), /fully redeemed/);
    assert.throws(() => couponDiscount(coupon, { ...ctx, customerRedemptions: 1 }), /already been used/);
    assert.throws(() => couponDiscount({ ...coupon, firstVisitOnly: true }, ctx), /first visit/);
    assert.throws(() => couponDiscount(coupon, { ...ctx, subtotal: 1000, eligibleSubtotal: 1000 }), /minimum/);
    assert.throws(() => couponDiscount({ ...coupon, active: false }, ctx), /not active/);
  });
  test("invoice status and loyalty", () => {
    assert.equal(deriveInvoiceStatus({ total: 100, amountPaid: 0, amountRefunded: 0, balanceDue: 100 }), "unpaid");
    assert.equal(deriveInvoiceStatus({ total: 100, amountPaid: 40, amountRefunded: 0, balanceDue: 60 }), "partially_paid");
    assert.equal(deriveInvoiceStatus({ total: 100, amountPaid: 100, amountRefunded: 0, balanceDue: 0 }), "paid");
    assert.equal(deriveInvoiceStatus({ total: 100, amountPaid: 100, amountRefunded: 30, balanceDue: 0 }), "partially_refunded");
    assert.equal(deriveInvoiceStatus({ total: 100, amountPaid: 100, amountRefunded: 100, balanceDue: 0 }), "refunded");
    assert.equal(loyaltyPointsFor(125000, 2), 24);
  });
});

describe("permissions & validation", () => {
  test("role matrix", () => {
    assert.ok(permissionsFor("owner").includes("settings.manage"));
    assert.ok(!permissionsFor("receptionist").includes("reports.view"));
    assert.ok(!permissionsFor("receptionist").includes("settings.manage"));
    assert.ok(!permissionsFor("stylist").includes("customers.view"));
    assert.ok(!permissionsFor("stylist").includes("billing.manage"));
    assert.equal(permissionsFor("customer").length, 0);
    // Extra grants are limited to the grantable list and never apply to customers.
    assert.ok(permissionsFor("stylist", ["customers.view"]).includes("customers.view"));
    assert.ok(!permissionsFor("stylist", ["settings.manage"]).includes("settings.manage"));
    assert.equal(permissionsFor("customer", ["billing.manage"]).length, 0);
  });
  test("phone normalisation and regex escaping", () => {
    assert.equal(normalisePhone("+91 98765-43210"), "9876543210");
    assert.equal(normalisePhone("09876543210"), "9876543210");
    assert.equal(normalisePhone("12345"), null);
    assert.equal(normalisePhone("5876543210"), null);
    assert.equal(escapeRegex("a.*(b)"), "a\\.\\*\\(b\\)");
  });
  test("status workflow", () => {
    assert.ok(canTransition("pending", "confirmed"));
    assert.ok(canTransition("checked_in", "in_progress"));
    assert.ok(!canTransition("completed", "cancelled"));
    assert.ok(!canTransition("cancelled", "confirmed"));
    assert.ok(!canTransition("pending", "completed"));
  });
});

describe("POS billing rules", () => {
  test("staff allocations", () => {
    assert.equal(allocationError([], true), null);
    assert.equal(allocationError([{ staffId: "a", percent: 100 }], true), null);
    assert.equal(allocationError([{ staffId: "a", percent: 60 }, { staffId: "b", percent: 40 }], true), null);
    assert.match(allocationError([{ staffId: "a", percent: 60 }], true)!, /100%/);
    assert.equal(allocationError([{ staffId: "a", percent: 60 }], false), null);
    assert.match(allocationError([{ staffId: "a", percent: 70 }, { staffId: "b", percent: 40 }], false)!, /more than 100%/);
    assert.match(allocationError([{ staffId: "a", percent: 50 }, { staffId: "a", percent: 50 }], true)!, /twice/);
    assert.match(allocationError([{ staffId: "a", percent: 0 }], false)!, /between 1 and 100/);
    assert.match(allocationError([{ staffId: "a", percent: 33.5 }], false)!, /whole/);
  });
  test("membership discounts apply per line type", () => {
    const lines = [
      { kind: "service", amount: 50000 },
      { kind: "product", amount: 20000 },
      { kind: "giftcard", amount: 100000 },
    ];
    assert.deepEqual(membershipLineDiscounts(lines, { servicePercent: 10, productPercent: 5 }), [5000, 1000, 0]);
    assert.deepEqual(membershipLineDiscounts(lines, null), [0, 0, 0]);
    assert.deepEqual(membershipLineDiscounts(lines, { servicePercent: 150, productPercent: -5 }), [50000, 0, 0]);
  });
  test("split payments, partial payments and change", () => {
    // ₹1,000 bill: ₹400 cash + ₹600 UPI settles it exactly.
    assert.deepEqual(planPayments(100000, [{ method: "cash", amount: 40000 }, { method: "upi", amount: 60000 }]), {
      applied: [{ method: "cash", amount: 40000 }, { method: "upi", amount: 60000 }],
      paid: 100000,
      change: 0,
      remaining: 0,
    });
    // ₹1,000 bill, ₹700 paid → ₹300 remaining.
    assert.equal(planPayments(100000, [{ method: "upi", amount: 70000 }]).remaining, 30000);
    // Cash over the balance gives change; only the needed cash is recorded.
    const cash = planPayments(100000, [{ method: "upi", amount: 50000 }, { method: "cash", amount: 60000 }]);
    assert.equal(cash.change, 10000);
    assert.equal(cash.paid, 100000);
    assert.deepEqual(cash.applied[1], { method: "cash", amount: 50000 });
    // Non-cash may never exceed what is due; amounts must be positive whole paise.
    assert.throws(() => planPayments(100000, [{ method: "card", amount: 100001 }]), /can't be more/);
    assert.throws(() => planPayments(100000, [{ method: "cash", amount: 0 }]), /greater than zero/);
    assert.throws(() => planPayments(100000, [{ method: "cash", amount: -5 }]), /greater than zero/);
    assert.equal(planPayments(100000, []).remaining, 100000);
  });
});

describe("billing permissions", () => {
  test("receptionists bill and collect; stylists don't; refunds and payroll stay with the owner", () => {
    const rec = permissionsFor("receptionist");
    const sty = permissionsFor("stylist");
    const own = permissionsFor("owner");
    assert.ok(rec.includes("billing.manage") && rec.includes("customers.view"));
    assert.ok(!rec.includes("billing.refund") && !rec.includes("payroll.manage") && !rec.includes("offers.manage"));
    assert.ok(!sty.includes("billing.manage") && !sty.includes("customers.view"));
    assert.ok(own.includes("billing.refund") && own.includes("payroll.manage") && own.includes("offers.manage"));
    // Payroll can't be granted to staff as an extra permission.
    assert.ok(!permissionsFor("receptionist", ["payroll.manage", "billing.refund"]).includes("payroll.manage"));
  });
});
