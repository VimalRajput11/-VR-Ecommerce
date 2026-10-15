import { api, json } from "@/server/lib/http";
import { optStr, str } from "@/server/lib/validate";
import { badRequest, forbidden } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { GalleryImage } from "@/server/models";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import { saveImage } from "@/server/services/uploads";
import { audit } from "@/server/services/audit";

export const GET = api(async () => {
  await requirePermission("gallery.manage");
  const images = await GalleryImage.find().sort({ order: 1, createdAt: -1 }).limit(300).lean();
  return json({
    images: images.map((g) => ({ id: String(g._id), url: g.url, alt: g.alt, caption: g.caption ?? "", category: g.category, active: g.active, order: g.order })),
  });
});

/** Multipart upload: file, alt, category, caption. Also used for service images (folder=services). */
export const POST = api(async (req) => {
  const user = await requirePermission("gallery.manage", "services.manage");
  const form = await req.formData().catch(() => {
    throw badRequest("Expected a file upload.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Please choose an image.", "file");
  const folder = form.get("folder") === "services" ? "services" : "gallery";
  if (!user.permissions.includes(folder === "services" ? "services.manage" : "gallery.manage")) throw forbidden();
  if (folder === "services") return json({ url: await saveImage(file, folder) }, 201);

  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const category = fields.category;
  if (!(GALLERY_CATEGORIES as readonly string[]).includes(category)) throw badRequest("Choose a gallery category.", "category");
  const alt = str(fields, "alt", { max: 200, label: "Image description" });
  const caption = optStr(fields, "caption", { max: 200 });
  const url = await saveImage(file, folder);
  const image = await GalleryImage.create({
    url,
    alt,
    caption,
    category,
    uploadedBy: user.id,
  });
  await audit(user, "gallery.upload", "GalleryImage", String(image._id), `Uploaded image to ${category}`);
  return json({ image: { id: String(image._id), url } }, 201);
});
