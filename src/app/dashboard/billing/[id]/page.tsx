"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer, Receipt } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import InvoiceView, { type InvoiceBusiness, type InvoiceData } from "@/components/billing/InvoiceView";
import WhatsAppInvoiceCard from "@/components/billing/WhatsAppInvoiceCard";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Button, Card, ErrorState, Input, Select, Spinner } from "@/components/ui";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";

interface Resp {
  invoice: InvoiceData;
  business: InvoiceBusiness;
  paymentMethods: { cash: boolean; upi: boolean; card: boolean; upiId: string };
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequirePermission any={["billing.manage", "reports.view"]}>
      <InvoiceDetail id={id} />
    </RequirePermission>
  );
}

function InvoiceDetail({ id }: { id: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, loading, setData, reload } = useApi<Resp>(`/api/admin/invoices/${id}`);
  const [pay, setPay] = useState({ amount: "", method: "", reference: "" });
  const [refund, setRefund] = useState({ amount: "", method: "cash", reason: "" });
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiClientError | null>(null);
  const [printMode, setPrintMode] = useState<"a4" | "thermal">("a4");
  const autoPrinted = useRef(false);

  // Print in the chosen layout once the copy for printing has rendered.
  function printAs(mode: "a4" | "thermal") {
    setPrintMode(mode);
    setTimeout(() => window.print(), 150);
  }

  // ?print=1 / ?print=thermal (from the billing screen's receipt buttons) prints once the invoice loads.
  useEffect(() => {
    if (!data || autoPrinted.current) return;
    const p = new URLSearchParams(window.location.search).get("print");
    if (!p) return;
    autoPrinted.current = true;
    const t = setTimeout(() => {
      setPrintMode(p === "thermal" ? "thermal" : "a4");
      setTimeout(() => window.print(), 400);
    }, 0);
    return () => clearTimeout(t);
  }, [data]);

  async function act(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setActionError(null);
    try {
      const res = await apiFetch<Resp>(`/api/admin/invoices/${id}`, { body });
      setData(res);
      toast(label);
      setPay({ amount: "", method: "", reference: "" });
      setRefund({ amount: "", method: "cash", reason: "" });
    } catch (e) {
      setActionError(e as ApiClientError);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const inv = data.invoice;
  const methods = (["cash", "upi", "card"] as const).filter((m) => data.paymentMethods[m]);
  const method = pay.method || methods[0] || "";
  const netPaid = inv.amountPaid - inv.amountRefunded;

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/billing" className="inline-flex items-center gap-1 text-sm text-stone hover:text-charcoal">
          <ChevronLeft size={16} aria-hidden /> All invoices
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => printAs("a4")}>
            <Printer size={16} aria-hidden /> Print / save PDF
          </Button>
          <Button variant="secondary" onClick={() => printAs("thermal")}>
            <Receipt size={16} aria-hidden /> Thermal receipt
          </Button>
        </div>
      </div>
      {actionError && <Alert tone="error" className="no-print mb-4">{actionError.message}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <InvoiceView invoice={inv} business={data.business} printMode={printMode} />
        {can("billing.manage") && inv.status !== "void" && (
          <div className="no-print space-y-6">
            <WhatsAppInvoiceCard invoiceId={inv.id} />
            {inv.balanceDue > 0 && (
              <Card title="Record payment">
                {methods.length === 0 ? (
                  <p className="text-sm text-stone">No in-salon payment methods are enabled. Enable them in Settings.</p>
                ) : (
                  <div className="space-y-3">
                    <Input
                      label="Amount (₹)"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={String(paiseToRupees(inv.balanceDue))}
                      value={pay.amount}
                      onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                      hint={`Balance due ${formatINR(inv.balanceDue)}`}
                    />
                    <Select label="Method" value={method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {m === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1)}
                        </option>
                      ))}
                    </Select>
                    {method === "upi" && data.paymentMethods.upiId && <p className="text-xs text-stone">Salon UPI ID: {data.paymentMethods.upiId}</p>}
                    {method !== "cash" && <Input label="Reference (UTR / last 4 digits)" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />}
                    <Button
                      className="w-full"
                      loading={busy === "Payment recorded"}
                      onClick={() => act({ action: "payment", amount: pay.amount ? rupeesToPaise(Number(pay.amount)) : inv.balanceDue, method, reference: pay.reference || undefined }, "Payment recorded")}
                    >
                      Record {pay.amount ? formatINR(rupeesToPaise(Number(pay.amount))) : formatINR(inv.balanceDue)}
                    </Button>
                  </div>
                )}
              </Card>
            )}
            {can("billing.refund") && netPaid > 0 && (
              <Card title="Refund">
                <div className="space-y-3">
                  <Input label="Amount (₹)" type="number" min={0} step="0.01" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} hint={`Up to ${formatINR(netPaid)}`} />
                  <Select label="Refunded via" value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="online">Online (processed in gateway)</option>
                    <option value="advance">Customer&apos;s advance balance</option>
                  </Select>
                  <Input label="Reason" required value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
                  <Button
                    variant="danger"
                    className="w-full"
                    disabled={!refund.amount || !refund.reason}
                    loading={busy === "Refund recorded"}
                    onClick={() => act({ action: "refund", amount: rupeesToPaise(Number(refund.amount)), method: refund.method, reason: refund.reason }, "Refund recorded")}
                  >
                    Record refund
                  </Button>
                  <p className="text-xs text-stone">Online refunds must also be issued in the payment gateway dashboard.</p>
                </div>
              </Card>
            )}
            {can("billing.refund") && inv.amountPaid === 0 && (
              <Card title="Void invoice">
                <Input label="Reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                <Button variant="danger" className="mt-3 w-full" disabled={!voidReason} loading={busy === "Invoice voided"} onClick={() => act({ action: "void", reason: voidReason }, "Invoice voided")}>
                  Void invoice
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
