"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";
import { Alert, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";

export default function ApplicationForm({ jobs, initialRole }: { jobs: { id: string; title: string }[]; initialRole: string }) {
  const [form, setForm] = useState({
    openingId: initialRole,
    name: "",
    phone: "",
    email: "",
    city: "",
    experienceYears: "",
    skills: "",
    portfolioUrl: "",
    message: "",
    website: "",
  });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<ApiClientError | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      await apiFetch("/api/careers/apply", {
        body: {
          ...form,
          openingId: form.openingId || undefined,
          experienceYears: form.experienceYears === "" ? undefined : Number(form.experienceYears),
          consent,
        },
      });
      setStatus("sent");
    } catch (err) {
      setError(err as ApiClientError);
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <Alert tone="success">
        Thank you, {form.name.split(" ")[0]}! Your application has been received. If your profile matches, we&apos;ll contact you on {form.phone}.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !["name", "phone", "email", "portfolioUrl", "experienceYears", "openingId"].includes(error.field ?? "") && <Alert tone="error">{error.message}</Alert>}
      <Select label="Position" value={form.openingId} onChange={set("openingId")} error={fieldError("openingId")}>
        <option value="">General application</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required autoComplete="name" value={form.name} onChange={set("name")} maxLength={100} error={fieldError("name")} />
        <Input label="Mobile number" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={fieldError("phone")} />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={fieldError("email")} />
        <Input label="City / area" value={form.city} onChange={set("city")} maxLength={80} />
        <Input label="Years of experience" type="number" min={0} max={60} value={form.experienceYears} onChange={set("experienceYears")} error={fieldError("experienceYears")} />
        <Input
          label="Link to your work"
          value={form.portfolioUrl}
          onChange={set("portfolioUrl")}
          placeholder="Instagram, Drive or LinkedIn"
          maxLength={300}
          error={fieldError("portfolioUrl")}
        />
      </div>
      <Input label="Skills / services you do well" value={form.skills} onChange={set("skills")} maxLength={500} placeholder="e.g. men's cuts, hair colour, threading, bridal makeup" />
      <Textarea label="About you" rows={4} value={form.message} onChange={set("message")} maxLength={2000} hint="Previous salons, certifications, availability, expected salary — anything you'd like us to know." />
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>
      <Checkbox
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        label={
          <>
            I agree to VG Unisex Salon storing these details for hiring purposes, as described in the{" "}
            <Link href="/privacy" className="text-gold-deep underline">
              privacy policy
            </Link>
            .
          </>
        }
      />
      {error?.field === "consent" && <p className="text-xs text-danger">{error.message}</p>}
      <Button type="submit" size="lg" loading={status === "sending"} disabled={!consent} className="w-full sm:w-auto">
        Submit application
      </Button>
    </form>
  );
}
