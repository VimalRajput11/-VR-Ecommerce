import type { Types } from "mongoose";
import {
  AdvanceTransaction,
  Appointment,
  BillDraft,
  Counter,
  Coupon,
  CouponRedemption,
  CustomerMembership,
  GiftCard,
  GiftCardTransaction,
  Invoice,
  LoyaltyTransaction,
  Notification,
  Payment,
  Review,
  Session,
  SlotLock,
  User,
} from "@/server/models";
import type { AuthUser } from "@/server/auth/session";
import { forbidden, notFound } from "@/server/lib/errors";
import { deleteAllInvoices } from "./billing";
import { audit } from "./audit";

/**
 * Owner-only reset (e.g. removing test data before going live): permanently deletes every customer
 * and everything that belongs to them — bills and payments, appointments, reviews, notifications,
 * sign-in sessions, advance balances, memberships, saved bills and their gift cards.
 * Staff, services, offers, products and stock levels are kept.
 */
export async function deleteAllCustomers(actor: AuthUser) {
  if (actor.role !== "owner") throw forbidden("Only the owner can delete customers.");
  const ids = (await User.find({ role: "customer" }).select("_id").lean()).map((u) => u._id);

  // Bills first (every bill belongs to a customer): payments, coupon uses, loyalty, numbering.
  const { deleted: invoices } = await deleteAllInvoices(actor);

  const appointmentIds = (await Appointment.find({ customerId: { $in: ids } }).select("_id").lean()).map((a) => a._id);
  const cardIds = (await GiftCard.find({ $or: [{ purchaserId: { $in: ids } }, { soldInvoiceId: { $exists: true } }] }).select("_id").lean()).map((c) => c._id);

  await Promise.all([
    SlotLock.deleteMany({ appointmentId: { $in: appointmentIds } }),
    Review.deleteMany({ customerId: { $in: ids } }),
    Notification.deleteMany({ userId: { $in: ids } }),
    Session.deleteMany({ userId: { $in: ids } }),
    AdvanceTransaction.deleteMany({ customerId: { $in: ids } }),
    CustomerMembership.deleteMany({ customerId: { $in: ids } }),
    BillDraft.deleteMany({}),
    GiftCardTransaction.deleteMany({ giftCardId: { $in: cardIds } }),
  ]);
  await Promise.all([Appointment.deleteMany({ _id: { $in: appointmentIds } }), GiftCard.deleteMany({ _id: { $in: cardIds } }), Counter.deleteMany({ _id: "draft" })]);
  const { deletedCount } = await User.deleteMany({ _id: { $in: ids }, role: "customer" });

  await audit(actor, "customer.delete_all", "User", "all", `Deleted all ${deletedCount} customers, ${appointmentIds.length} appointments and ${invoices} invoices`);
  return { customers: deletedCount, appointments: appointmentIds.length, invoices };
}

/**
 * Owner-only: permanently deletes one customer and their history (bills, payments, appointments,
 * reviews, balances, memberships, gift cards…). Coupon use counts are reduced for their bills.
 */
export async function deleteCustomer(customerId: Types.ObjectId, actor: AuthUser) {
  if (actor.role !== "owner") throw forbidden("Only the owner can delete customers.");
  const customer = await User.findOne({ _id: customerId, role: "customer" }).select("name").lean();
  if (!customer) throw notFound("Customer not found.");

  const invoiceIds = (await Invoice.find({ customerId }).select("_id").lean()).map((i) => i._id);
  const appointmentIds = (await Appointment.find({ customerId }).select("_id").lean()).map((a) => a._id);
  const cardIds = (await GiftCard.find({ $or: [{ purchaserId: customerId }, { soldInvoiceId: { $in: invoiceIds } }] }).select("_id").lean()).map((c) => c._id);

  // Give back the coupon uses their bills took, so offer limits stay right.
  const used = await CouponRedemption.find({ invoiceId: { $in: invoiceIds }, reversed: false }).select("couponId").lean();
  const perCoupon = new Map<string, number>();
  for (const u of used) perCoupon.set(String(u.couponId), (perCoupon.get(String(u.couponId)) ?? 0) + 1);
  for (const [id, n] of perCoupon) {
    await Coupon.updateOne({ _id: id }, [{ $set: { redemptions: { $max: [0, { $subtract: ["$redemptions", n] }] } } }]);
  }

  await Promise.all([
    Payment.deleteMany({ invoiceId: { $in: invoiceIds } }),
    CouponRedemption.deleteMany({ invoiceId: { $in: invoiceIds } }),
    LoyaltyTransaction.deleteMany({ $or: [{ customerId }, { invoiceId: { $in: invoiceIds } }] }),
    SlotLock.deleteMany({ appointmentId: { $in: appointmentIds } }),
    Review.deleteMany({ customerId }),
    Notification.deleteMany({ userId: customerId }),
    Session.deleteMany({ userId: customerId }),
    AdvanceTransaction.deleteMany({ customerId }),
    CustomerMembership.deleteMany({ customerId }),
    BillDraft.deleteMany({ customerId }),
    GiftCardTransaction.deleteMany({ giftCardId: { $in: cardIds } }),
  ]);
  await Promise.all([
    Invoice.deleteMany({ _id: { $in: invoiceIds } }),
    Appointment.deleteMany({ _id: { $in: appointmentIds } }),
    GiftCard.deleteMany({ _id: { $in: cardIds } }),
  ]);
  await User.deleteOne({ _id: customerId, role: "customer" });

  await audit(actor, "customer.delete", "User", String(customerId), `Deleted customer ${customer.name} with ${invoiceIds.length} invoices and ${appointmentIds.length} appointments`);
  return { invoices: invoiceIds.length, appointments: appointmentIds.length };
}
