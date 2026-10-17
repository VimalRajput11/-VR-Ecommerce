"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFeatures, RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Button, Card, Input, PageHeader, Select, Spinner } from "@/components/ui";
import type { AdminService, StaffAppointment } from "@/components/dashboard/types";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { dateKeyIST } from "@/lib/time";
import { formatPhone } from "@/lib/format";

export default function NewBillPage() {
  return (
    <RequirePermission any={["billing.manage"]}>
      <Suspense>
        <NewBill />
      </Suspense>
    </RequirePermission>
  );
}

interface Product {
  id: string;
  name: string;
  sellingPrice: number;
  quantity: number;
  unit: string;
}

function NewBill() {
  const router = useRouter();
  const params = useSearchParams();
  const appointmentId = params.get("appointment");
  const { can } = useAuth();
  const features = useFeatures();
  const appt = useApi<{ appointment: StaffAppointment }>(appointmentId ? `/api/admin/appointments/${appointmentId}` : null);
  const services = useApi<{ services: AdminService[] }>("/api/admin/services");
  const products = useApi<{ products: Product[] }>(features.retail ? "/api/admin/products?retail=1" : null);

  const [customer, setCustomer] = useState({ id: "", name: "", phone: "", email: "" });
  const [search, setSearch] = useState("");
  const hits = useApi<{ items: { id: string; name: string; phone: string; email: string }[] }>(
    !appointmentId && can("customers.view") && search.trim().length >= 2 ? `/api/admin/customers${qs({ q: search, limit: 6 })}` : null,
  );
  const [svcLines, setSvcLines] = useState<{ serviceId: string; qty: number }[]>([]);
  const [prodLines, setProdLines] = useState<{ productId: string; qty: number }[]>([]);
  const [custom, setCustom] = useState<{ description: string; amount: string }[]>([]);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState({ type: "percent", value: "", reason: "" });
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [today] = useState(() => dateKeyIST());
  const [billDate, setBillDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const svcList = (services.data?.services ?? []).filter((s) => !s.archived);
  const prodList = products.data?.products ?? [];
  const base = appt.data?.appointment.items.reduce((s, i) => s + i.price, 0) ?? 0;
  const estimate =
    base +
    svcLines.reduce((s, l) => s + (svcList.find((x) => x.id === l.serviceId)?.price ?? 0) * l.qty, 0) +
    prodLines.reduce((s, l) => s + (prodList.find((x) => x.id === l.productId)?.sellingPrice ?? 0) * l.qty, 0) +
    custom.reduce((s, c) => s + (Number(c.amount) > 0 ? rupeesToPaise(Number(c.amount)) : 0), 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const dv = Number(discount.value);
      const res = await apiFetch<{ invoice: { id: string } }>("/api/admin/invoices", {
        body: {
          appointmentId: appointmentId || undefined,
          customer: appointmentId ? undefined : { id: customer.id || undefined, name: customer.name, phone: customer.phone, email: customer.email || undefined },
          services: svcLines.filter((l) => l.serviceId),
          products: prodLines.filter((l) => l.productId),
          customLines: custom.filter((c) => c.description && Number(c.amount) > 0).map((c) => ({ description: c.description, amount: rupeesToPaise(Number(c.amount)) })),
          couponCode: coupon || undefined,
          manualDiscount: dv > 0 ? { type: discount.type, value: discount.type === "percent" ? Math.round(dv) : rupeesToPaise(dv), reason: discount.reason } : undefined,
          loyaltyPoints: Number(points) > 0 ? Math.round(Number(points)) : undefined,
          notes: notes || undefined,
          billDate: billDate || undefined,
        },
      });
      router.push(`/dashboard/billing/${res.invoice.id}`);
    } catch (e) {
      setError(e as ApiClientError);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  if (appointmentId && appt.loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="New bill" description="Totals, discounts and tax are calculated by the server when the invoice is created." />
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      {appt.error && <Alert tone="error" className="mb-4">{appt.error.message}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Customer">
            {appt.data ? (
              <p>
                <span className="font-medium">{appt.data.appointment.customer.name}</span>
                {appt.data.appointment.customer.phone && <span className="text-stone"> · {formatPhone(appt.data.appointment.customer.phone)}</span>}
                <span className="block text-xs text-stone">Appointment {appt.data.appointment.ref}</span>
              </p>
            ) : (
              // Typing a name or mobile number also searches existing customers; picking one fills all fields.
              <div className="relative">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Name"
                    required
                    autoComplete="off"
                    value={customer.name}
                    onChange={(e) => {
                      setCustomer({ ...customer, name: e.target.value, id: "" });
                      setSearch(e.target.value);
                    }}
                  />
                  <Input
                    label="Mobile"
                    required
                    type="tel"
                    autoComplete="off"
                    value={customer.phone}
                    onChange={(e) => {
                      setCustomer({ ...customer, phone: e.target.value, id: "" });
                      setSearch(e.target.value);
                    }}
                  />
                  <Input label="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                </div>
                {search && !customer.id && hits.data?.items.length ? (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border border-beige bg-white shadow-lg sm:w-2/3">
                    <li className="px-3 pt-2 text-xs text-stone">Existing customers</li>
                    {hits.data.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                          onClick={() => {
                            setCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email });
                            setSearch("");
                          }}
                        >
                          {c.name} · {formatPhone(c.phone)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {customer.id && (
                  <p className="mt-2 text-xs text-success">
                    Existing customer selected.{" "}
                    <button type="button" className="text-stone underline hover:text-charcoal" onClick={() => setCustomer({ id: "", name: "", phone: "", email: "" })}>
                      Clear
                    </button>
                  </p>
                )}
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                label="Bill date"
                type="date"
                required
                max={today}
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                hint={billDate && billDate !== today ? "Entering a bill for an earlier day." : undefined}
              />
            </div>
          </Card>

          <Card title="Items">
            {appt.data && (
              <ul className="mb-4 divide-y divide-beige rounded-md border border-beige text-sm">
                {appt.data.appointment.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between px-3 py-2">
                    <span>{i.name}</span>
                    <span>{formatINR(i.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-3">
              {svcLines.map((l, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Select label="Service" wrapClassName="flex-1" value={l.serviceId} onChange={(e) => setSvcLines(svcLines.map((x, j) => (j === i ? { ...x, serviceId: e.target.value } : x)))}>
                    <option value="">Choose…</option>
                    {svcList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {formatINR(s.price)}
                      </option>
                    ))}
                  </Select>
                  <Input label="Qty" type="number" min={1} max={20} wrapClassName="w-20" value={l.qty} onChange={(e) => setSvcLines(svcLines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                  <Button variant="ghost" aria-label="Remove line" onClick={() => setSvcLines(svcLines.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {prodLines.map((l, i) => (
                <div key={`p${i}`} className="flex items-end gap-2">
                  <Select label="Product" wrapClassName="flex-1" value={l.productId} onChange={(e) => setProdLines(prodLines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}>
                    <option value="">Choose…</option>
                    {prodList.map((p) => (
                      <option key={p.id} value={p.id} disabled={features.inventory && p.quantity <= 0}>
                        {p.name} — {formatINR(p.sellingPrice)} ({p.quantity} {p.unit})
                      </option>
                    ))}
                  </Select>
                  <Input label="Qty" type="number" min={1} wrapClassName="w-20" value={l.qty} onChange={(e) => setProdLines(prodLines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                  <Button variant="ghost" aria-label="Remove line" onClick={() => setProdLines(prodLines.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {custom.map((c, i) => (
                <div key={`c${i}`} className="flex items-end gap-2">
                  <Input label="Description" wrapClassName="flex-1" value={c.description} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  <Input label="Amount (₹)" type="number" min={0} step="0.01" wrapClassName="w-32" value={c.amount} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                  <Button variant="ghost" aria-label="Remove line" onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSvcLines([...svcLines, { serviceId: "", qty: 1 }])}>
                + Service
              </Button>
              {features.retail && (
                <Button size="sm" variant="secondary" onClick={() => setProdLines([...prodLines, { productId: "", qty: 1 }])}>
                  + Product
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setCustom([...custom, { description: "", amount: "" }])}>
                + Custom item
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Discounts">
            <div className="space-y-3">
              <Input
                label="Coupon code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.replace(/\s+/g, ""))}
                className="uppercase"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={30}
              />
              {can("billing.discount") && (
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <Select label="Discount" value={discount.type} onChange={(e) => setDiscount({ ...discount, type: e.target.value })}>
                    <option value="percent">%</option>
                    <option value="flat">₹</option>
                  </Select>
                  <Input label="Value" type="number" min={0} value={discount.value} onChange={(e) => setDiscount({ ...discount, value: e.target.value })} />
                  <Input label="Reason" wrapClassName="col-span-2" value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} required={Number(discount.value) > 0} />
                </div>
              )}
              {features.loyalty && <Input label="Redeem loyalty points" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />}
              <Input label="Invoice note" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </Card>
          <Card title="Summary">
            <p className="flex justify-between text-sm">
              <span className="text-stone">Items (before discounts &amp; tax)</span>
              <span>{formatINR(estimate)}</span>
            </p>
            <p className="mt-2 text-xs text-stone">The final total, including discounts and tax, is calculated securely when you create the invoice.</p>
            <Button className="mt-4 w-full" size="lg" loading={busy} onClick={submit} disabled={!appointmentId && (!customer.name || !customer.phone)}>
              Create invoice
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
