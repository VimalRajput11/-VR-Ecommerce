"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, FolderOpen, Gift, Package, Plus, Search, Wallet } from "lucide-react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useFeatures } from "@/components/dashboard/DashboardShell";
import { Alert, Button } from "@/components/ui";
import { formatDuration, formatPhone } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { dateKeyIST } from "@/lib/time";
import { emptyBill, fromWire, itemCount, newKey, toWire, type BillCustomer, type BillState, type CatalogProduct, type CatalogService, type CustomerSummary, type Quote, type StaffOption } from "./bill";
import CustomerPanel, { AddCustomerModal } from "./CustomerPanel";
import ServiceWorkspace from "./ServiceWorkspace";
import InvoiceSummary from "./InvoiceSummary";
import PaymentModal from "./PaymentModal";
import SuggestInput from "./SuggestInput";
import { AdvancePanel, CardsPanel, MembershipsPanel, OpenInvoicesPanel, PackagesPanel, type OpenDraft } from "./ToolbarPanels";
import type { StaffAppointment } from "@/components/dashboard/types";

const STORE_KEY = "vg-pos-bill";
type Panel = "cards" | "advance" | "packages" | "memberships" | "open" | null;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Restores an unsaved bill after a reload (per browser tab), unless a draft/appointment is being opened. */
function restore(today: string, skip: boolean): { bill: BillState; draft: DraftRef | null } {
  if (!skip && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { bill: BillState; draft: DraftRef | null };
        if (saved?.bill) return { bill: { ...emptyBill(today), ...saved.bill }, draft: saved.draft ?? null };
      }
    } catch {
      // Storage unavailable or corrupt: start fresh.
    }
  }
  return { bill: emptyBill(today), draft: null };
}

interface DraftRef {
  id: string;
  number: string;
  version: number;
}

/** Salon point-of-sale: customer (left), services (centre), invoice (right). */
export default function BillingPOS() {
  const router = useRouter();
  const params = useSearchParams();
  const appointmentParam = params.get("appointment");
  const draftParam = params.get("draft");
  const { user, can } = useAuth();
  const features = useFeatures();
  const toast = useToast();
  const confirm = useConfirm();
  const [today] = useState(() => dateKeyIST());

  const [initial] = useState(() => restore(today, !!appointmentParam || !!draftParam));
  const [bill, setBillState] = useState<BillState>(() => (appointmentParam ? { ...emptyBill(today), appointmentId: appointmentParam } : initial.bill));
  const [draft, setDraft] = useState<DraftRef | null>(initial.draft);
  const [dirty, setDirty] = useState(itemCount(initial.bill) > 0 && !initial.draft);
  const setBill = (fn: (b: BillState) => BillState) => {
    setBillState(fn);
    setDirty(true);
  };

  // Catalogue, staff and open bills.
  const catalog = useApi<{ services: CatalogService[]; categories: { id: string; name: string }[] }>("/api/admin/services");
  const products = useApi<{ products: CatalogProduct[] }>(features.retail ? "/api/admin/products?retail=1" : null);
  const staff = useApi<{ staff: StaffOption[] }>("/api/admin/staff");
  const open = useApi<{ drafts: OpenDraft[]; unpaid: { id: string; number: string; customer?: { name?: string }; total: number; balanceDue: number; status: string; issuedAt: string }[]; openCount: number }>(
    "/api/admin/billing/drafts",
  );

  // Opening a saved bill (?draft=) or billing an appointment (?appointment=).
  const draftApi = useApi<{ draft: OpenDraft & { status: string } }>(draftParam ? `/api/admin/billing/drafts/${draftParam}` : null);
  const [loadedDraft, setLoadedDraft] = useState<unknown>(null);
  if (draftApi.data && draftApi.data !== loadedDraft) {
    setLoadedDraft(draftApi.data);
    const d = draftApi.data.draft;
    setBillState(fromWire(d.payload, today));
    setDraft({ id: d.id, number: d.number, version: d.version });
    setDirty(false);
  }
  const appt = useApi<{ appointment: StaffAppointment }>(appointmentParam ? `/api/admin/appointments/${appointmentParam}` : null);
  const [loadedAppt, setLoadedAppt] = useState<unknown>(null);
  if (appt.data && appt.data !== loadedAppt) {
    setLoadedAppt(appt.data);
    const a = appt.data.appointment;
    setBillState((b) => ({ ...b, appointmentId: a.id, customer: { id: a.customerId, name: a.customer.name, phone: a.customer.phone ?? "", email: a.customer.email ?? "" } }));
  }

  // Customer search (mobile or name) and the selected customer's details.
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const hits = useApi<{ items: { id: string; name: string; phone: string; email: string; isGuest: boolean }[] }>(
    can("customers.view") && q.length >= 3 ? `/api/admin/customers${qs({ q, limit: 8 })}` : null,
  );
  const summary = useApi<{ customer: CustomerSummary }>(bill.customer?.id && can("customers.view") ? `/api/admin/billing/customer/${bill.customer.id}` : null);
  const customerSummary = summary.data?.customer.id === bill.customer?.id ? (summary.data?.customer ?? null) : null;

  // Live price check: the server's own calculation, a moment after each change.
  const wire = useMemo(() => JSON.stringify(toWire(bill)), [bill]);
  const debouncedWire = useDebounced(wire, 350);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const quoteSeq = useRef(0);
  const hasItems = itemCount(bill) > 0;
  useEffect(() => {
    const seq = ++quoteSeq.current;
    if (!hasItems) {
      const t = setTimeout(() => {
        setQuote(null);
        setQuoteError(null);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setQuoting(true);
      apiFetch<Quote>("/api/admin/billing/quote", { body: JSON.parse(debouncedWire) })
        .then((res) => {
          if (seq !== quoteSeq.current) return;
          setQuote(res);
          setQuoteError(null);
        })
        .catch((e: ApiClientError) => {
          if (seq === quoteSeq.current) setQuoteError(e.message);
        })
        .finally(() => {
          if (seq === quoteSeq.current) setQuoting(false);
        });
    }, 0);
    return () => clearTimeout(t);
  }, [debouncedWire, hasItems]);

  // Keep unsaved work if the page is reloaded (this browser tab only).
  useEffect(() => {
    try {
      if (itemCount(bill) || bill.customer) sessionStorage.setItem(STORE_KEY, JSON.stringify({ bill, draft }));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {
      // Private mode / storage full: nothing to keep.
    }
  }, [bill, draft]);

  const [serviceSearch, setServiceSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [addCustomer, setAddCustomer] = useState(false);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const serviceInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);

  // "/" jumps to service search, like most POS screens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        serviceInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const services = catalog.data?.services ?? [];
  const categoryName = (id: string) => catalog.data?.categories.find((c) => c.id === id)?.name ?? "";
  // Suggestions under the search boxes: name or category matches, best (name-start) first.
  const sq = serviceSearch.trim().toLowerCase();
  const serviceSuggestions = sq
    ? services
        .filter((x) => x.active && !x.archived && (x.name.toLowerCase().includes(sq) || categoryName(x.categoryId).toLowerCase().includes(sq)))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(sq)) - Number(!b.name.toLowerCase().startsWith(sq)))
        .map((x) => ({
          id: x.id,
          title: x.name,
          subtitle: `${x.priceFrom ? "from " : ""}${formatINR(x.price)} · ${formatDuration(x.durationMin)} · ${x.kind === "package" ? "Package" : categoryName(x.categoryId)}`,
        }))
    : [];
  const pqs = productSearch.trim().toLowerCase();
  const productSuggestions = pqs
    ? (products.data?.products ?? [])
        .filter((x) => x.name.toLowerCase().includes(pqs))
        .map((x) => ({ id: x.id, title: x.name, subtitle: `${formatINR(x.sellingPrice)} · ${x.quantity} ${x.unit} in stock`, disabled: x.quantity <= 0 }))
    : [];

  const chooseCustomer = (c: BillCustomer | null) => {
    setBill((b) => ({ ...b, customer: c }));
    setSearch("");
  };

  function reset() {
    setBillState(emptyBill(today));
    setDraft(null);
    setDirty(false);
    setQuote(null);
    setSelectedId(null);
    setSaveError(null);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      // ignore
    }
    if (appointmentParam || draftParam) router.replace("/dashboard/billing/new");
  }

  async function discard() {
    if (dirty || hasItems) {
      const ok = await confirm({
        title: draft ? `Discard changes to ${draft.number}?` : "Discard this bill?",
        danger: true,
        confirmLabel: "Discard",
        message: <p>{draft ? "Your unsaved changes will be lost. The saved bill stays in Open invoices." : "Everything on this bill will be cleared. Nothing has been saved or charged."}</p>,
      });
      if (!ok) return;
    }
    reset();
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const body = toWire(bill);
      const res = draft
        ? await apiFetch<{ draft: OpenDraft }>(`/api/admin/billing/drafts/${draft.id}`, { method: "PUT", body: { ...body, version: draft.version } })
        : await apiFetch<{ draft: OpenDraft }>("/api/admin/billing/drafts", { body });
      setDraft({ id: res.draft.id, number: res.draft.number, version: res.draft.version });
      setDirty(false);
      toast(`Saved as ${res.draft.number}.`);
      open.reload();
    } catch (e) {
      setSaveError((e as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  }

  async function openDraft(d: OpenDraft) {
    if ((dirty || hasItems) && d.id !== draft?.id) {
      const ok = await confirm({ title: `Open ${d.number}?`, confirmLabel: "Open saved bill", message: <p>Unsaved changes on the current bill will be lost.</p> });
      if (!ok) return;
    }
    setBillState(fromWire(d.payload, today));
    setDraft({ id: d.id, number: d.number, version: d.version });
    setDirty(false);
    setPanel(null);
  }

  const openCount = open.data?.openCount ?? 0;
  const toolBtn = "inline-flex items-center gap-1.5 rounded-md border border-beige bg-white px-3 py-2 text-sm hover:border-gold/60 hover:bg-cream/50";

  return (
    <div>
      {/* Compact heading so the toolbar sits near the top of the screen. */}
      <div className="mb-3 flex items-baseline gap-3">
        <h1 className="font-serif text-2xl text-charcoal md:text-3xl">Billing</h1>
        <span className="text-sm text-stone">{draft ? `Saved bill ${draft.number}` : "New bill"}</span>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-beige bg-white p-3">
        <div className="relative min-w-[240px] flex-[1.3_1_240px]">
          <div className="flex gap-1.5">
            <label className="relative block flex-1">
              <span className="sr-only">Customer mobile or name</span>
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone" aria-hidden />
              <input
                ref={phoneInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={bill.appointmentId ? "Appointment customer" : "Customer mobile or name"}
                disabled={!!bill.appointmentId}
                inputMode="search"
                autoComplete="off"
                className="w-full rounded-md border border-sand bg-white py-2 pl-8 pr-2 text-sm focus:border-gold focus:outline-none disabled:bg-cream"
              />
            </label>
            <Button variant="secondary" aria-label="Add customer" onClick={() => setAddCustomer(true)} disabled={!!bill.appointmentId}>
              <Plus size={16} />
            </Button>
          </div>
          {q.length >= 3 && search && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-beige bg-white shadow-lg">
              {hits.loading && !hits.data ? (
                <li className="px-3 py-2 text-sm text-stone">Searching…</li>
              ) : hits.data?.items.length ? (
                hits.data.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                      onClick={() => chooseCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email })}
                    >
                      <span className="font-medium">{c.name}</span> <span className="text-stone">· {formatPhone(c.phone) || "no mobile"}</span>
                      {c.isGuest && <span className="ml-1 text-xs text-stone">(guest)</span>}
                    </button>
                  </li>
                ))
              ) : (
                <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-stone">
                  No customer found.
                  <button type="button" className="text-gold-deep underline" onClick={() => setAddCustomer(true)}>
                    Add new
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
        <SuggestInput
          ref={serviceInput}
          label="Search services"
          placeholder="Search services  ( / )"
          value={serviceSearch}
          onChange={setServiceSearch}
          items={serviceSuggestions}
          onPick={(id) => {
            setSelectedId(id);
            setServiceSearch("");
          }}
          className="min-w-[200px] flex-[1_1_200px]"
        />
        {features.retail && (
          <SuggestInput
            label="Search products"
            placeholder="Search products"
            value={productSearch}
            onChange={setProductSearch}
            items={productSuggestions}
            onPick={(id) => {
              setBill((b) => {
                const existing = b.products.find((l) => l.productId === id);
                if (existing) return { ...b, products: b.products.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) };
                return { ...b, products: [...b.products, { key: newKey(), productId: id, qty: 1 }] };
              });
              setProductSearch("");
            }}
            className="min-w-[180px] flex-[1_1_180px]"
          />
        )}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={toolBtn} onClick={() => setPanel("cards")}>
            <Gift size={15} aria-hidden /> Cards
          </button>
          <button type="button" className={toolBtn} onClick={() => setPanel("advance")}>
            <Wallet size={15} aria-hidden /> Advance
          </button>
          <button type="button" className={toolBtn} onClick={() => setPanel("packages")}>
            <Package size={15} aria-hidden /> Packages
          </button>
          <button type="button" className={toolBtn} onClick={() => setPanel("memberships")}>
            <Crown size={15} aria-hidden /> Memberships
          </button>
          <button type="button" className={`${toolBtn} font-medium`} onClick={() => setPanel("open")}>
            <FolderOpen size={15} aria-hidden /> Open invoices
            <span className={`ml-0.5 rounded-full px-2 py-0.5 text-xs ${openCount ? "bg-charcoal text-ivory" : "bg-cream text-stone"}`}>{openCount}</span>
          </button>
        </div>
      </div>

      {(catalog.error || staff.error) && <Alert tone="error" className="mb-4">{(catalog.error ?? staff.error)!.message}</Alert>}
      {saveError && <Alert tone="error" className="mb-4">{saveError}</Alert>}

      {/* Workspace: customer | services | invoice */}
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_370px]">
        <div className="lg:row-span-2 2xl:row-span-1">
          <CustomerPanel
            customer={bill.customer}
            summary={customerSummary}
            loading={summary.loading}
            locked={!!bill.appointmentId}
            onChange={chooseCustomer}
            onAddCustomer={() => setAddCustomer(true)}
          />
        </div>
        <ServiceWorkspace
          bill={bill}
          setBill={setBill}
          services={services}
          products={products.data?.products ?? []}
          staff={staff.data?.staff ?? []}
          quote={quote}
          membership={customerSummary?.membership ?? null}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
        />
        <div className="2xl:sticky 2xl:top-4 2xl:self-start">
          <InvoiceSummary
            bill={bill}
            setBill={setBill}
            quote={hasItems ? quote : null}
            quoting={quoting}
            quoteError={hasItems ? quoteError : null}
            canDiscount={can("billing.discount")}
            loyaltyEnabled={features.loyalty}
            today={today}
            dirty={dirty}
            draftNumber={draft?.number ?? null}
            saving={saving}
            onDiscard={discard}
            onSave={save}
            onFinalize={() => setPaying(true)}
          />
        </div>
      </div>

      {addCustomer && (
        <AddCustomerModal
          initialPhone={/^\+?[\d\s-]{6,}$/.test(search) ? search : undefined}
          onClose={() => setAddCustomer(false)}
          onCreated={(c) => {
            chooseCustomer(c);
            setAddCustomer(false);
          }}
        />
      )}
      {panel === "cards" && <CardsPanel customer={bill.customer} canIssue={can("offers.manage")} onClose={() => setPanel(null)} onSell={(amount) => setBill((b) => ({ ...b, giftCards: [...b.giftCards, { key: newKey(), amount }] }))} />}
      {panel === "advance" && (
        <AdvancePanel
          customer={bill.customer}
          summary={customerSummary}
          canRefund={can("billing.refund")}
          onClose={() => setPanel(null)}
          onDeposit={(amount) => setBill((b) => ({ ...b, advances: [...b.advances, { key: newKey(), amount }] }))}
          onChanged={summary.reload}
        />
      )}
      {panel === "packages" && (
        <PackagesPanel
          services={services}
          onClose={() => setPanel(null)}
          onPick={(id) => setSelectedId(id)}
        />
      )}
      {panel === "memberships" && (
        <MembershipsPanel
          summary={customerSummary}
          customer={bill.customer}
          canManage={can("offers.manage")}
          onClose={() => setPanel(null)}
          onSell={(p) => setBill((b) => ({ ...b, memberships: [...b.memberships, { key: newKey(), planId: p.id }] }))}
        />
      )}
      {panel === "open" && (
        <OpenInvoicesPanel data={open.data ?? null} loading={open.loading} currentDraftId={draft?.id ?? null} onClose={() => setPanel(null)} onOpen={openDraft} onDiscarded={open.reload} />
      )}
      {paying && quote && (
        <PaymentModal
          bill={bill}
          quote={quote}
          draftId={draft?.id ?? null}
          advanceBalance={customerSummary?.advanceBalance ?? 0}
          onClose={() => setPaying(false)}
          onDone={() => {
            setPaying(false);
            reset();
            open.reload();
          }}
        />
      )}
      {user && !can("billing.manage") && <Alert tone="info">You can view bills but not create them.</Alert>}
    </div>
  );
}
