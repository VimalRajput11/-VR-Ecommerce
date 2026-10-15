"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, Checkbox, Input } from "@/components/ui";

/** Only allow same-site relative redirects after sign-in. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", acceptTerms: false, marketingConsent: false });
  const [error, setError] = useState<ApiClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        body: mode === "login" ? { email: form.email, password: form.password } : form,
      });
      const user = await refresh();
      const fallback = user && user.role !== "customer" ? "/dashboard" : "/account";
      router.replace(next ?? fallback);
      router.refresh();
    } catch (err) {
      setError(err as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !["name", "email", "phone", "password", "acceptTerms"].includes(error.field ?? "") && <Alert tone="error">{error.message}</Alert>}
      {mode === "register" && (
        <Input label="Full name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError("name")} />
      )}
      <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError("email")} />
      {mode === "register" && (
        <Input
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          hint="Optional, used for booking updates"
          error={fieldError("phone")}
        />
      )}
      <Input
        label="Password"
        type="password"
        required
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        hint={mode === "register" ? "At least 8 characters with letters and numbers" : undefined}
        error={fieldError("password")}
      />
      {mode === "register" && (
        <>
          <Checkbox
            checked={form.acceptTerms}
            onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
            label={
              <>
                I accept the <Link href="/terms" className="text-gold-deep underline">terms</Link> and <Link href="/privacy" className="text-gold-deep underline">privacy policy</Link>.
              </>
            }
          />
          {fieldError("acceptTerms") && <p className="text-xs text-danger">{fieldError("acceptTerms")}</p>}
          <Checkbox checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} label="Send me occasional offers (optional)" />
        </>
      )}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-stone">
        {mode === "login" ? (
          <>
            New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-gold-deep underline">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-gold-deep underline">Sign in</Link>
          </>
        )}
      </p>
      {mode === "login" && <p className="text-center text-xs text-stone">Forgot your password? Please contact the salon and we&apos;ll help you reset it.</p>}
    </form>
  );
}
