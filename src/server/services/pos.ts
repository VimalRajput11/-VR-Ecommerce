import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import {
  AdvanceTransaction,
  Appointment,
  BillDraft,
  Counter,
  CustomerMembership,
  GiftCard,
  GiftCardTransaction,
  Invoice,
  MembershipPlan,
  Payment,
  User,
  type BillDraftDoc,
} from "@/server/models";
import type { AuthUser } from "@/server/auth/session";
import { badRequest, conflict, notFound } from "@/server/lib/errors";
import { addDaysToKey, dateKeyIST } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { planPayments } from "./billing-core";
import { activeMembership, createInvoice, FULFILMENT_KINDS, quoteInvoice, recordPayment, type InvoiceInput, type Line } from "./billing";
import { getSettings, type Settings } from "./settings";
import { audit } from "./audit";

// Point-of-sale flow for the billing screen.
//
// Finalize = create the invoice (server-calculated) → apply each tendered payment → issue anything
// sold that needs fulfilling (gift cards, advance credit, memberships) → close the draft.
// MongoDB transactions need a replica set, so instead every money movement is a conditional atomic
// update (e.g. "deduct only if the balance is still enough") with an audit record, and each step
// that can fail after an earlier one succeeded undoes the earlier one. A client-generated
// idempotency key makes a retried finalize return the same invoice instead of billing twice.

export const TENDER_METHODS = ["cash", "upi", "card", "advance", "giftcard"] as const;
export type TenderMethod = (typeof TENDER_METHODS)[number];
export interface Tender {
  method: TenderMethod;
  amount: number;
  reference?: string;
  giftCardCode?: string;
}

const isExpired = (c: { expiresAt?: Date | null }) => !!c.expiresAt && c.expiresAt.getTime() < Date.now();
const normCode = (code?: string) => (code ?? "").trim().toUpperCase();

async function precheckTenders(tenders: Tender[], ctx: { total: number; customerId: Types.ObjectId; lines: Line[] }, settings: Settings) {
  for (const t of tenders) {
    if ((t.method === "cash" || t.method === "upi" || t.method === "card") && !settings.payments?.[t.method]) {
      throw badRequest(`${t.method.toUpperCase()} payments are not enabled in Settings.`, "payments");
    }
  }
  let plan;
  try {
    plan = planPayments(ctx.total, tenders);
  } catch (e) {
    throw badRequest((e as Error).message, "payments");
  }
  const sellsStoredValue = ctx.lines.some((l) => (FULFILMENT_KINDS as readonly string[]).includes(l.kind));
  if (plan.remaining > 0 && sellsStoredValue) throw badRequest("Bills with gift cards, advances or memberships must be paid in full.", "payments");
  if (plan.remaining > 0 && settings.billing?.allowPartialPayment === false) throw badRequest(`Collect the full ${formatINR(ctx.total)} to finalize this bill.`, "payments");
  if (tenders.some((t) => t.method === "giftcard") && ctx.lines.some((l) => l.kind === "giftcard")) throw badRequest("A gift card can't be used to buy another gift card.", "payments");
  if (tenders.some((t) => t.method === "advance") && ctx.lines.some((l) => l.kind === "advance")) throw badRequest("Advance balance can't be used to add more advance.", "payments");

  const advanceTotal = tenders.filter((t) => t.method === "advance").reduce((s, t) => s + t.amount, 0);
  if (advanceTotal > 0) {
    const cust = await User.findById(ctx.customerId).select("advanceBalance").lean();
    if ((cust?.advanceBalance ?? 0) < advanceTotal) throw badRequest(`Advance balance is only ${formatINR(cust?.advanceBalance ?? 0)}.`, "payments");
  }
  const byCode = new Map<string, number>();
  for (const t of tenders.filter((x) => x.method === "giftcard")) {
    const code = normCode(t.giftCardCode);
    if (!code) throw badRequest("Enter the gift card code.", "payments");
    byCode.set(code, (byCode.get(code) ?? 0) + t.amount);
  }
  for (const [code, amount] of byCode) {
    const card = await GiftCard.findOne({ code }).lean();
    if (!card || !card.active) throw badRequest(`Gift card ${code} was not found or is not active.`, "payments");
    if (isExpired(card)) throw badRequest(`Gift card ${code} has expired.`, "payments");
    if (card.balance < amount) throw badRequest(`Gift card ${code} has only ${formatINR(card.balance)} left.`, "payments");
  }
  return plan;
}

/** Applies one payment to a saved invoice. Advance / gift card balances are deducted atomically first. */
async function applyTender(invoice: { _id: Types.ObjectId; number: string; customerId: Types.ObjectId }, t: Tender, actor: AuthUser) {
  if (t.method === "advance") {
    const after = await User.findOneAndUpdate({ _id: invoice.customerId, advanceBalance: { $gte: t.amount } }, { $inc: { advanceBalance: -t.amount } }, { new: true }).select("advanceBalance").lean();
    if (!after) throw conflict("The customer's advance balance changed. Please check it and try again.");
    const tx = await AdvanceTransaction.create({
      customerId: invoice.customerId,
      type: "redeem",
      amount: t.amount,
      balanceBefore: after.advanceBalance + t.amount,
      balanceAfter: after.advanceBalance,
      invoiceId: invoice._id,
      note: `Used on ${invoice.number}`,
      by: actor.id,
    });
    try {
      await recordPayment(invoice._id, { amount: t.amount, method: "advance", note: "Advance balance" }, actor, { redemption: true });
    } catch (err) {
      const back = await User.findByIdAndUpdate(invoice.customerId, { $inc: { advanceBalance: t.amount } }, { new: true }).select("advanceBalance").lean();
      await AdvanceTransaction.create({ customerId: invoice.customerId, type: "reversal", amount: t.amount, balanceBefore: (back?.advanceBalance ?? t.amount) - t.amount, balanceAfter: back?.advanceBalance ?? t.amount, invoiceId: invoice._id, note: `Reversed ${String(tx._id)}: payment not recorded`, by: actor.id });
      throw err;
    }
    return;
  }
  if (t.method === "giftcard") {
    const code = normCode(t.giftCardCode);
    const card = await GiftCard.findOneAndUpdate(
      { code, active: true, balance: { $gte: t.amount }, $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
      { $inc: { balance: -t.amount } },
      { new: true },
    ).lean();
    if (!card) throw conflict(`Gift card ${code} can no longer cover ${formatINR(t.amount)}.`);
    await GiftCardTransaction.create({ giftCardId: card._id, type: "redeem", amount: t.amount, balanceBefore: card.balance + t.amount, balanceAfter: card.balance, invoiceId: invoice._id, by: actor.id });
    try {
      await recordPayment(invoice._id, { amount: t.amount, method: "giftcard", reference: code, giftCardId: card._id }, actor, { redemption: true });
    } catch (err) {
      const back = await GiftCard.findByIdAndUpdate(card._id, { $inc: { balance: t.amount } }, { new: true }).lean();
      await GiftCardTransaction.create({ giftCardId: card._id, type: "refund", amount: t.amount, balanceBefore: (back?.balance ?? t.amount) - t.amount, balanceAfter: back?.balance ?? t.amount, invoiceId: invoice._id, note: "Payment not recorded", by: actor.id });
      throw err;
    }
    return;
  }
  await recordPayment(invoice._id, { amount: t.amount, method: t.method, reference: t.reference }, actor);
}

async function newGiftCardCode() {
  for (let i = 0; i < 5; i++) {
    const raw = randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars
    const code = `GC-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
    if (!(await GiftCard.exists({ code }))) return code;
  }
  throw conflict("Could not generate a gift card code. Please try again.");
}

/**
 * Issues gift cards, credits advance deposits and starts memberships sold on a fully paid bill.
 * Claimed once per invoice (fulfilledAt), so it is safe to call again.
 */
export async function fulfilBill(invoiceId: Types.ObjectId, actor: AuthUser) {
  const inv = await Invoice.findOneAndUpdate(
    { _id: invoiceId, status: "paid", fulfilledAt: { $exists: false }, "lines.kind": { $in: [...FULFILMENT_KINDS] } },
    { $set: { fulfilledAt: new Date() } },
    { new: true },
  ).lean();
  if (!inv) return;
  const settings = await getSettings();
  const months = settings.billing?.giftCardValidityMonths ?? 12;
  const paidBy = [...new Set((await Payment.find({ invoiceId, kind: "payment" }).select("method").lean()).map((p) => p.method))].join(", ");

  for (const [i, line] of inv.lines.entries()) {
    if (line.kind === "giftcard") {
      const code = await newGiftCardCode();
      const expiresAt = months > 0 ? new Date(Date.now() + months * 30.44 * 86_400_000) : undefined;
      const card = await GiftCard.create({ code, initialValue: line.amount, balance: line.amount, expiresAt, purchaserId: inv.customerId, soldInvoiceId: inv._id });
      await GiftCardTransaction.create({ giftCardId: card._id, type: "issue", amount: line.amount, balanceBefore: 0, balanceAfter: line.amount, invoiceId: inv._id, by: actor.id });
      await Invoice.updateOne({ _id: inv._id }, { $set: { [`lines.${i}.giftCardCode`]: code } });
      await audit(actor, "giftcard.issue", "GiftCard", String(card._id), `Issued ${code} for ${formatINR(line.amount)} on ${inv.number}`);
    } else if (line.kind === "advance") {
      const after = await User.findByIdAndUpdate(inv.customerId, { $inc: { advanceBalance: line.amount } }, { new: true }).select("advanceBalance").lean();
      const balanceAfter = after?.advanceBalance ?? line.amount;
      await AdvanceTransaction.create({ customerId: inv.customerId, type: "deposit", amount: line.amount, balanceBefore: balanceAfter - line.amount, balanceAfter, invoiceId: inv._id, method: paidBy, note: `Deposit on ${inv.number}`, by: actor.id });
      await audit(actor, "advance.deposit", "User", String(inv.customerId), `Advance ${formatINR(line.amount)} on ${inv.number}`);
    } else if (line.kind === "membership" && line.refId) {
      const plan = await MembershipPlan.findById(line.refId).lean();
      if (!plan) continue;
      // A renewal starts the day after the current membership ends.
      const current = await activeMembership(inv.customerId);
      const startsOn = current && current.endsOn >= dateKeyIST() ? addDaysToKey(current.endsOn, 1) : dateKeyIST();
      await CustomerMembership.create({
        customerId: inv.customerId,
        planId: plan._id,
        name: plan.name,
        servicePercent: plan.servicePercent,
        productPercent: plan.productPercent,
        startsOn,
        endsOn: addDaysToKey(startsOn, plan.durationDays - 1),
        invoiceId: inv._id,
      });
      await audit(actor, "membership.start", "User", String(inv.customerId), `${plan.name} membership from ${startsOn} on ${inv.number}`);
    }
  }
}

/**
 * Finalizes a bill: creates the invoice, records each payment, fulfils stored-value items and
 * closes the draft. Returns `duplicate: true` when this key (or draft) was already finalized.
 */
export async function finalizeBill(input: InvoiceInput, tenders: Tender[], actor: AuthUser, opts: { idempotencyKey: string; draftId?: Types.ObjectId }) {
  const previous = await Invoice.findOne({ idempotencyKey: opts.idempotencyKey }).lean();
  if (previous) return { invoiceId: previous._id, number: previous.number, change: 0, failures: [] as string[], duplicate: true };

  let draft: BillDraftDoc | null = null;
  if (opts.draftId) {
    draft = await BillDraft.findOneAndUpdate({ _id: opts.draftId, status: "open" }, { $set: { status: "finalizing", updatedBy: actor.id } }, { new: true }).lean<BillDraftDoc>();
    if (!draft) {
      const d = await BillDraft.findById(opts.draftId).select("status invoiceId").lean();
      if (!d) throw notFound("This saved bill no longer exists.");
      if (d.status === "finalized" && d.invoiceId) {
        const inv = await Invoice.findById(d.invoiceId).select("number").lean();
        return { invoiceId: d.invoiceId, number: inv?.number ?? "", change: 0, failures: [] as string[], duplicate: true };
      }
      throw conflict(d.status === "finalizing" ? "This bill is already being finalized." : "This saved bill was discarded.");
    }
  }

  const settings = await getSettings();
  let plan: ReturnType<typeof planPayments> | null = null;
  let invoice;
  try {
    invoice = await createInvoice({ ...input, idempotencyKey: opts.idempotencyKey }, actor, {
      beforePersist: async (ctx) => {
        plan = await precheckTenders(tenders, ctx, settings);
      },
    });
  } catch (err) {
    if (draft) await BillDraft.updateOne({ _id: draft._id, status: "finalizing" }, { $set: { status: "open" } });
    // Two identical finalize requests raced: the other one created the invoice.
    if ((err as { code?: number }).code === 11000) {
      const won = await Invoice.findOne({ idempotencyKey: opts.idempotencyKey }).lean();
      if (won) return { invoiceId: won._id, number: won.number, change: 0, failures: [] as string[], duplicate: true };
    }
    throw err;
  }

  // Payments: tender details (gift card code, reference) come from the request; amounts from the plan.
  const failures: string[] = [];
  const used = new Set<number>();
  for (const applied of plan!.applied) {
    const idx = tenders.findIndex((t, i) => !used.has(i) && t.method === applied.method);
    used.add(idx);
    try {
      await applyTender(invoice, { ...tenders[idx], amount: applied.amount }, actor);
    } catch (err) {
      failures.push(`${applied.method.toUpperCase()} ${formatINR(applied.amount)}: ${(err as Error).message}`);
    }
  }

  await fulfilBill(invoice._id, actor);
  if (draft) await BillDraft.updateOne({ _id: draft._id }, { $set: { status: "finalized", invoiceId: invoice._id, updatedBy: actor.id } });
  await audit(actor, "invoice.finalize", "Invoice", String(invoice._id), `Finalized ${invoice.number}: ${plan!.applied.map((a) => `${a.method} ${formatINR(a.amount)}`).join(", ") || "no payment"}`);
  return { invoiceId: invoice._id, number: invoice.number, change: plan!.change, failures, duplicate: false };
}

// ---------------------------------------------------------------- drafts ("Save" / open bills)

async function nextDraftNumber() {
  const c = await Counter.findOneAndUpdate({ _id: "draft" }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `D-${String(c!.seq).padStart(4, "0")}`;
}

const DRAFT_KEYS = ["customer", "appointmentId", "appointmentAllocations", "services", "products", "customLines", "giftCards", "advances", "memberships", "couponCode", "manualDiscount", "loyaltyPoints", "notes", "billDate", "staffId"];

/**
 * Saves the bill's selections. `version` must match the stored draft (another person may have
 * changed it); prices and totals are recalculated whenever the draft is reopened or finalized.
 */
export async function saveDraft(body: Record<string, unknown>, input: InvoiceInput, actor: AuthUser, opts: { id?: Types.ObjectId; version?: number }) {
  const payload = Object.fromEntries(DRAFT_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  let previewTotal = 0;
  let itemCount = (input.services?.length ?? 0) + (input.products?.length ?? 0) + (input.customLines?.length ?? 0) + (input.giftCards?.length ?? 0) + (input.advances?.length ?? 0) + (input.memberships?.length ?? 0);
  let customerId: Types.ObjectId | undefined;
  let customer: { name: string; phone?: string; email?: string } | undefined = input.customer
    ? { name: input.customer.name, phone: input.customer.phone, email: input.customer.email }
    : undefined;
  try {
    if (input.customer || input.appointmentId) {
      const q = await quoteInvoice(input, actor);
      previewTotal = q.totals.total;
      itemCount = q.lines.length;
      customerId = q.customerId;
      customer = { name: q.customer.name, phone: q.customer.phone, email: q.customer.email };
    }
  } catch {
    // A draft may be incomplete (e.g. staff not chosen yet); it is still saved.
  }
  const fields = { payload, previewTotal, itemCount, customerId, customer, appointmentId: input.appointmentId, updatedBy: actor.id };
  if (opts.id) {
    const updated = await BillDraft.findOneAndUpdate({ _id: opts.id, status: "open", version: opts.version }, { $set: fields, $inc: { version: 1 } }, { new: true }).lean<BillDraftDoc>();
    if (!updated) {
      const d = await BillDraft.findById(opts.id).select("status").lean();
      if (!d) throw notFound("This saved bill no longer exists.");
      if (d.status !== "open") throw conflict("This bill has already been finalized or discarded.");
      throw conflict("Someone else changed this bill since you opened it. Reopen it to see the latest version.");
    }
    return updated;
  }
  const created = await BillDraft.create({ ...fields, number: await nextDraftNumber(), createdBy: actor.id });
  await audit(actor, "draft.create", "BillDraft", String(created._id), `Saved bill ${created.number}`);
  return created.toObject() as BillDraftDoc;
}

export function serialiseDraft(d: BillDraftDoc) {
  return {
    id: String(d._id),
    number: d.number,
    status: d.status,
    customer: d.customer ?? null,
    customerId: d.customerId ? String(d.customerId) : null,
    payload: d.payload,
    previewTotal: d.previewTotal ?? 0,
    itemCount: d.itemCount ?? 0,
    version: d.version ?? 1,
    updatedAt: (d as { updatedAt?: Date }).updatedAt,
  };
}

// ---------------------------------------------------------------- customer panel

export async function posCustomerSummary(id: Types.ObjectId, actor: AuthUser) {
  const c = await User.findOne({ _id: id, role: "customer" }).lean();
  if (!c) throw notFound("Customer not found.");
  const [membership, completed, bills, lastBill, due, advanceTx] = await Promise.all([
    activeMembership(id),
    Appointment.countDocuments({ customerId: id, status: "completed" }),
    Invoice.countDocuments({ customerId: id, status: { $ne: "void" }, appointmentId: { $exists: false } }),
    Invoice.findOne({ customerId: id, status: { $ne: "void" } }).sort({ issuedAt: -1 }).select("issuedAt").lean(),
    Invoice.aggregate<{ amount: number }>([{ $match: { customerId: id, status: { $in: ["unpaid", "partially_paid"] } } }, { $group: { _id: null, amount: { $sum: "$balanceDue" } } }]),
    AdvanceTransaction.find({ customerId: id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const lastVisit = [c.lastVisitAt, lastBill?.issuedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const canSeeNotes = actor.permissions.includes("customers.manage") || actor.permissions.includes("appointments.internal_notes");
  return {
    id: String(c._id),
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    birthday: c.birthday ?? "",
    gender: c.gender ?? "",
    preferences: c.preferences ?? "",
    internalNotes: canSeeNotes ? (c.internalNotes ?? "") : undefined,
    isGuest: !!c.isGuest,
    loyaltyPoints: c.loyaltyPoints ?? 0,
    advanceBalance: c.advanceBalance ?? 0,
    membership: membership
      ? { name: membership.name, startsOn: membership.startsOn, endsOn: membership.endsOn, servicePercent: membership.servicePercent ?? 0, productPercent: membership.productPercent ?? 0 }
      : null,
    visits: completed + bills,
    lastVisitAt: lastVisit,
    balanceDue: due[0]?.amount ?? 0,
    advanceHistory: advanceTx.map((t) => ({ type: t.type, amount: t.amount, balanceBefore: t.balanceBefore, balanceAfter: t.balanceAfter, at: (t as { createdAt?: Date }).createdAt, note: t.note ?? "" })),
  };
}

/** Owner gives part of a customer's advance back (cash/UPI), with an audit record. */
export async function refundAdvance(customerId: Types.ObjectId, amount: number, method: string, note: string, actor: AuthUser) {
  const after = await User.findOneAndUpdate({ _id: customerId, role: "customer", advanceBalance: { $gte: amount } }, { $inc: { advanceBalance: -amount } }, { new: true }).select("advanceBalance").lean();
  if (!after) throw badRequest("The refund is more than the customer's advance balance.", "amount");
  await AdvanceTransaction.create({ customerId, type: "refund", amount, balanceBefore: after.advanceBalance + amount, balanceAfter: after.advanceBalance, method, note, by: actor.id });
  await audit(actor, "advance.refund", "User", String(customerId), `Refunded ${formatINR(amount)} advance via ${method}`);
  return after.advanceBalance;
}

export async function giftCardStatus(code: string) {
  const card = await GiftCard.findOne({ code: normCode(code) }).lean();
  if (!card) throw notFound("No gift card with this code.");
  return {
    code: card.code,
    initialValue: card.initialValue,
    balance: card.balance,
    expiresAt: card.expiresAt ?? null,
    active: card.active !== false,
    usable: card.active !== false && !isExpired(card) && card.balance > 0,
    status: card.active === false ? "Inactive" : isExpired(card) ? "Expired" : card.balance === 0 ? "Fully used" : "Active",
  };
}

/**
 * Owner issues a gift card directly (complimentary, reward, apology…) without a sale.
 * No money is recorded; spending it later shows as a gift card payment, not new cash.
 */
export async function issueGiftCard(input: { amount: number; expiresOn?: string; note: string; customerId?: Types.ObjectId }, actor: AuthUser) {
  if (input.customerId && !(await User.exists({ _id: input.customerId, role: "customer" }))) throw notFound("Customer not found.");
  const code = await newGiftCardCode();
  const card = await GiftCard.create({
    code,
    initialValue: input.amount,
    balance: input.amount,
    // End of the chosen day in IST.
    expiresAt: input.expiresOn ? new Date(`${input.expiresOn}T23:59:59+05:30`) : undefined,
    purchaserId: input.customerId,
    note: input.note,
  });
  await GiftCardTransaction.create({ giftCardId: card._id, type: "issue", amount: input.amount, balanceBefore: 0, balanceAfter: input.amount, note: `Issued by owner: ${input.note}`, by: actor.id });
  await audit(actor, "giftcard.issue_free", "GiftCard", String(card._id), `Issued ${code} for ${formatINR(input.amount)} (no sale): ${input.note}`);
  return { code, balance: card.balance, expiresAt: card.expiresAt ?? null };
}
