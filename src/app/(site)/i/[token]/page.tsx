"use client";

import { use } from "react";
import { Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import InvoiceView, { type InvoiceBusiness, type InvoiceData } from "@/components/billing/InvoiceView";
import { Button, ButtonLink, ErrorState, Spinner } from "@/components/ui";

/** Invoice opened from the link in the WhatsApp message. No sign-in needed; the link itself is the key. */
export default function SharedInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, error, loading, reload } = useApi<{ invoice: InvoiceData; business: InvoiceBusiness }>(`/api/public/invoices/${encodeURIComponent(token)}`);

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-gold-deep">Your invoice</p>
        <div className="flex gap-2">
          <ButtonLink href="/book" size="sm">
            Book your next visit
          </ButtonLink>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> Print / save PDF
          </Button>
        </div>
      </div>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : data ? <InvoiceView invoice={data.invoice} business={data.business} /> : null}
    </div>
  );
}
