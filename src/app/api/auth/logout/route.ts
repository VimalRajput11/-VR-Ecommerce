import { api, json } from "@/server/lib/http";
import { destroySession } from "@/server/auth/session";

export const POST = api(async () => {
  await destroySession();
  return json({ ok: true });
});
