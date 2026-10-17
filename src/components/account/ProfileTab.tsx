"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Alert, Button, Card, Checkbox, ErrorState, Input, Spinner, Textarea } from "@/components/ui";

interface Profile {
  name: string;
  email: string;
  phone: string;
  preferences: string;
  marketingConsent: boolean;
  notificationPrefs: { email: boolean; sms: boolean; whatsapp: boolean };
}

export default function ProfileTab() {
  const { data, error, loading, reload } = useApi<{ profile: Profile }>("/api/account/profile");
  const { user, refresh } = useAuth();
  const isStaff = !!user && user.role !== "customer";
  const isOwner = user?.role === "owner";
  const toast = useToast();
  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiClientError | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<ApiClientError | null>(null);

  const [loadedFrom, setLoadedFrom] = useState<typeof data>(null);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setForm(data.profile);
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!form) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch("/api/account/profile", { method: "PATCH", body: form });
      await refresh();
      toast("Profile saved.");
    } catch (err) {
      setSaveError(err as ApiClientError);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwError(null);
    try {
      await apiFetch("/api/account/password", { body: pw });
      setPw({ currentPassword: "", newPassword: "" });
      toast("Password changed. Other devices have been signed out.");
    } catch (err) {
      setPwError(err as ApiClientError);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card title="Profile">
        <form onSubmit={save} className="space-y-4">
          {saveError && <Alert tone="error">{saveError.message}</Alert>}
          <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
          {isOwner ? (
            <Input label="Email (sign-in)" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} />
          ) : (
            <Input
              label="Email"
              value={form.email}
              disabled
              hint={isStaff ? "Ask the owner to change your sign-in email." : "Contact the salon to change your sign-in email."}
            />
          )}
          <Input label="Mobile number" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!isStaff && (
            <>
              <Textarea label="Service preferences" rows={3} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} maxLength={1000} hint="e.g. preferred stylist, hair type, allergies" />
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone">Booking updates</legend>
                <Checkbox label="Email" checked={form.notificationPrefs.email} onChange={(e) => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, email: e.target.checked } })} />
                <Checkbox label="SMS" checked={form.notificationPrefs.sms} onChange={(e) => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, sms: e.target.checked } })} />
                <Checkbox label="WhatsApp" checked={form.notificationPrefs.whatsapp} onChange={(e) => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, whatsapp: e.target.checked } })} />
              </fieldset>
              <Checkbox label="Send me occasional offers" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />
            </>
          )}
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </form>
      </Card>
      <Card title="Change password">
        <form onSubmit={changePassword} className="space-y-4">
          {pwError && <Alert tone="error">{pwError.message}</Alert>}
          <Input label="Current password" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 8 characters with letters and numbers" />
          <Button type="submit" variant="secondary" loading={pwBusy}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
