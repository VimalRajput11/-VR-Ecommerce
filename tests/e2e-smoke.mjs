// End-to-end smoke test against a running server (default http://localhost:3000).
//   BASE_URL=http://localhost:3100 OWNER_EMAIL=... OWNER_PASSWORD=... node tests/e2e-smoke.mjs
// Creates real records (a test customer, a booking, an invoice) — run against a dev database only.
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

class Client {
  cookie = "";
  async req(path, { method = "GET", body, origin } = {}) {
    const headers = { Origin: origin ?? BASE };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }
}

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   - ${name}`);
  } catch (err) {
    console.log(`FAIL - ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

const guest = new Client();
const owner = new Client();
const alice = new Client();
const bob = new Client();
const stamp = Date.now().toString().slice(-6);
const phone = `98${stamp}12`.slice(0, 10);
let services, booked, aliceAppt, invoiceId;

await step("public pages render with new branding", async () => {
  for (const p of ["/", "/careers", "/services", "/offers", "/gallery", "/reviews", "/about", "/contact", "/faq", "/policies", "/privacy", "/terms", "/book", "/booking/manage", "/login", "/register"]) {
    const r = await guest.req(p);
    assert.equal(r.status, 200, `${p} -> ${r.status}`);
    assert.ok(r.data.includes("VG Unisex Saloon"), `${p} missing brand`);
    assert.ok(!/VR Nails/i.test(r.data), `${p} still mentions VR Nails`);
  }
});

await step("old store URLs redirect", async () => {
  const r = await guest.req("/shop");
  assert.equal(r.status, 308);
  assert.equal(r.headers.get("location"), "/services");
});

await step("private areas redirect to login without a session", async () => {
  const r = await guest.req("/dashboard");
  assert.ok([307, 308].includes(r.status));
  assert.match(r.headers.get("location"), /\/login\?next=/);
});

await step("admin APIs reject anonymous users", async () => {
  assert.equal((await guest.req("/api/admin/overview")).status, 401);
  assert.equal((await guest.req("/api/admin/settings")).status, 401);
});

await step("cross-site POST is blocked", async () => {
  const r = await guest.req("/api/contact", { method: "POST", origin: "https://evil.example", body: { name: "x", phone: "9876543210", message: "hi" } });
  assert.equal(r.status, 403);
});

await step("public catalogue hides unverified prices", async () => {
  const r = await guest.req("/api/public/services");
  assert.equal(r.status, 200);
  services = r.data.services;
  assert.ok(services.length > 10);
  assert.ok(services.every((s) => s.price === null || typeof s.price === "number"));
});

let slotDate, slot;
await step("availability returns IST time slots", async () => {
  const svc = services.find((s) => s.name === "Men's Haircut");
  for (let i = 1; i <= 7 && !slot; i++) {
    const d = new Date(Date.now() + i * 86400000 + 330 * 60000).toISOString().slice(0, 10);
    const r = await guest.req(`/api/public/availability?date=${d}&services=${svc.id}`);
    assert.equal(r.status, 200);
    if (r.data.slots.length) {
      slotDate = d;
      slot = r.data.slots[0];
    }
  }
  assert.ok(slot, "no slots found in the next week");
  assert.match(slot.label, /^\d{1,2}:\d{2} (AM|PM)$/);
});

await step("guest can book, and a duplicate submission returns the same booking", async () => {
  const svc = services.find((s) => s.name === "Men's Haircut");
  const body = { serviceIds: [svc.id], date: slotDate, minutes: slot.minutes, name: "Smoke Guest", phone, idempotencyKey: `smoke${stamp}` };
  const r = await guest.req("/api/bookings", { method: "POST", body });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  booked = r.data.appointment;
  assert.match(booked.ref, /^VG[A-Z0-9]{6}$/);
  const again = await guest.req("/api/bookings", { method: "POST", body });
  assert.equal(again.data.appointment.ref, booked.ref);
});

await step("the same stylist slot cannot be double-booked", async () => {
  const svc = services.find((s) => s.name === "Men's Haircut");
  const r = await guest.req("/api/bookings", { method: "POST", body: { serviceIds: [svc.id], date: slotDate, minutes: slot.minutes, name: "Other", phone: "9123456780" } });
  // Only the owner is bookable in a fresh install, so the slot is now full.
  assert.equal(r.status, 409, JSON.stringify(r.data));
});

await step("guest lookup needs both reference and phone", async () => {
  assert.equal((await guest.req("/api/bookings/lookup", { method: "POST", body: { ref: booked.ref, phone: "9000000000" } })).status, 404);
  const r = await guest.req("/api/bookings/lookup", { method: "POST", body: { ref: booked.ref, phone } });
  assert.equal(r.status, 200);
  assert.equal(r.data.appointment.customer.phone, undefined, "phone should not be echoed back");
});

await step("customers register, book, and cannot see each other's bookings", async () => {
  const a = await alice.req("/api/auth/register", { method: "POST", body: { name: "Alice Smoke", email: `alice${stamp}@test.local`, phone: "9811111111", password: "Alice12345", acceptTerms: true } });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  const b = await bob.req("/api/auth/register", { method: "POST", body: { name: "Bob Smoke", email: `bob${stamp}@test.local`, password: "Bob1234567", acceptTerms: true } });
  assert.equal(b.status, 201);
  const svc = services.find((s) => s.name === "Beard Trim");
  const avail = await alice.req(`/api/public/availability?date=${slotDate}&services=${svc.id}`);
  const s = avail.data.slots[avail.data.slots.length - 1];
  const r = await alice.req("/api/bookings", { method: "POST", body: { serviceIds: [svc.id], date: slotDate, minutes: s.minutes, name: "Alice Smoke", phone: "9811111111" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  aliceAppt = r.data.appointment;
  const mine = await alice.req("/api/account/appointments");
  assert.ok(mine.data.upcoming.some((x) => x.id === aliceAppt.id));
  const theirs = await bob.req("/api/account/appointments");
  assert.ok(!theirs.data.upcoming.some((x) => x.id === aliceAppt.id));
  assert.equal((await bob.req(`/api/account/appointments/${aliceAppt.id}`, { method: "POST", body: { action: "cancel" } })).status, 404);
  assert.equal((await alice.req("/api/admin/overview")).status, 403);
});

await step("weak passwords and bad input are rejected", async () => {
  const r = await guest.req("/api/auth/register", { method: "POST", body: { name: "X", email: "x@test.local", password: "short", acceptTerms: true } });
  assert.equal(r.status, 400);
  assert.equal(r.data.field, "password");
  const bad = await guest.req("/api/bookings", { method: "POST", body: { serviceIds: ["nope"], date: "2026-02-30", minutes: 600, name: "", phone: "1" } });
  assert.equal(bad.status, 400);
});

if (OWNER_EMAIL && OWNER_PASSWORD) {
  await step("owner signs in and sees real dashboard data", async () => {
    const r = await owner.req("/api/auth/login", { method: "POST", body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const o = await owner.req("/api/admin/overview");
    assert.equal(o.status, 200);
    assert.ok(o.data.sales, "owner should see sales");
    assert.ok(o.data.alerts.unverifiedPrices > 0);
  });

  await step("owner confirms, checks in, completes and bills an appointment", async () => {
    for (const status of ["confirmed", "checked_in", "in_progress", "completed"]) {
      const r = await owner.req(`/api/admin/appointments/${booked.id}`, { method: "PATCH", body: { action: "status", status } });
      assert.equal(r.status, 200, `${status}: ${JSON.stringify(r.data)}`);
    }
    const bad = await owner.req(`/api/admin/appointments/${booked.id}`, { method: "PATCH", body: { action: "status", status: "pending" } });
    assert.equal(bad.status, 400);
    const inv = await owner.req("/api/admin/invoices", { method: "POST", body: { appointmentId: booked.id } });
    assert.equal(inv.status, 201, JSON.stringify(inv.data));
    invoiceId = inv.data.invoice.id;
    assert.equal(inv.data.invoice.total, booked.items[0].price);
    const dup = await owner.req("/api/admin/invoices", { method: "POST", body: { appointmentId: booked.id } });
    assert.equal(dup.status, 409);
  });

  await step("payments cannot exceed the balance; full payment marks the invoice paid", async () => {
    const inv = (await owner.req(`/api/admin/invoices/${invoiceId}`)).data.invoice;
    const over = await owner.req(`/api/admin/invoices/${invoiceId}`, { method: "POST", body: { action: "payment", amount: inv.balanceDue + 1, method: "cash" } });
    assert.equal(over.status, 409);
    const ok = await owner.req(`/api/admin/invoices/${invoiceId}`, { method: "POST", body: { action: "payment", amount: inv.balanceDue, method: "upi", reference: "SMOKE" } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.invoice.status, "paid");
  });

  await step("customers cannot set prices: invoice endpoints are staff-only", async () => {
    assert.equal((await alice.req("/api/admin/invoices", { method: "POST", body: { customLines: [{ description: "x", amount: 1 }], customer: { name: "A", phone: "9811111111" } } })).status, 403);
  });

  await step("reports reflect recorded payments", async () => {
    const r = await owner.req("/api/admin/reports");
    assert.equal(r.status, 200);
    assert.ok(r.data.sales.collected >= booked.items[0].price);
    const csv = await owner.req("/api/admin/reports/export?type=payments");
    assert.equal(csv.status, 200);
    assert.match(String(csv.data), /Invoice/);
  });

  await step("receptionist permissions are enforced", async () => {
    const r = await owner.req("/api/admin/staff", { method: "POST", body: { name: "Rita Reception", email: `rita${stamp}@test.local`, role: "receptionist", password: "Recept1234" } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const rita = new Client();
    await rita.req("/api/auth/login", { method: "POST", body: { email: `rita${stamp}@test.local`, password: "Recept1234" } });
    assert.equal((await rita.req("/api/admin/appointments")).status, 200);
    assert.equal((await rita.req("/api/admin/settings")).status, 403);
    assert.equal((await rita.req("/api/admin/reports")).status, 403);
    assert.equal((await rita.req("/api/admin/customers/export")).status, 403);
    const ov = await rita.req("/api/admin/overview");
    assert.equal(ov.data.sales, undefined, "receptionist must not see sales figures");
    // Deactivate again so the test account cannot be used.
    await owner.req(`/api/admin/staff/${r.data.staff.id}`, { method: "PATCH", body: { active: false } });
    assert.equal((await rita.req("/api/admin/appointments")).status, 401);
  });

  await step("careers: owner posts a job, public applies, owner reviews; others are blocked", async () => {
    const job = await owner.req("/api/admin/careers", { method: "POST", body: { title: `Smoke Stylist ${stamp}`, type: "full_time", experience: "2+ years" } });
    assert.equal(job.status, 201, JSON.stringify(job.data));
    const page = await guest.req("/careers");
    assert.ok(page.data.includes(`Smoke Stylist ${stamp}`), "open job not listed on /careers");
    const noConsent = await guest.req("/api/careers/apply", { method: "POST", body: { openingId: job.data.opening.id, name: "Applicant", phone: "9822222222" } });
    assert.equal(noConsent.status, 400);
    const badLink = await guest.req("/api/careers/apply", { method: "POST", body: { openingId: job.data.opening.id, name: "Applicant", phone: "9822222222", consent: true, portfolioUrl: "javascript:alert(1)" } });
    assert.equal(badLink.status, 400);
    const apply = await guest.req("/api/careers/apply", { method: "POST", body: { openingId: job.data.opening.id, name: "Smoke Applicant", phone: "9822222222", experienceYears: 3, portfolioUrl: "instagram.com/example", consent: true } });
    assert.equal(apply.status, 201, JSON.stringify(apply.data));
    const list = await owner.req(`/api/admin/careers/applications?opening=${job.data.opening.id}`);
    assert.equal(list.data.items.length, 1);
    assert.equal(list.data.items[0].portfolioUrl, "https://instagram.com/example");
    const upd = await owner.req(`/api/admin/careers/applications/${list.data.items[0].id}`, { method: "PATCH", body: { status: "shortlisted", notes: "call Monday" } });
    assert.equal(upd.data.application.status, "shortlisted");
    assert.equal((await alice.req("/api/admin/careers/applications")).status, 403);
    assert.equal((await guest.req("/api/admin/careers")).status, 401);
    await owner.req(`/api/admin/careers/applications/${list.data.items[0].id}`, { method: "DELETE" });
    await owner.req(`/api/admin/careers/${job.data.opening.id}`, { method: "DELETE" });
    const after = await guest.req("/careers");
    assert.ok(!after.data.includes(`Smoke Stylist ${stamp}`), "archived job still listed");
  });

  await step("customer can cancel their own booking outside the cut-off", async () => {
    const r = await alice.req(`/api/account/appointments/${aliceAppt.id}`, { method: "POST", body: { action: "cancel", reason: "smoke test" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.appointment.status, "cancelled");
  });
} else {
  console.log("skip - owner flows (set OWNER_EMAIL and OWNER_PASSWORD)");
}

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
