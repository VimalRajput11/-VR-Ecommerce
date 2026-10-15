import { api, csvResponse } from "@/server/lib/http";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { parseRange } from "@/server/services/report-range";
import { Appointment, Invoice, Payment } from "@/server/models";
import { formatDate, formatDateTime } from "@/lib/time";
import { paiseToRupees } from "@/lib/money";
import { STATUS_LABELS, type AppointmentStatus } from "@/lib/constants";
import { staffNameMap } from "@/server/services/booking";
import { audit } from "@/server/services/audit";

const rs = (p: number) => paiseToRupees(p).toFixed(2);

export const GET = api(async (req) => {
  const user = await requirePermission("reports.view");
  const p = req.nextUrl.searchParams;
  const { from, to, range } = parseRange(p);
  const type = p.get("type");
  await audit(user, "report.export", "Report", type ?? "", `Exported ${type} ${from} to ${to}`);

  if (type === "invoices") {
    const rows = await Invoice.find({ issuedAt: { $gte: range.from, $lt: range.to } }).sort({ issuedAt: 1 }).limit(50_000).lean();
    return csvResponse(`vg-invoices-${from}-${to}.csv`, [
      ["Invoice", "Date", "Customer", "Phone", "Gross (INR)", "Discount (INR)", "Tax (INR)", "Total (INR)", "Paid (INR)", "Refunded (INR)", "Balance (INR)", "Status"],
      ...rows.map((i) => [i.number, formatDate(i.issuedAt), i.customer?.name, i.customer?.phone, rs(i.subtotal), rs(i.discountTotal), rs(i.tax?.amount ?? 0), rs(i.total), rs(i.amountPaid), rs(i.amountRefunded), rs(i.balanceDue), i.status]),
    ]);
  }
  if (type === "payments") {
    const rows = await Payment.find({ createdAt: { $gte: range.from, $lt: range.to } }).sort({ createdAt: 1 }).limit(50_000).lean();
    const invoices = new Map((await Invoice.find({ _id: { $in: rows.map((r) => r.invoiceId) } }).select("number").lean()).map((i) => [String(i._id), i.number]));
    return csvResponse(`vg-payments-${from}-${to}.csv`, [
      ["Date", "Invoice", "Type", "Method", "Amount (INR)", "Reference", "Note"],
      ...rows.map((r) => [formatDateTime(r.createdAt), invoices.get(String(r.invoiceId)) ?? "", r.kind, r.method, rs(r.kind === "refund" ? -r.amount : r.amount), r.reference ?? "", r.note ?? ""]),
    ]);
  }
  if (type === "appointments") {
    const rows = await Appointment.find({ start: { $gte: range.from, $lt: range.to } }).sort({ start: 1 }).limit(50_000).lean();
    const names = await staffNameMap(rows.map((r) => r.staffId));
    return csvResponse(`vg-appointments-${from}-${to}.csv`, [
      ["Reference", "Date & time", "Customer", "Services", "Stylist", "Status", "Source", "Estimated (INR)"],
      ...rows.map((a) => [a.ref, formatDateTime(a.start), a.customer.name, a.items.map((i) => i.name).join("; "), names.get(String(a.staffId)) ?? "", STATUS_LABELS[a.status as AppointmentStatus], a.source, rs(a.estimatedTotal)]),
    ]);
  }
  throw badRequest("Unknown export type.", "type");
});
