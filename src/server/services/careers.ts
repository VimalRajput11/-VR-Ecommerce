import { badRequest } from "@/server/lib/errors";
import { bool, clearableStr, oneOf, optInt, str } from "@/server/lib/validate";
import { JOB_TYPES, type JobApplicationDoc, type JobOpeningDoc } from "@/server/models";

export function parseOpening(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || "title" in body) out.title = str(body, "title", { max: 120, label: "Job title" });
  if (!partial || "type" in body) out.type = oneOf(body, "type", JOB_TYPES);
  for (const [field, max] of [["description", 3000], ["requirements", 3000], ["experience", 120], ["salary", 120]] as const) {
    const v = clearableStr(body, field, { max });
    if (v !== undefined) out[field] = v;
  }
  const active = bool(body, "active");
  if (active !== undefined) out.active = active;
  const order = optInt(body, "order", { min: 0, max: 1000 });
  if (order !== undefined) out.order = order;
  return out;
}

/** Only http(s) links are accepted, so nothing like javascript: URLs can be stored. */
export function parsePortfolioUrl(raw: string | undefined) {
  if (!raw) return undefined;
  const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
    return url.toString();
  } catch {
    throw badRequest("Please enter a valid link (e.g. a Google Drive, LinkedIn or Instagram URL).", "portfolioUrl");
  }
}

export function serialiseOpening(o: JobOpeningDoc) {
  return {
    id: String(o._id),
    title: o.title,
    type: o.type,
    description: o.description ?? "",
    requirements: o.requirements ?? "",
    experience: o.experience ?? "",
    salary: o.salary ?? "",
    active: o.active !== false,
    archived: !!o.archived,
    order: o.order ?? 0,
    postedAt: (o as { createdAt?: Date }).createdAt,
  };
}

export function serialiseApplication(a: JobApplicationDoc) {
  return {
    id: String(a._id),
    openingId: a.openingId ? String(a.openingId) : null,
    position: a.position,
    name: a.name,
    phone: a.phone,
    email: a.email ?? "",
    city: a.city ?? "",
    experienceYears: a.experienceYears ?? 0,
    skills: a.skills ?? "",
    portfolioUrl: a.portfolioUrl ?? "",
    message: a.message ?? "",
    status: a.status,
    notes: a.notes ?? "",
    at: (a as { createdAt?: Date }).createdAt,
  };
}
