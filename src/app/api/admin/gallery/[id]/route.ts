import { api, json, readJson } from "@/server/lib/http";
import { bool, clearableStr, objectId, optInt, optStr } from "@/server/lib/validate";
import { badRequest, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { GalleryImage } from "@/server/models";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("gallery.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {};
  const alt = optStr(body, "alt", { min: 1, max: 200 });
  if (alt) set.alt = alt;
  const caption = clearableStr(body, "caption", { max: 200 });
  if (caption !== undefined) set.caption = caption;
  if ("category" in body) {
    if (!(GALLERY_CATEGORIES as readonly unknown[]).includes(body.category)) throw badRequest("Invalid category.", "category");
    set.category = body.category;
  }
  const active = bool(body, "active");
  if (active !== undefined) set.active = active;
  const order = optInt(body, "order", { min: 0, max: 10_000 });
  if (order !== undefined) set.order = order;
  const image = await GalleryImage.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!image) throw notFound();
  await audit(user, "gallery.update", "GalleryImage", String(id), "Updated gallery image");
  return json({ ok: true });
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("gallery.manage");
  const id = objectId((await ctx.params).id);
  const image = await GalleryImage.findByIdAndDelete(id).lean();
  if (!image) throw notFound();
  await audit(user, "gallery.delete", "GalleryImage", String(id), `Removed gallery image ${image.url}`);
  return json({ ok: true });
});
