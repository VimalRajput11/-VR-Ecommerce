import { Types } from "mongoose";
import {
  Appointment,
  Coupon,
  CouponRedemption,
  Counter,
  Invoice,
  LoyaltyTransaction,
  Notification,
  Payment,
  Product,
  Service,
  User,
  type InvoiceDoc,
} from "@/server/models";
import type { AuthUser } from "@/server/auth/session";
import type { PaymentMethod } from "@/lib/constants";
import { badRequest, conflict, forbidden, notFound } from "@/server/lib/errors";
import { dateKeyIST } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { computeTotals, couponDiscount, deriveInvoiceStatus, loyaltyPointsFor } from "./billing-core";
import { getSettings, salonEmail, salonPhone, type Settings } from "./settings";
import { resolveCustomer, type CustomerInput } from "./booking";
import { adjustStock } from "./inventory";
import { notifyInvoice, notifyPayment } from "./notifications";
import { autoSendInvoiceWhatsApp } from "./whatsapp";
import { audit } from "./audit";

export async function nextInvoiceNumber(prefix: string): Promise<string> {
  const year = dateKeyIST().slice(0, 4);
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return `${prefix || "VG"}-${year}-${String(counter!.seq).padStart(5, "0")}`;
}

export interface InvoiceInput {
  appointmentId?: Types.ObjectId;
  customer?: CustomerInput;
  services?: { serviceId: Types.ObjectId; qty: number }[];
  products?: { productId: Types.ObjectId; qty: number }[];
  customLines?: { description: string; amount: number }[];
  couponCode?: string;
  manualDiscount?: { type: "percent" | "flat"; value: number; reason: string };
  loyaltyPoints?: number;
  notes?: string;
  /** Bill date when entering a bill for an earlier day; defaults to now. */
  issuedAt?: Date;
}

type Line = { kind: "service" | "product" | "custom"; refId?: Types.ObjectId; description: string; qty: number; unitPrice: number; amount: number; taxable: boolean };
type Discount = { kind: "coupon" | "manual" | "loyalty"; code?: string; description: string; amount: number; refId?: Types.ObjectId };

async function isFirstVisit(customerId: Types.ObjectId) {
  const prior = await Invoice.countDocuments({ customerId, status: { $ne: "void" } });
  return prior === 0;
}

export async function createInvoice(input: InvoiceInput, actor: AuthUser) {
  const settings = await getSettings();
  const lines: Line[] = [];
  let customerId: Types.ObjectId;
  let customer: { name: string; phone?: string; email?: string };
  let appointment = null;

  if (input.appointmentId) {
    appointment = await Appointment.findById(input.appointmentId);
    if (!appointment) throw notFound("Appointment not found.");
    if (["cancelled", "no_show"].includes(appointment.status)) throw conflict("Cancelled appointments cannot be billed.");
    const existing = await Invoice.findOne({ activeAppointmentKey: appointment._id }).select("number").lean();
    if (existing) throw conflict(`This appointment already has invoice ${existing.number}.`);
    customerId = appointment.customerId;
    customer = { name: appointment.customer.name, phone: appointment.customer.phone, email: appointment.customer.email ?? undefined };
    const taxable = new Map(
      (await Service.find({ _id: { $in: appointment.items.map((i) => i.serviceId) } }).select("taxable").lean()).map((s) => [String(s._id), s.taxable !== false]),
    );
    for (const item of appointment.items) {
      lines.push({ kind: "service", refId: item.serviceId, description: item.name, qty: 1, unitPrice: item.price, amount: item.price, taxable: taxable.get(String(item.serviceId)) ?? true });
    }
  } else {
    if (!input.customer) throw badRequest("Customer details are required.", "customer");
    const resolved = await resolveCustomer(input.customer);
    customerId = resolved.id;
    customer = resolved.snapshot;
  }

  if (input.services?.length) {
    const docs = await Service.find({ _id: { $in: input.services.map((s) => s.serviceId) }, archived: { $ne: true } }).lean();
    for (const req of input.services) {
      const svc = docs.find((d) => d._id.equals(req.serviceId));
      if (!svc) throw badRequest("A selected service was not found.", "services");
      lines.push({ kind: "service", refId: svc._id, description: svc.name, qty: req.qty, unitPrice: svc.price, amount: svc.price * req.qty, taxable: svc.taxable !== false });
    }
  }

  if (input.products?.length) {
    if (!settings.features?.retail) throw badRequest("Retail product sales are not enabled.", "products");
    const docs = await Product.find({ _id: { $in: input.products.map((p) => p.productId) }, retail: true, active: true }).lean();
    for (const req of input.products) {
      const p = docs.find((d) => d._id.equals(req.productId));
      if (!p) throw badRequest("A selected product is not available for sale.", "products");
      if (settings.features?.inventory && p.quantity < req.qty) throw conflict(`Only ${p.quantity} ${p.unit} of ${p.name} in stock.`);
      lines.push({ kind: "product", refId: p._id, description: p.name, qty: req.qty, unitPrice: p.sellingPrice, amount: p.sellingPrice * req.qty, taxable: true });
    }
  }

  for (const c of input.customLines ?? []) {
    lines.push({ kind: "custom", description: c.description, qty: 1, unitPrice: c.amount, amount: c.amount, taxable: true });
  }
  if (!lines.length) throw badRequest("Add at least one item to the bill.", "lines");

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discounts: Discount[] = [];
  let remaining = subtotal;
  const undo: (() => Promise<unknown>)[] = [];

  try {
    // 1. Coupon
    let couponId: Types.ObjectId | undefined;
    if (input.couponCode) {
      const coupon = await Coupon.findOne({ code: input.couponCode.trim().toUpperCase() });
      if (!coupon) throw badRequest("Coupon code not found.", "couponCode");
      const eligibleSubtotal = coupon.serviceIds?.length
        ? lines.filter((l) => l.kind === "service" && coupon.serviceIds.some((id) => l.refId?.equals(id))).reduce((s, l) => s + l.amount, 0)
        : subtotal;
      let amount: number;
      try {
        amount = couponDiscount(coupon, {
          eligibleSubtotal,
          subtotal,
          now: new Date(),
          customerRedemptions: await CouponRedemption.countDocuments({ couponId: coupon._id, customerId, reversed: false }),
          isFirstVisit: await isFirstVisit(customerId),
        });
      } catch (e) {
        throw badRequest((e as Error).message, "couponCode");
      }
      amount = Math.min(amount, remaining);
      // Atomically claim one redemption so limits hold under concurrency.
      const claimed = await Coupon.findOneAndUpdate(
        { _id: coupon._id, $or: [{ maxRedemptions: 0 }, { $expr: { $lt: ["$redemptions", "$maxRedemptions"] } }] },
        { $inc: { redemptions: 1 } },
      );
      if (!claimed) throw badRequest("This coupon has been fully redeemed.", "couponCode");
      undo.push(() => Coupon.updateOne({ _id: coupon._id }, { $inc: { redemptions: -1 } }));
      couponId = coupon._id;
      discounts.push({ kind: "coupon", code: coupon.code, description: coupon.title, amount, refId: coupon._id });
      remaining -= amount;
    }

    // 2. Manual discount
    if (input.manualDiscount && input.manualDiscount.value > 0) {
      if (!actor.permissions.includes("billing.discount")) throw forbidden("You are not allowed to apply discounts.");
      const md = input.manualDiscount;
      let amount = md.type === "percent" ? Math.round((subtotal * Math.min(100, md.value)) / 100) : md.value;
      if (actor.role !== "owner") {
        const cap = Math.round((subtotal * (settings.discounts?.receptionistMaxPercent ?? 0)) / 100);
        if (amount > cap) throw forbidden(`Discounts above ${settings.discounts?.receptionistMaxPercent ?? 0}% need the owner's approval.`);
      }
      amount = Math.min(amount, remaining);
      if (amount > 0) {
        discounts.push({ kind: "manual", description: md.reason || "Discount", amount });
        remaining -= amount;
      }
    }

    // 3. Loyalty points
    let pointsRedeemed = 0;
    if (input.loyaltyPoints && input.loyaltyPoints > 0) {
      if (!settings.features?.loyalty) throw badRequest("Loyalty points are not enabled.", "loyaltyPoints");
      const min = settings.loyalty?.minRedeemPoints ?? 0;
      if (input.loyaltyPoints < min) throw badRequest(`At least ${min} points are needed to redeem.`, "loyaltyPoints");
      const value = settings.loyalty?.pointValuePaise ?? 0;
      const usablePoints = value > 0 ? Math.min(input.loyaltyPoints, Math.floor(remaining / value)) : 0;
      if (usablePoints > 0) {
        const updated = await User.findOneAndUpdate({ _id: customerId, loyaltyPoints: { $gte: usablePoints } }, { $inc: { loyaltyPoints: -usablePoints } });
        if (!updated) throw badRequest("The customer does not have enough loyalty points.", "loyaltyPoints");
        undo.push(() => User.updateOne({ _id: customerId }, { $inc: { loyaltyPoints: usablePoints } }));
        pointsRedeemed = usablePoints;
        discounts.push({ kind: "loyalty", description: `${usablePoints} loyalty points`, amount: usablePoints * value });
        remaining -= usablePoints * value;
      }
    }

    const totals = computeTotals({
      lines,
      discount: discounts.reduce((s, d) => s + d.amount, 0),
      tax: settings.tax ?? {},
    });

    const invoice = await Invoice.create({
      number: await nextInvoiceNumber(settings.invoice?.prefix ?? "VG"),
      appointmentId: appointment?._id,
      activeAppointmentKey: appointment?._id,
      customerId,
      customer,
      lines,
      subtotal: totals.subtotal,
      discounts,
      discountTotal: totals.discountTotal,
      tax: {
        name: settings.tax?.enabled ? settings.tax?.name : undefined,
        rateBps: settings.tax?.enabled ? settings.tax?.rateBps : 0,
        inclusive: !!settings.tax?.inclusive,
        amount: totals.taxAmount,
      },
      total: totals.total,
      balanceDue: totals.total,
      amountPaid: 0,
      status: totals.total === 0 ? "paid" : "unpaid",
      notes: input.notes,
      issuedAt: input.issuedAt ?? new Date(),
      issuedBy: actor.id,
    });
    undo.push(() => Invoice.deleteOne({ _id: invoice._id }));

    if (couponId) {
      await CouponRedemption.create({ couponId, customerId, invoiceId: invoice._id, amount: discounts.find((d) => d.kind === "coupon")!.amount });
    }
    if (pointsRedeemed) {
      await LoyaltyTransaction.create({ customerId, points: -pointsRedeemed, reason: "redeem", invoiceId: invoice._id, by: actor.id });
    }
    if (settings.features?.inventory) {
      for (const line of lines.filter((l) => l.kind === "product")) {
        await adjustStock({ productId: line.refId!, delta: -line.qty, type: "sold", reason: `Invoice ${invoice.number}`, invoiceId: invoice._id, by: actor.id });
        undo.push(() => adjustStock({ productId: line.refId!, delta: line.qty, type: "returned", reason: `Rollback ${invoice.number}`, by: actor.id }));
      }
    }
    if (appointment) await Appointment.updateOne({ _id: appointment._id }, { $set: { invoiceId: invoice._id } });

    // A bill means the customer visited (walk-ins often have no appointment), so keep visit dates
    // current for the customer list and WhatsApp offers. Back-dated bills never move dates backwards.
    const visitedAt = invoice.issuedAt;
    await User.updateOne({ _id: customerId, $or: [{ lastVisitAt: { $exists: false } }, { lastVisitAt: null }, { lastVisitAt: { $lt: visitedAt } }] }, { $set: { lastVisitAt: visitedAt } });
    await User.updateOne({ _id: customerId, $or: [{ firstVisitAt: { $exists: false } }, { firstVisitAt: null }, { firstVisitAt: { $gt: visitedAt } }] }, { $set: { firstVisitAt: visitedAt } });

    await audit(actor, "invoice.create", "Invoice", String(invoice._id), `Issued ${invoice.number} for ${formatINR(invoice.total)}`);
    await notifyInvoice(invoice);
    await autoSendInvoiceWhatsApp(invoice);
    return invoice;
  } catch (err) {
    for (const fn of undo.reverse()) await fn().catch((e) => console.error("[billing] rollback failed", e));
    if ((err as { code?: number }).code === 11000 && appointment) throw conflict("This appointment has already been billed.");
    throw err;
  }
}

function assertMethodEnabled(settings: Settings, method: PaymentMethod, viaGateway: boolean) {
  if (method === "online") {
    if (!viaGateway) throw badRequest("Online payments are recorded automatically by the payment gateway.", "method");
    return;
  }
  if (!settings.payments?.[method]) throw badRequest(`${method.toUpperCase()} payments are not enabled in settings.`, "method");
}

async function refreshStatus(invoiceId: Types.ObjectId) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) return null;
  const status = deriveInvoiceStatus(inv);
  if (inv.status !== status) {
    inv.status = status;
    await inv.save();
  }
  return inv;
}

async function awardLoyalty(inv: InvoiceDoc, settings: Settings) {
  if (!settings.features?.loyalty || inv.status !== "paid") return;
  const points = loyaltyPointsFor(inv.amountPaid - inv.amountRefunded, settings.loyalty?.pointsPer100 ?? 0);
  if (points <= 0) return;
  // Only once per invoice.
  const claimed = await Invoice.updateOne({ _id: inv._id, loyaltyAwarded: 0 }, { $set: { loyaltyAwarded: points } });
  if (!claimed.modifiedCount) return;
  await User.updateOne({ _id: inv.customerId, isGuest: false }, { $inc: { loyaltyPoints: points } });
  await LoyaltyTransaction.create({ customerId: inv.customerId, points, reason: "earn", invoiceId: inv._id });
}

export async function recordPayment(
  invoiceId: Types.ObjectId,
  p: { amount: number; method: PaymentMethod; reference?: string; note?: string; gatewayPaymentId?: string },
  actor: AuthUser | null,
) {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw badRequest("Payment amount must be greater than zero.", "amount");
  const settings = await getSettings();
  assertMethodEnabled(settings, p.method, !!p.gatewayPaymentId);

  if (p.gatewayPaymentId) {
    const existing = await Payment.findOne({ gatewayPaymentId: p.gatewayPaymentId, kind: "payment" });
    if (existing) return { payment: existing, invoice: await Invoice.findById(invoiceId), duplicate: true };
  }

  const updated = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: { $in: ["unpaid", "partially_paid"] }, balanceDue: { $gte: p.amount } },
    { $inc: { amountPaid: p.amount, balanceDue: -p.amount } },
    { new: true },
  );
  if (!updated) {
    const inv = await Invoice.findById(invoiceId).select("balanceDue status").lean();
    if (!inv) throw notFound("Invoice not found.");
    if (inv.status === "void") throw conflict("This invoice is void.");
    throw conflict(`Amount exceeds the balance due (${formatINR(inv.balanceDue)}).`);
  }

  let payment;
  try {
    payment = await Payment.create({
      invoiceId,
      kind: "payment",
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      note: p.note,
      gatewayPaymentId: p.gatewayPaymentId,
      recordedBy: actor?.id,
    });
  } catch (err) {
    await Invoice.updateOne({ _id: invoiceId }, { $inc: { amountPaid: -p.amount, balanceDue: p.amount } });
    if ((err as { code?: number }).code === 11000 && p.gatewayPaymentId) {
      const existing = await Payment.findOne({ gatewayPaymentId: p.gatewayPaymentId, kind: "payment" });
      return { payment: existing, invoice: await Invoice.findById(invoiceId), duplicate: true };
    }
    throw err;
  }

  const invoice = (await refreshStatus(invoiceId))!;
  await awardLoyalty(invoice, settings);
  await audit(actor, "payment.record", "Invoice", String(invoiceId), `${formatINR(p.amount)} via ${p.method} on ${invoice.number}`);
  await notifyPayment(invoice, p.amount, String(payment._id));
  return { payment, invoice, duplicate: false };
}

export async function refundPayment(
  invoiceId: Types.ObjectId,
  r: { amount: number; method: PaymentMethod; reason: string },
  actor: AuthUser,
) {
  if (!Number.isInteger(r.amount) || r.amount <= 0) throw badRequest("Refund amount must be greater than zero.", "amount");
  const updated = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: { $ne: "void" }, $expr: { $gte: [{ $subtract: ["$amountPaid", "$amountRefunded"] }, r.amount] } },
    { $inc: { amountRefunded: r.amount } },
    { new: true },
  );
  if (!updated) {
    const exists = await Invoice.exists({ _id: invoiceId });
    if (!exists) throw notFound("Invoice not found.");
    throw conflict("Refund cannot exceed the amount paid.");
  }
  const payment = await Payment.create({ invoiceId, kind: "refund", method: r.method, amount: r.amount, note: r.reason, recordedBy: actor.id });
  const invoice = await refreshStatus(invoiceId);
  await audit(actor, "payment.refund", "Invoice", String(invoiceId), `Refunded ${formatINR(r.amount)} on ${updated.number}: ${r.reason}`);
  return { payment, invoice };
}

export async function voidInvoice(invoiceId: Types.ObjectId, reason: string, actor: AuthUser) {
  const inv = await Invoice.findOneAndUpdate(
    { _id: invoiceId, amountPaid: 0, status: { $ne: "void" } },
    { $set: { status: "void", voidReason: reason }, $unset: { activeAppointmentKey: 1 } },
    { new: true },
  );
  if (!inv) {
    const exists = await Invoice.findById(invoiceId).select("amountPaid status").lean();
    if (!exists) throw notFound("Invoice not found.");
    if (exists.status === "void") throw conflict("Invoice is already void.");
    throw conflict("Invoices with payments cannot be voided. Record a refund instead.");
  }
  const settings = await getSettings();
  for (const d of inv.discounts) {
    if (d.kind === "coupon" && d.refId) {
      const r = await CouponRedemption.updateOne({ couponId: d.refId, invoiceId: inv._id, reversed: false }, { $set: { reversed: true } });
      if (r.modifiedCount) await Coupon.updateOne({ _id: d.refId }, { $inc: { redemptions: -1 } });
    }
  }
  const redeemed = await LoyaltyTransaction.findOne({ invoiceId: inv._id, reason: "redeem" }).lean();
  if (redeemed) {
    await User.updateOne({ _id: inv.customerId }, { $inc: { loyaltyPoints: -redeemed.points } });
    await LoyaltyTransaction.create({ customerId: inv.customerId, points: -redeemed.points, reason: "reverse", invoiceId: inv._id, by: actor.id, note: "Invoice voided" });
  }
  if (settings.features?.inventory) {
    for (const line of inv.lines.filter((l) => l.kind === "product" && l.refId)) {
      await adjustStock({ productId: line.refId!, delta: line.qty, type: "returned", reason: `Void ${inv.number}`, invoiceId: inv._id, by: actor.id });
    }
  }
  if (inv.appointmentId) await Appointment.updateOne({ _id: inv.appointmentId }, { $unset: { invoiceId: 1 } });
  await audit(actor, "invoice.void", "Invoice", String(inv._id), `Voided ${inv.number}: ${reason}`);
  return inv;
}

/**
 * Owner-only reset: permanently deletes every invoice and everything that hangs off it (payments,
 * coupon uses, loyalty earned/redeemed on bills, invoice notifications), unlinks appointments,
 * and restarts invoice numbering. Product stock movements are kept, since stock is physical.
 */
export async function deleteAllInvoices(actor: AuthUser) {
  if (actor.role !== "owner") throw forbidden("Only the owner can delete invoices.");
  const ids = (await Invoice.find().select("_id").lean()).map((i) => i._id);
  await Promise.all([
    Payment.deleteMany({}),
    CouponRedemption.deleteMany({}),
    LoyaltyTransaction.deleteMany({ invoiceId: { $exists: true } }),
    Notification.deleteMany({ event: { $in: ["invoice_issued", "payment_received", "invoice_whatsapp"] } }),
    Appointment.updateMany({ invoiceId: { $exists: true } }, { $unset: { invoiceId: "" } }),
    Coupon.updateMany({}, { $set: { redemptions: 0 } }),
  ]);
  await Invoice.deleteMany({});
  await Counter.deleteMany({ _id: /^invoice-/ });

  // Loyalty balances are rebuilt from whatever transactions remain (e.g. manual adjustments).
  const balances = await LoyaltyTransaction.aggregate<{ _id: Types.ObjectId; points: number }>([{ $group: { _id: "$customerId", points: { $sum: "$points" } } }]);
  await User.updateMany({ loyaltyPoints: { $gt: 0 } }, { $set: { loyaltyPoints: 0 } });
  for (const b of balances) await User.updateOne({ _id: b._id }, { $set: { loyaltyPoints: Math.max(0, b.points) } });

  await audit(actor, "invoice.delete_all", "Invoice", "all", `Deleted all ${ids.length} invoices and their payments`);
  return { deleted: ids.length };
}

export function serialiseInvoice(inv: InvoiceDoc, payments: { kind: string; method: string; amount: number; reference?: string | null; note?: string | null; createdAt?: Date }[] = []) {
  return {
    id: String(inv._id),
    number: inv.number,
    appointmentId: inv.appointmentId ? String(inv.appointmentId) : null,
    customerId: String(inv.customerId),
    customer: inv.customer,
    lines: inv.lines.map((l) => ({ kind: l.kind, description: l.description, qty: l.qty, unitPrice: l.unitPrice, amount: l.amount })),
    subtotal: inv.subtotal,
    discounts: inv.discounts.map((d) => ({ kind: d.kind, code: d.code, description: d.description, amount: d.amount })),
    discountTotal: inv.discountTotal,
    tax: inv.tax,
    total: inv.total,
    amountPaid: inv.amountPaid,
    amountRefunded: inv.amountRefunded,
    balanceDue: inv.balanceDue,
    status: inv.status,
    notes: inv.notes,
    issuedAt: inv.issuedAt,
    voidReason: inv.voidReason,
    payments: payments.map((p) => ({ kind: p.kind, method: p.method, amount: p.amount, reference: p.reference, note: p.note, at: p.createdAt })),
  };
}

export function invoiceBusiness(settings: Settings) {
  return {
    name: settings.name,
    tagline: settings.tagline ?? "",
    address: [settings.address?.verified ? settings.address.line1 : "", settings.address?.locality, settings.address?.city]
      .filter(Boolean)
      .join(", "),
    phone: salonPhone(settings),
    email: salonEmail(settings),
    gstin: settings.tax?.enabled ? settings.tax.gstin : "",
    footerNote: settings.invoice?.footerNote ?? "",
  };
}
