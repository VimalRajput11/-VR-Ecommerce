import { api, json, readJson } from "@/server/lib/http";
import { dateKey, int, objectId, str } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { GiftCard, User } from "@/server/models";
import { giftCardStatus, issueGiftCard } from "@/server/services/pos";
import { dateKeyIST } from "@/lib/time";

/** ?code=GC-… checks one card's balance; without a code, lists recently sold / issued cards. */
export const GET = api(async (req) => {
  await requirePermission("billing.manage");
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (code) return json({ card: await giftCardStatus(code.slice(0, 40)) });
  const cards = await GiftCard.find().sort({ createdAt: -1 }).limit(30).lean();
  const people = new Map((await User.find({ _id: { $in: cards.map((c) => c.purchaserId).filter(Boolean) } }).select("name").lean()).map((u) => [String(u._id), u.name]));
  return json({
    cards: cards.map((c) => ({
      code: c.code,
      initialValue: c.initialValue,
      balance: c.balance,
      expiresAt: c.expiresAt ?? null,
      active: c.active !== false,
      soldAt: (c as { createdAt?: Date }).createdAt,
      free: !c.soldInvoiceId, // issued by the owner rather than sold on a bill
      customer: c.purchaserId ? (people.get(String(c.purchaserId)) ?? "") : "",
    })),
  });
});

/** Owner only: issue a gift card without a sale (gift, reward, festival offer). */
export const POST = api(async (req) => {
  const user = await requirePermission("offers.manage");
  const body = await readJson(req);
  const expiresOn = body.expiresOn ? dateKey(body.expiresOn, "expiresOn") : undefined;
  if (expiresOn && expiresOn < dateKeyIST()) throw badRequest("The expiry date can't be in the past.", "expiresOn");
  const card = await issueGiftCard(
    {
      amount: int(body, "amount", { min: 100, max: 10_000_000, label: "Card value" }),
      expiresOn,
      note: str(body, "note", { max: 300, label: "Reason" }),
      customerId: body.customerId ? objectId(body.customerId, "customerId") : undefined,
    },
    user,
  );
  return json({ card }, 201);
});
