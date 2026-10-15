import { api, json } from "@/server/lib/http";
import { verifyWebhookSignature } from "@/server/services/razorpay";
import { applyGatewayPayment } from "@/server/services/online-payments";

// Razorpay webhook (configure for "payment.captured"). The signature is checked against the
// raw body; duplicate deliveries are harmless because payments are keyed by gateway id.
export const POST = api(
  async (req) => {
    const raw = await req.text();
    if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
      return json({ error: "Invalid signature" }, 401);
    }
    const event = JSON.parse(raw) as { event?: string; payload?: { payment?: { entity?: { id?: string } } } };
    const paymentId = event.payload?.payment?.entity?.id;
    if (event.event === "payment.captured" && paymentId) {
      await applyGatewayPayment(paymentId);
    }
    return json({ ok: true });
  },
  { skipOriginCheck: true },
);
