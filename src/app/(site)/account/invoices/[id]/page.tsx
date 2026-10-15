"use client";

import { use, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { ChevronLeft, Printer } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import InvoiceView, { type InvoiceBusiness, type InvoiceData } from "@/components/billing/InvoiceView";
import { Alert, Button, ErrorState, Spinner } from "@/components/ui";
import { formatINR } from "@/lib/money";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

export default function AccountInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ invoice: InvoiceData; business: InvoiceBusiness }>(`/api/account/invoices/${id}`);
  const list = useApi<{ onlinePayments: boolean }>("/api/account/invoices");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<ApiClientError | null>(null);

  async function pay() {
    setPaying(true);
    setPayError(null);
    try {
      const order = await apiFetch<{ keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill: Record<string, string> }>(
        `/api/account/invoices/${id}/pay`,
        { method: "POST" },
      );
      if (!window.Razorpay) throw new ApiClientError("Payment window could not load. Please try again.", 0);
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        theme: { color: "#1b1a18" },
        handler: async (resp: Record<string, string>) => {
          try {
            const result = await apiFetch<{ applied: boolean; reason?: string }>("/api/payments/razorpay/verify", { body: resp });
            toast(result.applied ? "Payment received. Thank you!" : "Payment is being confirmed. This page will update shortly.");
          } catch (e) {
            setPayError(e as ApiClientError);
          } finally {
            reload();
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      setPayError(e as ApiClientError);
      setPaying(false);
    }
  }

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/account?tab=invoices" className="inline-flex items-center gap-1 text-sm text-stone hover:text-charcoal">
          <ChevronLeft size={16} aria-hidden /> Back to invoices
        </Link>
        <div className="flex gap-2">
          {data && data.invoice.balanceDue > 0 && list.data?.onlinePayments && (
            <Button onClick={pay} loading={paying}>
              Pay {formatINR(data.invoice.balanceDue)} online
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Print / save PDF
          </Button>
        </div>
      </div>
      {list.data?.onlinePayments && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />}
      {payError && <Alert tone="error" className="no-print mb-4">{payError.message}</Alert>}
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : data ? <InvoiceView invoice={data.invoice} business={data.business} /> : null}
    </div>
  );
}
