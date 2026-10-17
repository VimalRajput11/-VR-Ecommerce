"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission, useFeatures } from "@/components/dashboard/DashboardShell";
import { Alert, Badge, Button, Card, Checkbox, ErrorState, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { formatDuration } from "@/lib/format";
import { SERVICE_AUDIENCES } from "@/lib/constants";

interface Svc {
  id: string;
  name: string;
  categoryId: string;
  kind: string;
  audience: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  priceFrom: boolean;
  priceVerified: boolean;
  taxable: boolean;
  includes: string[];
  eligibleStaff: string[];
  consumes: { productId: string; qty: number }[];
  image: string;
  featured: boolean;
  onlineBooking: boolean;
  active: boolean;
  archived: boolean;
  order: number;
}
interface Cat {
  id: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
}

export default function ServicesAdminPage() {
  return (
    <RequirePermission any={["services.manage"]}>
      <ServicesAdmin />
    </RequirePermission>
  );
}

function ServicesAdmin() {
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, loading, reload } = useApi<{ services: Svc[]; categories: Cat[] }>(`/api/admin/services${showArchived ? "?archived=1" : ""}`);
  const [editing, setEditing] = useState<Svc | "new" | null>(null);
  const [catEditing, setCatEditing] = useState<Cat | "new" | null>(null);

  const unverified = data?.services.filter((s) => !s.priceVerified && s.active && !s.archived).length ?? 0;

  async function quick(s: Svc, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/admin/services/${s.id}`, { method: "PATCH", body });
      toast(msg);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Services & prices"
        description="Add, edit or archive services. Unverified prices are hidden from the public website."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCatEditing("new")}>
              Add category
            </Button>
            <Button onClick={() => setEditing("new")}>Add service</Button>
          </>
        }
      />
      {unverified > 0 && (
        <Alert tone="warning" className="mb-4">
          <strong>{unverified} active services have unverified (sample) prices.</strong> Check each price and tick &ldquo;Price verified&rdquo; before launch — until then the website shows &ldquo;price at salon&rdquo;.
        </Alert>
      )}
      <Checkbox label="Show archived services" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="mb-4" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          {data.categories.map((c) => {
            const items = data.services.filter((s) => s.categoryId === c.id);
            return (
              <Card
                key={c.id}
                title={
                  <span>
                    {c.name} {!c.active && <Badge className="ml-2 bg-cream text-stone">Hidden</Badge>}
                  </span>
                }
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setCatEditing(c)}>
                    Edit category
                  </Button>
                }
              >
                {items.length === 0 ? (
                  <p className="text-sm text-stone">No services in this category.</p>
                ) : (
                  <ul className="divide-y divide-beige">
                    {items.map((s) => (
                      // Phones: name/badges on top, price + actions on their own row. Wider screens: one row.
                      <li key={s.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-3">
                        <button type="button" className="min-w-0 text-left md:flex-1" onClick={() => setEditing(s)}>
                          <span className="block font-medium hover:underline">{s.name}</span>
                          {(s.kind !== "service" || !s.active || s.archived || !s.onlineBooking || s.featured) && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {s.kind !== "service" && <Badge>{s.kind}</Badge>}
                              {!s.active && <Badge className="bg-[#f3eeea] text-stone">Inactive</Badge>}
                              {s.archived && <Badge className="bg-[#f3eeea] text-stone">Archived</Badge>}
                              {!s.onlineBooking && <Badge>Not bookable online</Badge>}
                              {s.featured && <Badge className="bg-[#f6efe4] text-gold-deep">Featured</Badge>}
                            </span>
                          )}
                          <span className="mt-0.5 block text-xs text-stone">
                            {formatDuration(s.durationMin)}
                            {s.bufferMin ? ` + ${s.bufferMin} min buffer` : ""} · {s.audience}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:gap-3">
                          <span className="mr-auto text-sm font-medium md:mr-0">
                            {s.priceFrom ? "from " : ""}
                            {formatINR(s.price)}
                          </span>
                          {s.priceVerified ? (
                            <Badge className="bg-[#eef5ef] text-success">Price verified</Badge>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => quick(s, { priceVerified: true }, `${s.name}: price verified`)}>
                              <AlertTriangle size={14} className="text-warning" aria-hidden /> Verify price
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => quick(s, { active: !s.active }, s.active ? "Deactivated" : "Activated")}>
                            {s.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
          {data.categories.length === 0 && <p className="text-stone">Create a category first, then add services.</p>}
        </div>
      ) : null}
      {editing && data && <ServiceModal service={editing === "new" ? null : editing} categories={data.categories} all={data.services} onClose={() => setEditing(null)} onSaved={reload} />}
      {catEditing && <CategoryModal category={catEditing === "new" ? null : catEditing} onClose={() => setCatEditing(null)} onSaved={reload} />}
    </div>
  );
}

function ServiceModal({ service, categories, all, onClose, onSaved }: { service: Svc | null; categories: Cat[]; all: Svc[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const features = useFeatures();
  const staff = useApi<{ staff: { id: string; name: string; bookable: boolean }[] }>("/api/admin/staff");
  const products = useApi<{ products: { id: string; name: string; unit: string }[] }>(features.inventory ? "/api/admin/products" : null);
  const [f, setF] = useState(() => ({
    name: service?.name ?? "",
    categoryId: service?.categoryId ?? categories[0]?.id ?? "",
    kind: service?.kind ?? "service",
    audience: service?.audience ?? "unisex",
    description: service?.description ?? "",
    durationMin: String(service?.durationMin ?? 30),
    bufferMin: String(service?.bufferMin ?? 0),
    price: service ? String(paiseToRupees(service.price)) : "",
    priceFrom: service?.priceFrom ?? false,
    priceVerified: service?.priceVerified ?? true,
    taxable: service?.taxable ?? true,
    featured: service?.featured ?? false,
    onlineBooking: service?.onlineBooking ?? true,
    active: service?.active ?? true,
    image: service?.image ?? "",
    order: String(service?.order ?? 0),
    eligibleStaff: service?.eligibleStaff ?? [],
    includes: service?.includes ?? [],
    consumes: service?.consumes ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "services");
      const res = await apiFetch<{ url: string }>("/api/admin/gallery", { form });
      setF((cur) => ({ ...cur, image: res.url }));
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      ...f,
      durationMin: Number(f.durationMin),
      bufferMin: Number(f.bufferMin),
      price: rupeesToPaise(Number(f.price)),
      order: Number(f.order),
      ...(service?.archived && f.active ? { archived: false } : {}),
    };
    try {
      if (service) await apiFetch(`/api/admin/services/${service.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/services", { body });
      toast("Service saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!service || !confirm(`Archive ${service.name}? It will be hidden everywhere but kept for past records.`)) return;
    await apiFetch(`/api/admin/services/${service.id}`, { method: "DELETE" });
    toast("Service archived.");
    onSaved();
    onClose();
  }

  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={service ? `Edit ${service.name}` : "Add service"}
      size="lg"
      footer={
        <>
          {service && !service.archived && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={archive}>
              Archive
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} wrapClassName="sm:col-span-2" />
        <Select label="Category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="service">Service</option>
          <option value="package">Package</option>
          <option value="addon">Add-on</option>
        </Select>
        <Input label="Price (₹)" type="number" min={0} step="0.01" required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <Select label="For" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
          {SERVICE_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {a[0].toUpperCase() + a.slice(1)}
            </option>
          ))}
        </Select>
        <Input label="Duration (minutes)" type="number" min={5} max={720} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
        <Input label="Buffer after (minutes)" type="number" min={0} max={120} value={f.bufferMin} onChange={(e) => setF({ ...f, bufferMin: e.target.value })} hint="Clean-up time before the next client" />
        <Textarea label="Description" rows={3} wrapClassName="sm:col-span-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={1500} />
        <div className="space-y-2 sm:col-span-2">
          <Checkbox label="Price verified by owner (shown on website)" checked={f.priceVerified} onChange={(e) => setF({ ...f, priceVerified: e.target.checked })} />
          <Checkbox label="Show as “from” price (varies by length/area)" checked={f.priceFrom} onChange={(e) => setF({ ...f, priceFrom: e.target.checked })} />
          <Checkbox label="Taxable" checked={f.taxable} onChange={(e) => setF({ ...f, taxable: e.target.checked })} />
          <Checkbox label="Bookable online" checked={f.onlineBooking} onChange={(e) => setF({ ...f, onlineBooking: e.target.checked })} />
          <Checkbox label="Featured on homepage" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} />
          <Checkbox label="Active" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        </div>
        <div className="sm:col-span-2">
          <Input label="Image URL" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} hint="https:// link, or upload below. Leave empty to use the category image." />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-gold-deep">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <span className="underline">{uploading ? "Uploading…" : "Upload image (JPEG/PNG/WebP, max 4 MB)"}</span>
          </label>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Stylists who perform this (none ticked = everyone bookable)</legend>
          <div className="flex flex-wrap gap-3">
            {(staff.data?.staff ?? []).filter((s) => s.bookable).map((s) => (
              <Checkbox key={s.id} label={s.name} checked={f.eligibleStaff.includes(s.id)} onChange={() => setF({ ...f, eligibleStaff: toggleIn(f.eligibleStaff, s.id) })} />
            ))}
          </div>
        </fieldset>
        {f.kind === "package" && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Package includes</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {all.filter((s) => s.kind === "service" && !s.archived && s.id !== service?.id).map((s) => (
                <Checkbox key={s.id} label={s.name} checked={f.includes.includes(s.id)} onChange={() => setF({ ...f, includes: toggleIn(f.includes, s.id) })} />
              ))}
            </div>
          </fieldset>
        )}
        {features.inventory && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Products used per service (stock is deducted on completion)</legend>
            {f.consumes.map((c, i) => (
              <div key={i} className="mb-2 flex items-end gap-2">
                <Select label="Product" wrapClassName="flex-1" value={c.productId} onChange={(e) => setF({ ...f, consumes: f.consumes.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)) })}>
                  <option value="">Choose…</option>
                  {(products.data?.products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </Select>
                <Input label="Qty" type="number" min={0} step="0.1" wrapClassName="w-24" value={c.qty} onChange={(e) => setF({ ...f, consumes: f.consumes.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)) })} />
                <Button variant="ghost" onClick={() => setF({ ...f, consumes: f.consumes.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, consumes: [...f.consumes.filter((c) => c.productId), { productId: "", qty: 1 }] })}>
              + Product
            </Button>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category: Cat | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: category?.name ?? "", description: category?.description ?? "", order: String(category?.order ?? 0), active: category?.active ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, order: Number(f.order) };
      if (category) await apiFetch(`/api/admin/categories/${category.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/categories", { body });
      toast("Category saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!category || !confirm(`Delete category ${category.name}?`)) return;
    try {
      await apiFetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      toast("Category deleted.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Edit category" : "Add category"}
      size="sm"
      footer={
        <>
          {category && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={remove}>
              Delete
            </Button>
          )}
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
      <div className="space-y-3">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Textarea label="Description" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Input label="Display order" type="number" min={0} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} />
        {category && <Checkbox label="Visible on website" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />}
      </div>
    </Modal>
  );
}
