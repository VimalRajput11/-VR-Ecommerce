"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Td, Textarea, Th } from "@/components/ui";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { dateKeyIST, formatDateKey } from "@/lib/time";

type EntryType = "payment" | "advance" | "bonus" | "deduction";

interface Profile {
  monthlySalary: number;
  commissionPercent: number;
  joinedOn: string;
  paymentDetails: string;
  notes: string;
}

interface Row {
  id: string;
  name: string;
  role: string;
  title: string;
  active: boolean;
  profile: Profile;
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

const TYPE_LABELS: Record<EntryType, string> = { payment: "Salary paid", advance: "Advance", bonus: "Bonus / incentive", deduction: "Deduction" };
const TYPE_STYLES: Record<EntryType, string> = {
  payment: "bg-[#eef5ef] text-success",
  advance: "bg-[#fbf3e3] text-warning",
  bonus: "bg-[#f6efe4] text-gold-deep",
  deduction: "bg-[#fbeceb] text-danger",
};
const METHODS = { cash: "Cash", upi: "UPI", bank: "Bank transfer", other: "Other" } as const;

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Balance({ value }: { value: number }) {
  if (value === 0) return <Badge className="bg-[#eef5ef] text-success">Settled</Badge>;
  if (value < 0) return <span className="text-warning">Overpaid {formatINR(-value)}</span>;
  return <span className="font-semibold text-danger">{formatINR(value)}</span>;
}

export default function PayrollPage() {
  return (
    <RequirePermission any={["payroll.manage"]}>
      <Payroll />
    </RequirePermission>
  );
}

function Payroll() {
  const [month, setMonth] = useState(() => dateKeyIST().slice(0, 7));
  const { data, error, loading, reload } = useApi<{ month: string; rows: Row[]; totals: Record<string, number> }>(`/api/admin/payroll${qs({ month })}`);
  const [openId, setOpenId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);

  return (
    <div>
      <PageHeader title="Payroll" description="Salaries, commission, advances and bonuses for every employee. Only the owner can see this page." />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-beige bg-white p-4">
        <Button variant="secondary" size="sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={16} />
        </Button>
        <Input label="Salary month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} wrapClassName="w-48" />
        <Button variant="secondary" size="sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={16} />
        </Button>
        <p className="ml-auto text-sm text-stone">{monthLabel(month)}</p>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total earned" value={formatINR(data.totals.salary + data.totals.commission + data.totals.bonus)} hint={`incl. ${formatINR(data.totals.commission)} commission`} />
            <Stat label="Advances & deductions" value={formatINR(data.totals.advance + data.totals.deduction)} />
            <Stat label="Salary paid" value={formatINR(data.totals.paid)} />
            <Stat label="Balance due" value={formatINR(Math.max(0, data.totals.balance))} tone={data.totals.balance > 0 ? "warning" : "default"} />
          </div>

          {!data.rows.length ? (
            <EmptyState title="No employees yet">
              <p className="mt-1 text-sm text-stone">Add staff in Staff &amp; hours, then set their salary here.</p>
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th className="text-right">Salary</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Bonus</Th>
                  <Th className="text-right">Advance / deduction</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-cream/50" onClick={() => setOpenId(r.id)}>
                    <Td>
                      <span className="font-medium">{r.name}</span>
                      {!r.active && <Badge className="ml-2 bg-cream text-stone">Inactive</Badge>}
                      <span className="block text-xs capitalize text-stone">{r.title || r.role}</span>
                      {!r.profile.monthlySalary && !r.profile.commissionPercent && <span className="block text-xs text-warning">Salary not set</span>}
                    </Td>
                    <Td className="text-right">{formatINR(r.salary)}</Td>
                    <Td className="text-right">
                      {formatINR(r.commission)}
                      {r.profile.commissionPercent > 0 && (
                        <span className="block text-xs text-stone">
                          {r.profile.commissionPercent}% of {formatINR(r.serviceSales)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">{r.bonus ? formatINR(r.bonus) : "—"}</Td>
                    <Td className="text-right">{r.advance + r.deduction ? `−${formatINR(r.advance + r.deduction)}` : "—"}</Td>
                    <Td className="text-right">{r.paid ? formatINR(r.paid) : "—"}</Td>
                    <Td className="text-right">
                      <Balance value={r.balance} />
                    </Td>
                    <Td className="text-right">
                      {r.balance > 0 && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaying(r);
                          }}
                        >
                          Pay
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="text-xs text-stone">
            Balance = salary + commission + bonus − advances − deductions − salary paid. Commission is on each person&apos;s service sales for the month (after bill
            discounts), from bills where they did the work. Click an employee to set their salary and see all records.
          </p>
        </div>
      ) : null}

      {openId && <EmployeeModal userId={openId} month={month} onClose={() => setOpenId(null)} onChanged={reload} />}
      {paying && (
        <Modal open onClose={() => setPaying(null)} title={`Pay ${paying.name} · ${monthLabel(month)}`}>
          <EntryForm
            userId={paying.id}
            month={month}
            initialType="payment"
            initialAmount={paying.balance}
            onSaved={() => {
              setPaying(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

/** Add a salary payment, advance, bonus or deduction. */
function EntryForm({ userId, month, initialType = "payment", initialAmount, onSaved }: { userId: string; month: string; initialType?: EntryType; initialAmount?: number; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    type: initialType,
    amount: initialAmount && initialAmount > 0 ? String(paiseToRupees(initialAmount)) : "",
    date: dateKeyIST(),
    method: "cash",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/payroll/${userId}/entries`, { body: { ...f, month, amount: rupeesToPaise(Number(f.amount)) } });
      toast(`${TYPE_LABELS[f.type]} recorded.`);
      onSaved();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as EntryType })}>
          {(Object.keys(TYPE_LABELS) as EntryType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Input label="Amount (₹)" type="number" min={1} step="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input label="Date" type="date" required value={f.date} max={dateKeyIST()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        {f.type !== "deduction" && f.type !== "bonus" ? (
          <Select label="Paid by" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {Object.entries(METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        ) : (
          <div />
        )}
        <Input
          label="Note"
          wrapClassName="sm:col-span-2"
          value={f.note}
          maxLength={300}
          placeholder={f.type === "deduction" ? "e.g. 2 days leave" : f.type === "bonus" ? "e.g. Diwali bonus" : f.type === "advance" ? "e.g. advance for rent" : "e.g. October salary"}
          onChange={(e) => setF({ ...f, note: e.target.value })}
        />
      </div>
      <p className="text-xs text-stone">Counts towards the {monthLabel(month)} salary.</p>
      <Button onClick={save} loading={busy} disabled={!(Number(f.amount) > 0) || !f.date}>
        Save {TYPE_LABELS[f.type].toLowerCase()}
      </Button>
    </div>
  );
}

/** One employee: pay terms, the month's breakdown, add records, and full history. */
function EmployeeModal({ userId, month, onClose, onChanged }: { userId: string; month: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<{ staff: { id: string; name: string; role: string }; month: string; profile: Profile; statement: Row | null; entries: Entry[] }>(
    `/api/admin/payroll/${userId}${qs({ month })}`,
  );
  const [form, setForm] = useState<{ monthlySalary: string; commissionPercent: string; joinedOn: string; paymentDetails: string; notes: string } | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<typeof data>(null);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setForm({
      monthlySalary: data.profile.monthlySalary ? String(paiseToRupees(data.profile.monthlySalary)) : "",
      commissionPercent: data.profile.commissionPercent ? String(data.profile.commissionPercent) : "",
      joinedOn: data.profile.joinedOn,
      paymentDetails: data.profile.paymentDetails,
      notes: data.profile.notes,
    });
  }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiClientError | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    reload();
    onChanged();
  };

  async function saveProfile() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/admin/payroll/${userId}`, {
        method: "PUT",
        body: {
          monthlySalary: form.monthlySalary ? rupeesToPaise(Number(form.monthlySalary)) : 0,
          commissionPercent: form.commissionPercent ? Math.round(Number(form.commissionPercent)) : 0,
          joinedOn: form.joinedOn || undefined,
          paymentDetails: form.paymentDetails,
          notes: form.notes,
        },
      });
      toast("Pay details saved.");
      refresh();
    } catch (e) {
      setSaveError(e as ApiClientError);
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Entry) {
    const ok = await confirm({
      title: "Delete this record?",
      danger: true,
      confirmLabel: "Delete",
      message: (
        <p>
          {TYPE_LABELS[e.type]} of <strong>{formatINR(e.amount)}</strong> on {formatDateKey(e.date)}. The balance for {monthLabel(e.month)} will be recalculated.
        </p>
      ),
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/admin/payroll/entries/${e.id}`, { method: "DELETE" });
      toast("Record deleted.");
      refresh();
    } catch (err) {
      toast((err as ApiClientError).message);
    }
  }

  const s = data?.statement;
  const byMonth = new Map<string, Entry[]>();
  for (const e of data?.entries ?? []) byMonth.set(e.month, [...(byMonth.get(e.month) ?? []), e]);

  return (
    <Modal open onClose={onClose} title={data ? `${data.staff.name} · Payroll` : "Payroll"} size="xl">
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : data && form ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title="Pay terms">
              {saveError && <Alert tone="error" className="mb-3">{saveError.message}</Alert>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Monthly salary (₹)" type="number" min={0} value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
                <Input label="Commission on services (%)" type="number" min={0} max={100} value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} />
                <Input label="Joined on" type="date" value={form.joinedOn} onChange={(e) => setForm({ ...form, joinedOn: e.target.value })} />
                <Input label="Pay to (UPI ID / bank)" value={form.paymentDetails} maxLength={300} onChange={(e) => setForm({ ...form, paymentDetails: e.target.value })} />
                <Textarea label="Notes" rows={2} wrapClassName="sm:col-span-2" value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button className="mt-3" onClick={saveProfile} loading={saving}>
                Save pay terms
              </Button>
            </Card>

            {s && (
              <Card title={monthLabel(month)}>
                <dl className="space-y-1.5 text-sm">
                  <Line label="Salary" value={s.salary} />
                  <Line label={`Commission (${s.profile.commissionPercent}% of ${formatINR(s.serviceSales)}, ${s.bills} bill${s.bills === 1 ? "" : "s"})`} value={s.commission} />
                  <Line label="Bonus / incentive" value={s.bonus} />
                  <Line label="Earned" value={s.earned} strong />
                  <Line label="Advances" value={-s.advance} />
                  <Line label="Deductions" value={-s.deduction} />
                  <Line label="Salary paid" value={-s.paid} />
                  <div className="flex items-center justify-between border-t border-beige pt-2 font-semibold">
                    <dt>Balance due</dt>
                    <dd>
                      <Balance value={s.balance} />
                    </dd>
                  </div>
                </dl>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card
              title="Records"
              actions={
                !adding && (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    Add record
                  </Button>
                )
              }
            >
              {adding && (
                <div className="mb-5 rounded-md border border-beige bg-cream/40 p-4">
                  <EntryForm
                    userId={userId}
                    month={month}
                    initialType={s && s.balance > 0 ? "payment" : "advance"}
                    initialAmount={s && s.balance > 0 ? s.balance : undefined}
                    onSaved={() => {
                      setAdding(false);
                      refresh();
                    }}
                  />
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              {!data.entries.length ? (
                <p className="text-sm text-stone">No records yet. Add salary payments, advances, bonuses or deductions here.</p>
              ) : (
                <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                  {[...byMonth].map(([m, list]) => (
                    <div key={m}>
                      <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wider ${m === month ? "text-gold-deep" : "text-stone"}`}>{monthLabel(m)}</p>
                      <ul className="divide-y divide-beige rounded-md border border-beige bg-white text-sm">
                        {list.map((e) => (
                          <li key={e.id} className="flex items-center gap-3 px-3 py-2">
                            <Badge className={TYPE_STYLES[e.type]}>{TYPE_LABELS[e.type]}</Badge>
                            <span className="min-w-0 flex-1 text-xs text-stone">
                              {formatDateKey(e.date)}
                              {e.type === "payment" || e.type === "advance" ? ` · ${METHODS[e.method as keyof typeof METHODS] ?? e.method}` : ""}
                              {e.note ? ` · ${e.note}` : ""}
                            </span>
                            <span className="font-medium">{formatINR(e.amount)}</span>
                            <button type="button" aria-label="Delete record" className="text-stone hover:text-danger" onClick={() => remove(e)}>
                              <Trash2 size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </Modal>
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
