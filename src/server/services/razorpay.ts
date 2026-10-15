import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/server/lib/errors";

// Razorpay integration over its REST API (no SDK). Inactive until RAZORPAY_KEY_ID,
// RAZORPAY_KEY_SECRET (and RAZORPAY_WEBHOOK_SECRET for webhooks) are configured.
// Payment success is only ever trusted after server-side verification.

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader() {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  if (!razorpayConfigured()) throw new ApiError(503, "Online payments are not configured.", "payments_unavailable");
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40), notes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("[razorpay] order failed", res.status, await res.text().catch(() => ""));
    throw new ApiError(502, "Could not start the online payment. Please try again or pay at the salon.", "gateway_error");
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

export async function fetchPayment(paymentId: string) {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new ApiError(502, "Could not verify the payment with the gateway.", "gateway_error");
  return (await res.json()) as { id: string; order_id: string; amount: number; currency: string; status: string; method?: string };
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
