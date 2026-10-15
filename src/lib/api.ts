"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side service layer for talking to the app's API routes.

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiClientError("Network error. Please check your connection and try again.", 0, "network");
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    throw new ApiClientError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status, (data as { code?: string }).code, (data as { field?: string }).field);
  }
  return data as T;
}

/** GET with loading/error state and a reload function. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [settled, setSettled] = useState<{ key: string | null; error: ApiClientError | null }>({ key: null, error: null });
  const [version, setVersion] = useState(0);
  const latest = useRef(0);
  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!path || !key) return;
    const ctrl = new AbortController();
    const id = ++latest.current;
    apiFetch<T>(path, { signal: ctrl.signal })
      .then((d) => {
        if (id !== latest.current) return;
        setData(d);
        setSettled({ key, error: null });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError" && id === latest.current) setSettled({ key, error: e as ApiClientError });
      });
    return () => ctrl.abort();
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = !!key && settled.key !== key;
  const error = settled.key === key ? settled.error : null;
  return { data, error, loading, reload, setData };
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
}
