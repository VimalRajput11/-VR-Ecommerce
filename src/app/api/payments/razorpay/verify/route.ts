import { api, json, readJson } from "@/server/lib/http";
import { str } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/auth/session";
import { verifyCheckoutSignature } from "@/server/services/razorpay";
import { applyGatewayPayment } from "@/server/services/online-payments";
import { Invoice } from "@/server/models";

// Called by the browser after Razorpay Checkout completes. We verify the signature and then
// confirm the payment status directly with Razorpay before recording anything.
export const POST = api(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const orderId = str(body, "razorpay_order_id", { max: 100 });
  const paymentId = str(body, "razorpay_payment_id", { max: 100 });
  const signature = str(body, "razorpay_signature", { max: 200 });
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) throw badRequest("Payment signature could not be verified.");
  const invoice = await Invoice.findOne({ gatewayOrderId: orderId, customerId: user.id }).select("_id").lean();
  if (!invoice) throw badRequest("Payment does not match any of your invoices.");
  const result = await applyGatewayPayment(paymentId, orderId);
  return json({ ok: true, ...result });
});
