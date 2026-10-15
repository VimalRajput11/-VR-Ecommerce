import { readFile } from "node:fs/promises";
import path from "node:path";
import { MIME_BY_EXT, UPLOAD_DIR } from "@/server/services/uploads";

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const parts = (await ctx.params).path;
  if (!parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p) && p !== ".." && p !== ".")) return new Response("Not found", { status: 404 });
  const file = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, ...parts);
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(/*turbopackIgnore: true*/ file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
