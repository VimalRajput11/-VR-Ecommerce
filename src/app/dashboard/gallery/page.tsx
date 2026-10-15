"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import SafeImage from "@/components/site/SafeImage";
import { Alert, Button, Card, Checkbox, EmptyState, ErrorState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { GALLERY_CATEGORIES } from "@/lib/constants";

interface Img {
  id: string;
  url: string;
  alt: string;
  caption: string;
  category: string;
  active: boolean;
  order: number;
}

export default function GalleryAdminPage() {
  return (
    <RequirePermission any={["gallery.manage"]}>
      <GalleryAdmin />
    </RequirePermission>
  );
}

function GalleryAdmin() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ images: Img[] }>("/api/admin/gallery");
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ alt: "", caption: "", category: GALLERY_CATEGORIES[0] as string });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiClientError | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", f.alt);
      form.set("caption", f.caption);
      form.set("category", f.category);
      await apiFetch("/api/admin/gallery", { form });
      toast("Image uploaded.");
      setFile(null);
      setF({ ...f, alt: "", caption: "" });
      setConsent(false);
      reload();
    } catch (e) {
      setErr(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  async function patch(img: Img, body: Record<string, unknown>) {
    await apiFetch(`/api/admin/gallery/${img.id}`, { method: "PATCH", body });
    reload();
  }
  async function remove(img: Img) {
    if (!confirm("Delete this image from the gallery?")) return;
    await apiFetch(`/api/admin/gallery/${img.id}`, { method: "DELETE" });
    toast("Image deleted.");
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gallery" description="Photos of your salon's work, shown on the website Gallery page." />
      <Card title="Upload a photo">
        {err && <Alert tone="error" className="mb-3">{err.message}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone" htmlFor="gallery-file">
              Image (JPEG, PNG or WebP, max 4 MB)
            </label>
            <input id="gallery-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </div>
          <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Input label="Description (alt text)" required value={f.alt} onChange={(e) => setF({ ...f, alt: e.target.value })} hint="Describe the photo for screen readers, e.g. “Layered bob haircut with soft waves”" />
          <Input label="Caption (optional)" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} />
        </div>
        <Checkbox className="mt-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} label="I confirm the salon owns this photo and has the client's permission to publish it." />
        <Button className="mt-4" onClick={upload} loading={busy} disabled={!file || !f.alt || !consent}>
          Upload
        </Button>
      </Card>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.images.length ? (
        <EmptyState title="No photos yet">Uploaded photos will appear on the public Gallery page.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.images.map((img) => (
            <div key={img.id} className={`overflow-hidden rounded-lg border border-beige bg-white ${img.active ? "" : "opacity-60"}`}>
              <div className="relative aspect-square bg-cream">
                <SafeImage src={img.url} alt={img.alt} fill sizes="25vw" className="object-cover" />
              </div>
              <div className="space-y-2 p-3 text-sm">
                <p className="truncate">{img.alt}</p>
                <Select label="Category" value={img.category} onChange={(e) => patch(img, { category: e.target.value })}>
                  {GALLERY_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => patch(img, { active: !img.active })}>
                    {img.active ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(img)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
