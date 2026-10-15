"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission, useFeatures } from "@/components/dashboard/DashboardShell";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Table, Td, Th } from "@/components/ui";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  retail: boolean;
  lowStockThreshold: number;
  lowStock: boolean;
  supplier: { name: string; phone: string; notes: string };
  active: boolean;
}

export default function InventoryPage() {
  return (
    <RequirePermission any={["inventory.manage"]}>
      <Inventory />
    </RequirePermission>
  );
}

function Inventory() {
  const features = useFeatures();
  const { data, error, loading, reload } = useApi<{ products: Product[] }>("/api/admin/products");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [stock, setStock] = useState<Product | null>(null);
  if (!features.inventory) {
    return (
      <EmptyState title="Inventory is turned off" action={<Link href="/dashboard/settings" className="underline">Enable it in Settings</Link>}>
        Inventory is optional. When it is off, booking and billing work normally.
      </EmptyState>
    );
  }
  return (
    <div>
      <PageHeader title="Inventory" description="Salon supplies and retail products." actions={<Button onClick={() => setEditing("new")}>Add product</Button>} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.products.length ? (
        <EmptyState title="No products yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th className="text-right">In stock</Th>
              <Th className="text-right">Cost</Th>
              <Th className="text-right">Selling</Th>
              <Th>Supplier</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                <Td>
                  <button type="button" className="font-medium hover:underline" onClick={() => setEditing(p)}>
                    {p.name}
                  </button>
                  {p.retail && <Badge className="ml-2">Retail</Badge>}
                  {p.sku && <span className="block text-xs text-stone">SKU {p.sku}</span>}
                </Td>
                <Td>{p.category}</Td>
                <Td className="text-right">
                  <span className={p.lowStock ? "font-semibold text-warning" : ""}>
                    {p.quantity} {p.unit}
                  </span>
                  {p.lowStock && <span className="block text-xs text-warning">Low (≤ {p.lowStockThreshold})</span>}
                </Td>
                <Td className="text-right">{formatINR(p.costPrice)}</Td>
                <Td className="text-right">{p.retail ? formatINR(p.sellingPrice) : "—"}</Td>
                <Td className="text-xs">{p.supplier.name}</Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => setStock(p)}>
                    Stock
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing && <ProductModal product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {stock && <StockModal product={stock} onClose={() => setStock(null)} onSaved={reload} />}
    </div>
  );
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "Supplies",
    sku: product?.sku ?? "",
    unit: product?.unit ?? "pcs",
    costPrice: product ? String(paiseToRupees(product.costPrice)) : "",
    sellingPrice: product ? String(paiseToRupees(product.sellingPrice)) : "",
    retail: product?.retail ?? false,
    lowStockThreshold: String(product?.lowStockThreshold ?? 0),
    supplier: product?.supplier ?? { name: "", phone: "", notes: "" },
    active: product?.active ?? true,
    openingQty: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      ...f,
      costPrice: rupeesToPaise(Number(f.costPrice) || 0),
      sellingPrice: rupeesToPaise(Number(f.sellingPrice) || 0),
      lowStockThreshold: Number(f.lowStockThreshold) || 0,
      openingQty: Number(f.openingQty) || 0,
    };
    try {
      if (product) await apiFetch(`/api/admin/products/${product.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/products", { body });
      toast("Product saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={product ? `Edit ${product.name}` : "Add product"} size="lg" footer={<Button onClick={save} loading={busy}>Save</Button>}>
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Input label="SKU" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
        <Input label="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} hint="pcs, ml, g, bottle…" />
        <Input label="Purchase cost (₹ per unit)" type="number" min={0} step="0.01" value={f.costPrice} onChange={(e) => setF({ ...f, costPrice: e.target.value })} />
        <Input label="Low-stock alert at" type="number" min={0} value={f.lowStockThreshold} onChange={(e) => setF({ ...f, lowStockThreshold: e.target.value })} />
        <Checkbox label="Sold to customers (retail)" checked={f.retail} onChange={(e) => setF({ ...f, retail: e.target.checked })} className="sm:col-span-2" />
        {f.retail && <Input label="Selling price (₹)" type="number" min={0} step="0.01" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: e.target.value })} />}
        {!product && <Input label="Opening stock" type="number" min={0} value={f.openingQty} onChange={(e) => setF({ ...f, openingQty: e.target.value })} />}
        <Input label="Supplier name" value={f.supplier.name} onChange={(e) => setF({ ...f, supplier: { ...f.supplier, name: e.target.value } })} />
        <Input label="Supplier phone" value={f.supplier.phone} onChange={(e) => setF({ ...f, supplier: { ...f.supplier, phone: e.target.value } })} />
        <Input label="Supplier notes" wrapClassName="sm:col-span-2" value={f.supplier.notes} onChange={(e) => setF({ ...f, supplier: { ...f.supplier, notes: e.target.value } })} />
        {product && <Checkbox label="Active" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />}
      </div>
    </Modal>
  );
}

function StockModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const history = useApi<{ movements: { id: string; type: string; qty: number; balanceAfter: number; reason: string; at: string }[] }>(`/api/admin/products/${product.id}`);
  const [f, setF] = useState({ type: "received", qty: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/products/${product.id}`, { body: { type: f.type, qty: Math.round(Number(f.qty)), reason: f.reason || undefined } });
      toast("Stock updated.");
      setF({ ...f, qty: "", reason: "" });
      history.reload();
      onSaved();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Stock: ${product.name}`} size="lg">
      {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Select label="Movement" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="received">Stock received</option>
          <option value="consumed">Used in salon</option>
          <option value="adjustment">Adjustment (+/−)</option>
        </Select>
        <Input label="Quantity" type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} hint={f.type === "adjustment" ? "Negative to reduce" : undefined} />
        <Input label="Reason" wrapClassName="sm:col-span-2" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required={f.type === "adjustment"} />
      </div>
      <Button className="mt-3" size="sm" onClick={save} loading={busy} disabled={!f.qty}>
        Record
      </Button>
      <h3 className="mb-2 mt-6 font-serif text-lg">History</h3>
      {history.loading ? (
        <Spinner />
      ) : history.data?.movements.length ? (
        <ul className="max-h-64 divide-y divide-beige overflow-y-auto text-sm">
          {history.data.movements.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 py-2">
              <span>
                {formatDateTime(m.at)} · <span className="capitalize">{m.type}</span>
                {m.reason ? ` · ${m.reason}` : ""}
              </span>
              <span className={m.qty < 0 ? "text-danger" : "text-success"}>
                {m.qty > 0 ? "+" : ""}
                {m.qty} → {m.balanceAfter}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone">No movements yet.</p>
      )}
    </Modal>
  );
}
