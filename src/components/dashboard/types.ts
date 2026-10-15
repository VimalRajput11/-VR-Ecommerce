export interface StaffAppointment {
  id: string;
  ref: string;
  status: string;
  start: string;
  end: string;
  durationMin: number;
  items: { name: string; price: number; durationMin: number; priceVerified: boolean }[];
  estimatedTotal: number;
  stylist: string | null;
  staffId: string;
  serviceIds: string[];
  customerId: string;
  customer: { name: string; phone?: string; email?: string };
  customerNotes: string;
  serviceNotes: string;
  internalNotes?: string;
  source: string;
  request: { type?: string; reason?: string; preferredTime?: string; at?: string; resolved?: boolean } | null;
  checkedInAt?: string;
  invoiceId: string | null;
  history: { status: string; at: string; byName?: string; note?: string }[];
}

export interface AdminService {
  id: string;
  name: string;
  categoryId: string;
  kind: string;
  durationMin: number;
  price: number;
  priceVerified: boolean;
  active: boolean;
  archived: boolean;
  onlineBooking: boolean;
}

export interface StaffLite {
  id: string;
  name: string;
  role: string;
  title?: string;
  bookable: boolean;
  active: boolean;
}
