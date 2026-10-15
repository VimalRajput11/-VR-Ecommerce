import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, optPhone, optStr } from "@/server/lib/validate";
import { requireUser } from "@/server/auth/session";
import { LoyaltyTransaction, User } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { getPublicOffers } from "@/server/queries/public";

export const GET = api(async () => {
  const auth = await requireUser();
  const [user, settings] = await Promise.all([User.findById(auth.id).lean(), getSettings()]);
  const loyaltyEnabled = !!settings.features?.loyalty;
  const [transactions, offers] = await Promise.all([
    loyaltyEnabled ? LoyaltyTransaction.find({ customerId: auth.id }).sort({ createdAt: -1 }).limit(20).lean() : [],
    getPublicOffers(),
  ]);
  return json({
    profile: {
      name: user?.name,
      email: user?.email,
      phone: user?.phone ?? "",
      preferences: user?.preferences ?? "",
      marketingConsent: !!user?.marketingConsent,
      notificationPrefs: user?.notificationPrefs ?? { email: true, sms: false, whatsapp: false },
      memberSince: user?.createdAt,
      role: auth.role,
    },
    loyalty: loyaltyEnabled
      ? {
          points: user?.loyaltyPoints ?? 0,
          pointValuePaise: settings.loyalty?.pointValuePaise ?? 0,
          minRedeemPoints: settings.loyalty?.minRedeemPoints ?? 0,
          pointsPer100: settings.loyalty?.pointsPer100 ?? 0,
          transactions: transactions.map((t) => ({ points: t.points, reason: t.reason, at: t.createdAt, note: t.note })),
        }
      : null,
    offers,
  });
});

export const PATCH = api(async (req) => {
  const auth = await requireUser();
  const body = await readJson(req);
  const update: Record<string, unknown> = {};
  const name = optStr(body, "name", { min: 1, max: 100 });
  if (name) update.name = name;
  if ("phone" in body) update.phone = optPhone(body) ?? "";
  const prefs = clearableStr(body, "preferences", { max: 1000 });
  if (prefs !== undefined) update.preferences = prefs;
  if (typeof body.marketingConsent === "boolean") update.marketingConsent = body.marketingConsent;
  if (body.notificationPrefs && typeof body.notificationPrefs === "object") {
    const np = body.notificationPrefs as Record<string, unknown>;
    for (const k of ["email", "sms", "whatsapp"]) if (typeof np[k] === "boolean") update[`notificationPrefs.${k}`] = np[k];
  }
  await User.updateOne({ _id: auth.id }, { $set: update }, { runValidators: true });
  return json({ ok: true });
});
