import { Types } from "mongoose";
import { Service, ServiceCategory, type ServiceDoc } from "@/server/models";
import { badRequest } from "@/server/lib/errors";
import { bool, clearableStr, int, objectId, objectIdArray, oneOf, optInt, slugify, str } from "@/server/lib/validate";
import { SERVICE_AUDIENCES } from "@/lib/constants";

async function uniqueSlug(base: string, excludeId?: Types.ObjectId) {
  const root = slugify(base) || "service";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const clash = await Service.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return slug;
  }
  return `${root}-${Date.now()}`;
}

/** Validates create (partial=false) or update (partial=true) payloads for a service. */
export async function parseServiceInput(body: Record<string, unknown>, partial: boolean, existingId?: Types.ObjectId) {
  const out: Record<string, unknown> = {};
  if (!partial || "name" in body) {
    out.name = str(body, "name", { max: 120, label: "Service name" });
    out.slug = await uniqueSlug(out.name as string, existingId);
  }
  if (!partial || "categoryId" in body) {
    const categoryId = objectId(body.categoryId, "categoryId");
    if (!(await ServiceCategory.exists({ _id: categoryId }))) throw badRequest("Category not found.", "categoryId");
    out.categoryId = categoryId;
  }
  if (!partial || "durationMin" in body) out.durationMin = int(body, "durationMin", { min: 5, max: 720, label: "Duration" });
  if (!partial || "price" in body) out.price = int(body, "price", { min: 0, max: 100_000_000, label: "Price" });
  const buffer = optInt(body, "bufferMin", { min: 0, max: 120, label: "Buffer" });
  if (buffer !== undefined) out.bufferMin = buffer;
  if ("kind" in body) out.kind = oneOf(body, "kind", ["service", "package", "addon"] as const);
  if ("audience" in body) out.audience = oneOf(body, "audience", SERVICE_AUDIENCES);
  const description = clearableStr(body, "description", { max: 1500 });
  if (description !== undefined) out.description = description;
  const image = clearableStr(body, "image", { max: 500 });
  if (image !== undefined) {
    if (image && !/^(https:\/\/|\/uploads\/)/.test(image)) throw badRequest("Image must be an https URL or an uploaded image.", "image");
    out.image = image;
  }
  for (const flag of ["priceFrom", "priceVerified", "taxable", "featured", "onlineBooking", "active"] as const) {
    const v = bool(body, flag);
    if (v !== undefined) out[flag] = v;
  }
  const order = optInt(body, "order", { min: 0, max: 10_000 });
  if (order !== undefined) out.order = order;
  if ("includes" in body) out.includes = objectIdArray(body, "includes", { max: 20 });
  if ("eligibleStaff" in body) out.eligibleStaff = objectIdArray(body, "eligibleStaff", { max: 50 });
  if ("consumes" in body) {
    if (!Array.isArray(body.consumes)) throw badRequest("consumes must be a list.", "consumes");
    out.consumes = (body.consumes as Record<string, unknown>[]).slice(0, 20).map((c) => ({
      productId: objectId(c.productId, "consumes"),
      qty: Math.max(0, Number(c.qty) || 0),
    }));
  }
  return out;
}

export function serialiseAdminService(s: ServiceDoc) {
  return {
    id: String(s._id),
    name: s.name,
    slug: s.slug,
    categoryId: String(s.categoryId),
    kind: s.kind,
    audience: s.audience,
    description: s.description ?? "",
    durationMin: s.durationMin,
    bufferMin: s.bufferMin ?? 0,
    price: s.price,
    priceFrom: !!s.priceFrom,
    priceVerified: !!s.priceVerified,
    taxable: s.taxable !== false,
    includes: (s.includes ?? []).map(String),
    eligibleStaff: (s.eligibleStaff ?? []).map(String),
    consumes: (s.consumes ?? []).map((c) => ({ productId: String(c.productId), qty: c.qty })),
    image: s.image ?? "",
    featured: !!s.featured,
    onlineBooking: s.onlineBooking !== false,
    active: s.active !== false,
    archived: !!s.archived,
    order: s.order ?? 0,
  };
}
