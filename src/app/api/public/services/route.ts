import { api, json } from "@/server/lib/http";
import { getPublicCatalog } from "@/server/queries/public";
import { getSettings, publicSettings } from "@/server/services/settings";

export const GET = api(async () => {
  const [catalog, settings] = await Promise.all([getPublicCatalog(), getSettings()]);
  return json({ ...catalog, settings: publicSettings(settings) });
});
