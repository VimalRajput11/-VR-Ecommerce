import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ApiError, badRequest, forbidden } from "./errors";
import { connectDB, DatabaseUnavailableError } from "@/server/db";

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function allowedOrigins(req: NextRequest): string[] {
  const configured = (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? [...configured, `${proto}://${host}`] : configured;
}

/**
 * Wraps a route handler with: DB connection, CSRF origin checking for state-changing
 * requests, and centralised error handling that never leaks internals to the client.
 */
export function api<C = unknown>(handler: Handler<C>, opts: { skipOriginCheck?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!SAFE_METHODS.has(req.method) && !opts.skipOriginCheck) {
        const origin = req.headers.get("origin");
        if (origin && !allowedOrigins(req).includes(origin.replace(/\/$/, ""))) {
          throw forbidden("Cross-site request blocked.");
        }
      }
      await connectDB();
      const res = await handler(req, ctx);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message, code: err.code, field: err.field }, { status: err.status });
  }
  if (err instanceof DatabaseUnavailableError) {
    console.error("[db]", err.cause ?? err);
    return Response.json(
      { error: "The service is temporarily unavailable. Please try again shortly.", code: "db_unavailable" },
      { status: 503 },
    );
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return Response.json({ error: first?.message ?? "Invalid data.", code: "validation", field: first?.path }, { status: 400 });
  }
  if (err instanceof mongoose.Error.CastError) {
    return Response.json({ error: "Invalid identifier.", code: "bad_request" }, { status: 400 });
  }
  if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
    return Response.json({ error: "That record already exists.", code: "duplicate" }, { status: 409 });
  }
  console.error("[api]", err);
  return Response.json({ error: "Something went wrong. Please try again.", code: "server_error" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Request body must be an object.");
  return body as Record<string, unknown>;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function csvResponse(filename: string, rows: (string | number | null | undefined)[][]): Response {
  const escape = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "﻿" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
