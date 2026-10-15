"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "General enquiry", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<ApiClientError | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.phone && !form.email) {
      setError(new ApiClientError("Please share a phone number or email so we can reply.", 400, "bad_request", "phone"));
      return;
    }
    setStatus("sending");
    try {
      await apiFetch("/api/contact", { body: form });
      setStatus("sent");
    } catch (err) {
      setError(err as ApiClientError);
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <Alert tone="success">
        Thank you, {form.name.split(" ")[0]}. Your message has been sent and we&apos;ll get back to you soon.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && !error.field && <Alert tone="error">{error.message}</Alert>}
      <Input label="Your name" required value={form.name} onChange={set("name")} autoComplete="name" maxLength={100} error={error?.field === "name" ? error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Mobile number" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" error={error?.field === "phone" ? error.message : null} />
        <Input label="Email" type="email" value={form.email} onChange={set("email")} autoComplete="email" error={error?.field === "email" ? error.message : null} />
      </div>
      <Select label="Subject" value={form.subject} onChange={set("subject")}>
        {["General enquiry", "Bridal / occasion booking", "Pricing", "Feedback", "Other"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Textarea label="Message" required rows={5} value={form.message} onChange={set("message")} maxLength={2000} error={error?.field === "message" ? error.message : null} />
      {/* Honeypot — hidden from people, tempting for bots */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>
      <p className="text-xs text-stone">We use your details only to reply to this message. See our privacy policy.</p>
      <Button type="submit" loading={status === "sending"} size="lg" className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
