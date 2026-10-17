"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { qs, useApi } from "@/lib/api";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Badge, Button, Card, ErrorState, Input, PageHeader, Spinner, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { dateKeyIST, formatDateKey } from "@/lib/time";

type EntryType = "payment" | "advance" | "bonus" | "deduction";

interface Statement {
  monthlySalary: number;
  commissionPercent: number;
  salary: number;
  serviceSales: number;
  bills: number;
  commission: number;
  bonus: number;
  deduction: number;
  advance: number;
  paid: number;
  earned: number;
  balance: number;
}

interface Entry {
  id: string;
  month: string;
  type: EntryType;
  amount: number;
  date: string;
  method: string;
  note: string;
}

const TYPE_LABELS: Record<EntryType, string> = { payment: "Salary credited", advance: "Advance", bonus: "Bonus / incentive", deduction: "Deduction" };
const TYPE_STYLES: Record<EntryType, string> = {
  payment: "bg-[#eef5ef] text-success",
  advance: "bg-[#fbf3e3] text-warning",
  bonus: "bg-[#f6efe4] text-gold-deep",
  deduction: "bg-[#fbeceb] text-danger",
};
const METHODS: Record<string, string> = { cash: "Cash", upi: "UPI", bank: "Bank transfer", other: "Other" };

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function MySalaryPage() {
  return (
    <RequirePermission any={["payroll.own"]}>
      <MySalary />
    </RequirePermission>
  );
}

/** Read-only view of the signed-in staff member's own pay and salary credits. */
function MySalary() {
  const [month, setMonth] = useState(() => dateKeyIST().slice(0, 7));
  const { data, error, loading, reload } = useApi<{ month: string; statement: Statement | null; entries: Entry[] }>(`/api/admin/my-salary${qs({ month })}`);
  const s = data?.statement;
  const byMonth = new Map<string, Entry[]>();
  for (const e of data?.entries ?? []) byMonth.set(e.month, [...(byMonth.get(e.month) ?? []), e]);

  return (
    <div>
      <PageHeader title="My salary" description="Your salary, commission and every payment credited to you." />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-beige bg-white p-4">
        <Button variant="secondary" size="sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={16} />
        </Button>
        <Input label="Month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} wrapClassName="w-48" />
        <Button variant="secondary" size="sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          {s ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Earned" value={formatINR(s.earned)} hint={monthLabel(month)} />
                <Stat label="Credited" value={formatINR(s.paid)} />
                <Stat label="Advances & deductions" value={formatINR(s.advance + s.deduction)} />
                <Stat label="Balance due to you" value={formatINR(Math.max(0, s.balance))} tone={s.balance > 0 ? "warning" : "default"} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title={monthLabel(month)}>
                  <dl className="space-y-1.5 text-sm">
                    <Line label={`Salary (${formatINR(s.monthlySalary)} / month)`} value={s.salary} />
                    {s.commissionPercent > 0 && (
                      <Line label={`Commission (${s.commissionPercent}% of ${formatINR(s.serviceSales)} service sales, ${s.bills} bill${s.bills === 1 ? "" : "s"})`} value={s.commission} />
                    )}
                    <Line label="Bonus / incentive" value={s.bonus} />
                    <Line label="Total earned" value={s.earned} strong />
                    <Line label="Advances" value={-s.advance} />
                    <Line label="Deductions" value={-s.deduction} />
                    <Line label="Salary credited" value={-s.paid} />
                    <div className="flex items-center justify-between border-t border-beige pt-2 font-semibold">
                      <dt>Balance due to you</dt>
                      <dd>{s.balance === 0 ? <Badge className="bg-[#eef5ef] text-success">Fully paid</Badge> : s.balance > 0 ? formatINR(s.balance) : `Overpaid ${formatINR(-s.balance)}`}</dd>
                    </div>
                  </dl>
                </Card>
                <Card title="Payment history">
                  {!data.entries.length ? (
                    <p className="text-sm text-stone">No salary records yet.</p>
                  ) : (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                      {[...byMonth].map(([m, list]) => (
                        <div key={m}>
                          <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wider ${m === month ? "text-gold-deep" : "text-stone"}`}>{monthLabel(m)}</p>
                          <ul className="divide-y divide-beige rounded-md border border-beige bg-white text-sm">
                            {list.map((e) => (
                              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                                <Badge className={TYPE_STYLES[e.type]}>{TYPE_LABELS[e.type]}</Badge>
                                <span className="min-w-0 flex-1 text-xs text-stone">
                                  {formatDateKey(e.date)}
                                  {e.type === "payment" || e.type === "advance" ? ` · ${METHODS[e.method] ?? e.method}` : ""}
                                  {e.note ? ` · ${e.note}` : ""}
                                </span>
                                <span className="font-medium">{formatINR(e.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <p className="text-sm text-stone">Your salary details haven&apos;t been set up yet. Please ask the owner.</p>
            </Card>
          )}
          <p className="text-xs text-stone">Something looks wrong? Please speak to the owner.</p>
        </div>
      ) : null}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-beige pt-1.5 font-medium" : ""}`}>
      <dt className={strong ? "" : "text-stone"}>{label}</dt>
      <dd>{value < 0 ? `−${formatINR(-value)}` : formatINR(value)}</dd>
    </div>
  );
}
