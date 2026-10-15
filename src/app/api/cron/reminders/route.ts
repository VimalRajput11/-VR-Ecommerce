import { timingSafeEqual } from "node:crypto";
import { api, json } from "@/server/lib/http";
import { unauthorized } from "@/server/lib/errors";
import { Appointment } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { notifyBooking } from "@/server/services/notifications";

// Sends appointment reminders. Call from a scheduler with `Authorization: Bearer $CRON_SECRET`
// (Vercel Cron sends this header automatically, using GET). Safe to call repeatedly: each
// reminder is sent once.
const handler = api(
  async (req) => {
    const secret = process.env.CRON_SECRET;
    const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) throw unauthorized("Invalid cron secret.");

    const settings = await getSettings();
    const horizon = new Date(Date.now() + (settings.notifications?.reminderHoursBefore ?? 24) * 3_600_000);
    const due = await Appointment.find({
      status: { $in: ["pending", "confirmed"] },
      start: { $gt: new Date(), $lte: horizon },
      reminderSentAt: { $exists: false },
    }).limit(200);

    let sent = 0;
    for (const appt of due) {
      const claimed = await Appointment.updateOne({ _id: appt._id, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: new Date() } });
      if (!claimed.modifiedCount) continue;
      await notifyBooking("booking_reminder", appt, undefined, `:${appt.start.getTime()}`);
      sent++;
    }
    return json({ ok: true, sent });
  },
  { skipOriginCheck: true },
);

export const GET = handler;
export const POST = handler;
