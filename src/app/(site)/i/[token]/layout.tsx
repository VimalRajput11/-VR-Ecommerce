// Private invoice links sent to customers on WhatsApp: never indexed or shown in search results.
export const metadata = { title: "Your invoice", robots: { index: false, follow: false } };

export default function SharedInvoiceLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">{children}</div>;
}
