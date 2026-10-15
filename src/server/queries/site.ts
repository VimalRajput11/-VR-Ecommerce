import { cache } from "react";
import { BusinessSettings } from "@/server/models";
import { getSettings, publicSettings, type PublicSettings, type Settings } from "@/server/services/settings";

/**
 * Public settings for page rendering. If the database is unreachable the site still renders
 * with schema defaults (no contact details are invented), and `degraded` is set.
 */
export const getSiteSettings = cache(async (): Promise<PublicSettings & { degraded: boolean }> => {
  try {
    return { ...publicSettings(await getSettings()), degraded: false };
  } catch (err) {
    console.error("[site] settings unavailable", err);
    const defaults = new BusinessSettings().toObject() as unknown as Settings;
    return { ...publicSettings(defaults), degraded: true };
  }
});

/** Run a DB-backed loader for a public page; return the fallback if the DB is down. */
export async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    console.error("[site] load failed", err);
    return fallback;
  }
}
