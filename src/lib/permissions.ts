import type { Role } from "./constants";

// Permission matrix for the single salon. Enforced on the server; the client uses it only
// to hide controls a user cannot use.

export const PERMISSIONS = [
  "dashboard.view",
  "appointments.view_all",
  "appointments.view_own",
  "appointments.manage", // create walk-ins, confirm, reschedule, cancel, assign stylist
  "appointments.status_own", // stylist: start / complete own appointments
  "appointments.internal_notes",
  "availability.own", // staff can manage own hours / leave
  "services.manage",
  "staff.manage",
  "customers.view",
  "customers.manage",
  "customers.export",
  "billing.manage", // create invoices, record payments, receipts
  "billing.refund",
  "billing.discount",
  "reports.view",
  "settings.manage",
  "inventory.manage",
  "offers.manage",
  "reviews.moderate",
  "gallery.manage",
  "messages.view",
  "careers.manage", // job openings & applications
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  receptionist: [
    "dashboard.view",
    "appointments.view_all",
    "appointments.manage",
    "appointments.internal_notes",
    "customers.view",
    "billing.manage",
    "billing.discount",
    "messages.view",
  ],
  stylist: ["dashboard.view", "appointments.view_own", "appointments.status_own", "availability.own"],
  customer: [],
};

/** Permissions an owner may additionally grant to an individual staff member. */
export const GRANTABLE_PERMISSIONS: Permission[] = [
  "appointments.view_all",
  "appointments.manage",
  "customers.view",
  "customers.manage",
  "billing.manage",
  "billing.refund",
  "billing.discount",
  "inventory.manage",
  "reports.view",
  "reviews.moderate",
  "gallery.manage",
  "careers.manage",
];

export const PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  "appointments.view_all": "View all appointments",
  "appointments.manage": "Book, reschedule & cancel",
  "customers.view": "View customers",
  "customers.manage": "Edit customers",
  "billing.manage": "Billing & payments",
  "billing.refund": "Issue refunds",
  "billing.discount": "Apply discounts",
  "inventory.manage": "Manage inventory",
  "reports.view": "View reports",
  "reviews.moderate": "Moderate reviews",
  "gallery.manage": "Manage gallery",
  "careers.manage": "Hiring & job applications",
};

export function permissionsFor(role: Role, extra: string[] = []): Permission[] {
  const base = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  if (role !== "customer") {
    for (const p of extra) if ((GRANTABLE_PERMISSIONS as string[]).includes(p)) base.add(p as Permission);
  }
  return [...base];
}

export const STAFF_ROLES: Role[] = ["owner", "receptionist", "stylist"];
