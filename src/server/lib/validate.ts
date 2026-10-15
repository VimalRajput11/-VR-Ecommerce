import { Types } from "mongoose";
import { badRequest } from "./errors";
import { isValidDateKey } from "@/lib/time";

// Small, dependency-free validators. Each one throws a 400 ApiError naming the field.

type Obj = Record<string, unknown>;

interface StrOpts {
  min?: number;
  max?: number;
  pattern?: RegExp;
  label?: string;
}

function label(field: string, opts?: { label?: string }) {
  return opts?.label ?? field;
}

export function str(body: Obj, field: string, opts: StrOpts = {}): string {
  const raw = body[field];
  if (typeof raw !== "string") throw badRequest(`${label(field, opts)} is required.`, field);
  const value = raw.trim();
  const min = opts.min ?? 1;
  const max = opts.max ?? 500;
  if (value.length < min) throw badRequest(`${label(field, opts)} is required.`, field);
  if (value.length > max) throw badRequest(`${label(field, opts)} must be at most ${max} characters.`, field);
  if (opts.pattern && !opts.pattern.test(value)) throw badRequest(`${label(field, opts)} is not valid.`, field);
  return value;
}

export function optStr(body: Obj, field: string, opts: StrOpts = {}): string | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return undefined;
  return str(body, field, { ...opts, min: opts.min ?? 0 });
}

/** Like optStr but returns "" for an explicit empty value so callers can clear fields. */
export function clearableStr(body: Obj, field: string, opts: StrOpts = {}): string | undefined {
  if (!(field in body)) return undefined;
  const raw = body[field];
  if (raw === null || (typeof raw === "string" && raw.trim() === "")) return "";
  return str(body, field, { ...opts, min: 0 });
}

interface IntOpts {
  min?: number;
  max?: number;
  label?: string;
}

export function int(body: Obj, field: string, opts: IntOpts = {}): number {
  const raw = body[field];
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value))
    throw badRequest(`${label(field, opts)} must be a whole number.`, field);
  if (opts.min !== undefined && value < opts.min)
    throw badRequest(`${label(field, opts)} must be at least ${opts.min}.`, field);
  if (opts.max !== undefined && value > opts.max)
    throw badRequest(`${label(field, opts)} must be at most ${opts.max}.`, field);
  return value;
}

export function optInt(body: Obj, field: string, opts: IntOpts = {}): number | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null || raw === "") return undefined;
  return int(body, field, opts);
}

export function bool(body: Obj, field: string): boolean | undefined {
  const raw = body[field];
  if (raw === undefined) return undefined;
  if (typeof raw !== "boolean") throw badRequest(`${field} must be true or false.`, field);
  return raw;
}

export function oneOf<T extends string>(body: Obj, field: string, values: readonly T[], opts?: { optional?: boolean }): T {
  const raw = body[field];
  if ((raw === undefined || raw === null || raw === "") && opts?.optional) return undefined as unknown as T;
  if (typeof raw !== "string" || !values.includes(raw as T))
    throw badRequest(`${field} must be one of: ${values.join(", ")}.`, field);
  return raw as T;
}

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && Types.ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(value);
}

export function objectId(value: unknown, field = "id"): Types.ObjectId {
  if (!isObjectId(value)) throw badRequest(`${field} is not valid.`, field);
  return new Types.ObjectId(value);
}

export function optObjectId(body: Obj, field: string): Types.ObjectId | null | undefined {
  const raw = body[field];
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  return objectId(raw, field);
}

export function objectIdArray(body: Obj, field: string, opts: { min?: number; max?: number } = {}): Types.ObjectId[] {
  const raw = body[field] ?? [];
  if (!Array.isArray(raw)) throw badRequest(`${field} must be a list.`, field);
  if (raw.length < (opts.min ?? 0)) throw badRequest(`Please choose at least ${opts.min ?? 0} item(s).`, field);
  if (raw.length > (opts.max ?? 50)) throw badRequest(`Too many items in ${field}.`, field);
  const ids = raw.map((v) => objectId(v, field));
  return ids.filter((id, i) => ids.findIndex((x) => x.equals(id)) === i);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Indian mobile numbers, optionally prefixed with +91 / 0. Stored normalised as 10 digits.
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function phone(body: Obj, field = "phone"): string {
  const value = str(body, field, { max: 20, label: "Phone number" });
  const normalised = normalisePhone(value);
  if (!normalised) throw badRequest("Please enter a valid 10-digit Indian mobile number.", field);
  return normalised;
}

export function optPhone(body: Obj, field = "phone"): string | undefined {
  const value = optStr(body, field, { max: 20 });
  if (!value) return undefined;
  const normalised = normalisePhone(value);
  if (!normalised) throw badRequest("Please enter a valid 10-digit Indian mobile number.", field);
  return normalised;
}

export function email(body: Obj, field = "email"): string {
  return str(body, field, { max: 200, pattern: EMAIL_RE, label: "Email" }).toLowerCase();
}

export function optEmail(body: Obj, field = "email"): string | undefined {
  const value = optStr(body, field, { max: 200, pattern: EMAIL_RE, label: "Email" });
  return value?.toLowerCase();
}

export function dateKey(value: unknown, field = "date"): string {
  if (!isValidDateKey(value)) throw badRequest("Please choose a valid date.", field);
  return value;
}

export function isoDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && typeof value !== "number") throw badRequest(`${field} is required.`, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} is not a valid date/time.`, field);
  return d;
}

export function hhmm(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
    throw badRequest(`${field} must be a time like 10:30.`, field);
  return value;
}

/** Escape a user string for safe use inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pagination(params: URLSearchParams, defaultLimit = 25) {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get("limit") ?? String(defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
