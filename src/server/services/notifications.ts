import { Notification, User } from "@/server/models";
import { getSettings } from "./settings";
import { formatDate, formatTime } from "@/lib/time";
import { formatINR } from "@/lib/money";

// Notification delivery. In-app notifications are always stored for registered customers.
// Email goes through Resend's HTTP API when RESEND_API_KEY + EMAIL_FROM are set. SMS and
// WhatsApp have no provider wired up yet, so they are recorded as "skipped" rather than
// pretending to send. Every send is de-duplicated by a unique key.

type Channel = "inapp" | "email" | "sms" | "whatsapp";

interface Message {
  event: string;
  key: string; // stable id for de-duplication, e.g. `booking_confirmed:<appointmentId>`
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  subject: string;
  body: string;
  link?: string;
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email provider not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Email provider responded ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

async function record(channel: Channel, msg: Message, to: string | undefined, status: string, error?: string) {
  try {
    await Notification.create({
      userId: msg.userId ?? undefined,
      event: msg.event,
      channel,
      to,
      subject: msg.subject,
      body: msg.body,
      status,
      error,
      link: msg.link,
      dedupeKey: `${msg.key}:${channel}`,
    });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false; // already sent
    throw err;
  }
}

/** Never throws: notification failures must not break bookings or payments. */
export async function notify(msg: Message): Promise<void> {
  try {
    const settings = await getSettings();
    const user = msg.userId ? await User.findById(msg.userId).select("isGuest notificationPrefs").lean() : null;
    const prefs = user?.notificationPrefs ?? { email: true, sms: false, whatsapp: false };

    if (user && !user.isGuest) await record("inapp", msg, undefined, "sent");

    if (settings.notifications?.email && prefs.email && msg.email) {
      // Reserve the dedupe key first so concurrent calls cannot double-send.
      const reserved = await record("email", msg, msg.email, "pending");
      if (reserved) {
        const result = await sendEmail(msg.email, msg.subject, msg.body);
        await Notification.updateOne(
          { dedupeKey: `${msg.key}:email` },
          { status: result.ok ? "sent" : emailConfigured() ? "failed" : "skipped", error: result.error },
        );
      }
    }
    for (const channel of ["sms", "whatsapp"] as const) {
      if (settings.notifications?.[channel] && prefs[channel] && msg.phone) {
        await record(channel, msg, msg.phone, "skipped", `${channel.toUpperCase()} provider not configured`);
      }
    }
  } catch (err) {
    console.error("[notify]", err);
  }
}

interface ApptLike {
  _id: unknown;
  ref: string;
  customerId: unknown;
  customer: { name: string; phone: string; email?: string | null };
  start: Date;
  items: { name: string }[];
}

const SALON = "VG Unisex Saloon";

function apptDetails(a: ApptLike) {
  return `Reference: ${a.ref}\nServices: ${a.items.map((i) => i.name).join(", ")}\nDate: ${formatDate(a.start)}\nTime: ${formatTime(a.start)} (IST)`;
}

const bookingTemplates: Record<string, (a: ApptLike, extra?: string) => { subject: string; body: string }> = {
  booking_received: (a) => ({
    subject: `${SALON}: booking request received (${a.ref})`,
    body: `Hi ${a.customer.name},\n\nThank you for booking with ${SALON}. Your appointment request has been received and will be confirmed by the salon shortly.\n\n${apptDetails(a)}\n\n— ${SALON}`,
  }),
  booking_confirmed: (a) => ({
    subject: `${SALON}: appointment confirmed (${a.ref})`,
    body: `Hi ${a.customer.name},\n\nYour appointment is confirmed.\n\n${apptDetails(a)}\n\nWe look forward to seeing you.\n— ${SALON}`,
  }),
  booking_cancelled: (a, extra) => ({
    subject: `${SALON}: appointment cancelled (${a.ref})`,
    body: `Hi ${a.customer.name},\n\nYour appointment has been cancelled.${extra ? ` Reason: ${extra}` : ""}\n\n${apptDetails(a)}\n\nYou can book again any time.\n— ${SALON}`,
  }),
  booking_rescheduled: (a) => ({
    subject: `${SALON}: appointment rescheduled (${a.ref})`,
    body: `Hi ${a.customer.name},\n\nYour appointment has been moved to a new time.\n\n${apptDetails(a)}\n\n— ${SALON}`,
  }),
  booking_reminder: (a) => ({
    subject: `${SALON}: reminder for your appointment (${a.ref})`,
    body: `Hi ${a.customer.name},\n\nThis is a reminder of your upcoming appointment.\n\n${apptDetails(a)}\n\n— ${SALON}`,
  }),
};

export async function notifyBooking(event: keyof typeof bookingTemplates, appt: ApptLike, extra?: string, keySuffix = "") {
  const { subject, body } = bookingTemplates[event](appt, extra);
  await notify({
    event,
    key: `${event}:${String(appt._id)}${keySuffix}`,
    userId: String(appt.customerId),
    email: appt.customer.email,
    phone: appt.customer.phone,
    subject,
    body,
    link: "/account",
  });
}

export async function notifyPayment(inv: {
  _id: unknown;
  number: string;
  customerId: unknown;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}, amount: number, paymentId: string) {
  await notify({
    event: "payment_received",
    key: `payment_received:${paymentId}`,
    userId: String(inv.customerId),
    email: inv.customer?.email,
    phone: inv.customer?.phone,
    subject: `${SALON}: payment received for invoice ${inv.number}`,
    body: `Hi ${inv.customer?.name ?? ""},\n\nWe have received your payment of ${formatINR(amount)} against invoice ${inv.number}. You can view the invoice in your account.\n\n— ${SALON}`,
    link: "/account/invoices",
  });
}

export async function notifyInvoice(inv: {
  _id: unknown;
  number: string;
  total: number;
  customerId: unknown;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}) {
  await notify({
    event: "invoice_issued",
    key: `invoice_issued:${String(inv._id)}`,
    userId: String(inv.customerId),
    email: inv.customer?.email,
    phone: inv.customer?.phone,
    subject: `${SALON}: invoice ${inv.number}`,
    body: `Hi ${inv.customer?.name ?? ""},\n\nYour invoice ${inv.number} for ${formatINR(inv.total)} is available in your account.\n\n— ${SALON}`,
    link: "/account/invoices",
  });
}
