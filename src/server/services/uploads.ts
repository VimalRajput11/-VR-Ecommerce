import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { ApiError, badRequest } from "@/server/lib/errors";

// Where uploaded images are stored:
//  - Vercel Blob when BLOB_READ_WRITE_TOKEN is set (required on Vercel, which has no
//    persistent disk); the image is served from Blob's public URL.
//  - Otherwise a local folder outside /public (Next only serves public files present at build
//    time), streamed by src/app/uploads/[...path]/route.ts.

export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads"));
// 4 MB default keeps uploads under Vercel's 4.5 MB request body limit.
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 4 * 1024 * 1024);

export function usingBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Validates by size and by file signature (not the client-supplied type) and stores it. */
export async function saveImage(file: File, folder: string): Promise<string> {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("Please choose an image.", "file");
  if (file.size > MAX_BYTES) throw badRequest(`Images must be ${Math.round(MAX_BYTES / 1024 / 1024)} MB or smaller.`, "file");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = SIGNATURES.find((s) => s.test(buf));
  if (!kind) throw badRequest("Only JPEG, PNG or WebP images are allowed.", "file");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${kind.ext}`;

  if (usingBlobStorage()) {
    try {
      const blob = await put(`${safeFolder}/${name}`, buf, { access: "public", contentType: kind.mime, addRandomSuffix: false });
      return blob.url;
    } catch (err) {
      console.error("[uploads] Vercel Blob upload failed", err);
      throw new ApiError(
        502,
        "Image upload to Vercel Blob failed. Website images need a Blob store created with Public access — check the Storage settings in Vercel.",
        "uploads_failed",
      );
    }
  }
  if (process.env.VERCEL) {
    throw new ApiError(503, "Image uploads need Vercel Blob storage. Connect a Blob store to this project, or use an image link instead.", "uploads_unavailable");
  }

  const dir = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, safeFolder);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ dir, name), buf, { flag: "wx" });
  return `/uploads/${safeFolder}/${name}`;
}
