import { badRequest } from "@/server/lib/errors";
import { dateKey } from "@/server/lib/validate";
import { addDaysToKey, dateKeyIST, istToUtc } from "@/lib/time";

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, IST days). Defaults to the last 30 days. */
export function parseRange(params: URLSearchParams) {
  const today = dateKeyIST();
  const from = params.get("from") ? dateKey(params.get("from"), "from") : addDaysToKey(today, -29);
  const to = params.get("to") ? dateKey(params.get("to"), "to") : today;
  if (to < from) throw badRequest("The end date must be on or after the start date.", "to");
  if (new Date(to).getTime() - new Date(from).getTime() > 731 * 86_400_000) throw badRequest("Please choose a range of two years or less.", "from");
  return { from, to, range: { from: istToUtc(from, 0), to: istToUtc(addDaysToKey(to, 1), 0) } };
}
