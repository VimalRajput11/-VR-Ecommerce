import { Invoice } from "@/server/models";
import { fetchPayment } from "./razorpay";
import { recordPayment } from "./billing";

/**
 * Applies a gateway payment to its invoice after confirming with Razorpay's API that it is
 * captured and matches the order. Idempotent: repeated calls for the same payment are no-ops.
 */
export async function applyGatewayPayment(paymentId: string, expectedOrderId?: string) {
  const payment = await fetchPayment(paymentId);
  if (expectedOrderId && payment.order_id !== expectedOrderId) return { applied: false, reason: "order_mismatch" };
  if (payment.status !== "captured") return { applied: false, reason: `status_${payment.status}` };
  if (payment.currency !== "INR") return { applied: false, reason: "currency" };

  const invoice = await Invoice.findOne({ gatewayOrderId: payment.order_id });
  if (!invoice) return { applied: false, reason: "invoice_not_found" };
  const amount = Math.min(payment.amount, invoice.balanceDue);
  if (amount <= 0) return { applied: false, reason: "nothing_due", invoiceId: String(invoice._id) };

  const result = await recordPayment(
    invoice._id,
    { amount, method: "online", reference: payment.method ? `Razorpay ${payment.method}` : "Razorpay", gatewayPaymentId: payment.id },
    null,
  );
  return { applied: !result.duplicate, invoiceId: String(invoice._id) };
}
