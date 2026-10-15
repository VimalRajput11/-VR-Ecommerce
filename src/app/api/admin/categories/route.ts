import { api, json, readJson } from "@/server/lib/http";
import { optInt, optStr, slugify, str } from "@/server/lib/validate";
import { conflict } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { ServiceCategory } from "@/server/models";
import { audit } from "@/server/services/audit";

export const POST = api(async (req) => {
  const user = await requirePermission("services.manage");
  const body = await readJson(req);
  const name = str(body, "name", { max: 80, label: "Category name" });
  const slug = slugify(name);
  if (await ServiceCategory.exists({ slug })) throw conflict("A category with this name already exists.");
  const category = await ServiceCategory.create({
    name,
    slug,
    description: optStr(body, "description", { max: 400 }),
    order: optInt(body, "order", { min: 0, max: 1000 }) ?? 0,
  });
  await audit(user, "category.create", "ServiceCategory", String(category._id), `Created category ${name}`);
  return json({ category: { id: String(category._id), name, slug } }, 201);
});
