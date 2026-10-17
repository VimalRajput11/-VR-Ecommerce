import { api, json } from "@/server/lib/http";
import { isObjectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { GiftCard, User } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { giftCardMessage, siteUrl } from "@/server/services/whatsapp";

/**
 * Ready-to-send WhatsApp message for a gift card (?code=), addressed to ?customerId= if given,
 * otherwise to the card's buyer / recipient.
 */
export const GET = api(async (req) => {
  await requirePermission("billing.manage");
  const p = req.nextUrl.searchParams;
  const code = (p.get("code") ?? "").trim().toUpperCase().slice(0, 40);
  const card = await GiftCard.findOne({ code }).lean();
  if (!card) throw notFound("No gift card with this code.");
  const customerId = p.get("customerId");
  const person = await User.findOne({ _id: isObjectId(customerId) ? customerId : card.purchaserId, role: "customer" }).select("name phone").lean();
  const settings = await getSettings();
  return json({
    code: card.code,
    balance: card.balance,
    initialValue: card.initialValue,
    expiresAt: card.expiresAt ?? null,
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    message: giftCardMessage(card, settings, siteUrl(req.nextUrl.origin), person?.name),
  });
});
