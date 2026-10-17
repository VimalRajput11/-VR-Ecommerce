import { badRequest } from "@/server/lib/errors";
import { dateKey, int, isObjectId, objectId, optEmail, optInt, optStr, phone, str } from "@/server/lib/validate";
import { User } from "@/server/models";
import { addDaysToKey, dateKeyIST, istToUtc, minutesOfDayIST } from "@/lib/time";
import type { InvoiceInput } from "./billing";

// Reads a bill from a request body (amounts in paise). Shared by "create invoice", the billing
// screen's live quote, saved drafts and finalize, so every path validates a bill the same way.
// Prices are never read from the body: they come from the catalogue when the invoice is built.

type Obj = Record<string, unknown>;

function parseList<T>(raw: unknown, field: string, map: (v: Obj) => T, max = 50): T[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw badRequest(`${field} must be a list.`, field);
  if (raw.length > max) throw badRequest(`Too many ${field}.`, field);
  return raw.map((v) => map((v ?? {}) as Obj));
}

const parseAllocations = (raw: unknown) =>
  parseList(raw, "allocations", (a) => ({ staffId: objectId(a.staffId, "allocations"), percent: int(a, "percent", { min: 1, max: 100, label: "Staff share" }) }), 5);

/** `requireCustomer` is false for drafts and quotes, which may be saved before a customer is chosen. */
export async function parseBillInput(body: Obj, opts: { requireCustomer?: boolean } = {}): Promise<InvoiceInput> {
  const input: InvoiceInput = {
    services: parseList(body.services, "services", (v) => ({
      serviceId: objectId(v.serviceId, "services"),
      qty: int(v, "qty", { min: 1, max: 20 }),
      allocations: parseAllocations(v.allocations),
    })),
    products: parseList(body.products, "products", (v) => ({ productId: objectId(v.productId, "products"), qty: int(v, "qty", { min: 1, max: 100 }) })),
    customLines: parseList(body.customLines, "customLines", (v) => ({
      description: str(v, "description", { max: 200, label: "Item description" }),
      amount: int(v, "amount", { min: 1, max: 100_000_000, label: "Item amount" }),
    })),
    giftCards: parseList(body.giftCards, "giftCards", (v) => ({ amount: int(v, "amount", { min: 100, max: 10_000_000, label: "Gift card value" }) }), 10),
    advances: parseList(body.advances, "advances", (v) => ({ amount: int(v, "amount", { min: 100, max: 10_000_000, label: "Advance amount" }) }), 5),
    memberships: parseList(body.memberships, "memberships", (v) => ({ planId: objectId(v.planId, "memberships") }), 3),
    couponCode: optStr(body, "couponCode", { max: 30 }),
    loyaltyPoints: optInt(body, "loyaltyPoints", { min: 0, max: 1_000_000 }),
    notes: optStr(body, "notes", { max: 500 }),
  };
  if (Array.isArray(body.appointmentAllocations)) {
    input.appointmentAllocations = body.appointmentAllocations.slice(0, 20).map((a) => (Array.isArray(a) && a.length ? parseAllocations(a) : null));
  }
  // Who did the services on a walk-in bill (for their commission); appointments already know their stylist.
  if (body.staffId) {
    const staffId = objectId(body.staffId, "staffId");
    if (!(await User.exists({ _id: staffId, role: { $in: ["owner", "receptionist", "stylist"] } }))) throw badRequest("Choose a valid staff member.", "staffId");
    input.staffId = staffId;
  }
  // Optional bill date (IST) for bills entered after the visit: not in the future, at most a year back.
  if (body.billDate) {
    const day = dateKey(body.billDate, "billDate");
    const today = dateKeyIST();
    if (day > today) throw badRequest("The bill date can't be in the future.", "billDate");
    if (day < addDaysToKey(today, -365)) throw badRequest("The bill date can't be more than a year ago.", "billDate");
    if (day !== today) input.issuedAt = istToUtc(day, minutesOfDayIST(new Date()));
  }
  if (body.manualDiscount && typeof body.manualDiscount === "object") {
    const md = body.manualDiscount as Obj;
    const type = md.type === "percent" ? "percent" : "flat";
    const value = int(md, "value", { min: 0, max: type === "percent" ? 100 : 100_000_000, label: "Discount" });
    if (value > 0) input.manualDiscount = { type, value, reason: str(md, "reason", { max: 200, label: "Discount reason" }) };
  }
  if (body.appointmentId) {
    input.appointmentId = objectId(body.appointmentId, "appointmentId");
  } else {
    const c = (body.customer ?? {}) as Obj;
    const hasCustomer = isObjectId(c.id) || !!c.name || !!c.phone;
    if (hasCustomer || opts.requireCustomer !== false) {
      input.customer = {
        userId: isObjectId(c.id) ? c.id : undefined,
        name: str(c, "name", { max: 100, label: "Customer name" }),
        phone: phone(c),
        email: optEmail(c),
      };
    }
  }
  return input;
}
