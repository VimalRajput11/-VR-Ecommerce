import { api, json } from "@/server/lib/http";
import { getSessionUser } from "@/server/auth/session";

export const GET = api(async () => {
  const user = await getSessionUser();
  return json({ user });
});
