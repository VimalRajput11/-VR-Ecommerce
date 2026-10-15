import type { Types } from "mongoose";
import { Appointment, Service, TimeOff, User, type ServiceDoc } from "@/server/models";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { addDaysToKey, dateKeyIST, istToUtc, weekdayOfDateKey } from "@/lib/time";
import { badRequest } from "@/server/lib/errors";
import { computeSlots, summariseServices, type Slot, type StaffDay } from "./availability-core";
import type { Settings } from "./settings";

export async function loadBookableServices(ids: Types.ObjectId[], opts: { online: boolean }): Promise<ServiceDoc[]> {
  if (!ids.length) throw badRequest("Please choose at least one service.", "serviceIds");
  const docs = await Service.find({ _id: { $in: ids }, active: true, archived: { $ne: true } }).lean<ServiceDoc[]>();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const ordered = ids.map((id) => byId.get(String(id)));
  if (ordered.some((d) => !d)) throw badRequest("One of the selected services is no longer available.", "serviceIds");
  const services = ordered as ServiceDoc[];
  if (opts.online && services.some((s) => !s.onlineBooking))
    throw badRequest("One of the selected services must be booked by contacting the salon.", "serviceIds");
  return services;
}

export interface BookableStaff {
  _id: Types.ObjectId;
  name: string;
  staff?: { title?: string | null; services?: Types.ObjectId[]; workingHours?: { day: number; closed?: boolean | null; open?: string | null; close?: string | null }[]; breaks?: { day: number; start: string; end: string }[] } | null;
}

/** Active, bookable staff who are eligible for every one of the given services. */
export async function eligibleStaff(services: ServiceDoc[], staffId?: Types.ObjectId | null): Promise<BookableStaff[]> {
  const filter: Record<string, unknown> = {
    role: { $in: ["owner", "receptionist", "stylist"] },
    active: true,
    "staff.bookable": true,
  };
  if (staffId) filter._id = staffId;
  const staff = await User.find(filter).select("name staff").sort({ name: 1 }).lean<BookableStaff[]>();
  return staff.filter((member) =>
    services.every(
      (s) =>
        (!s.eligibleStaff?.length || s.eligibleStaff.some((id) => id.equals(member._id))) &&
        (!member.staff?.services?.length || member.staff.services.some((id) => id.equals(s._id))),
    ),
  );
}

export function validateBookingWindow(dateKey: string, settings: Settings, now = new Date()) {
  const today = dateKeyIST(now);
  if (dateKey < today) throw badRequest("Please choose today or a future date.", "date");
  const maxDays = settings.booking?.maxAdvanceDays ?? 60;
  if (dateKey > addDaysToKey(today, maxDays))
    throw badRequest(`Appointments can be booked up to ${maxDays} days in advance.`, "date");
}

interface DayQuery {
  dateKey: string;
  services: ServiceDoc[];
  staff: BookableStaff[];
  settings: Settings;
  now?: Date;
  /** Staff bookings (walk-ins) skip the online lead time. */
  forStaff?: boolean;
  excludeAppointmentId?: Types.ObjectId;
}

export async function dayAvailability(q: DayQuery): Promise<Slot[]> {
  const { dateKey, services, staff, settings } = q;
  if (!staff.length) return [];
  const weekday = weekdayOfDateKey(dateKey);
  const salonDay = settings.hours?.find((h) => h.day === weekday) ?? { closed: true };
  const dayStart = istToUtc(dateKey, 0);
  const dayEnd = istToUtc(dateKey, 24 * 60);
  const staffIds = staff.map((s) => s._id);

  const [appointments, timeOff] = await Promise.all([
    Appointment.find({
      staffId: { $in: staffIds },
      status: { $in: ACTIVE_STATUSES },
      start: { $lt: dayEnd },
      end: { $gt: new Date(dayStart.getTime() - 4 * 3_600_000) },
      ...(q.excludeAppointmentId ? { _id: { $ne: q.excludeAppointmentId } } : {}),
    })
      .select("staffId start end bufferMin")
      .lean(),
    TimeOff.find({
      $or: [{ staffId: null }, { staffId: { $in: staffIds } }],
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    }).lean(),
  ]);

  const staffDays: StaffDay[] = staff.map((member) => {
    const own = member.staff?.workingHours?.find((h) => h.day === weekday);
    return {
      id: String(member._id),
      hours: own ? { closed: own.closed, open: own.open, close: own.close } : null,
      breaks: (member.staff?.breaks ?? []).filter((b) => b.day === weekday),
      busy: [
        ...appointments
          .filter((a) => a.staffId.equals(member._id))
          .map((a) => ({ start: a.start, end: new Date(a.end.getTime() + (a.bufferMin ?? 0) * 60_000) })),
        ...timeOff.filter((t) => t.staffId && t.staffId.equals(member._id)).map((t) => ({ start: t.start, end: t.end })),
      ],
    };
  });

  const summary = summariseServices(services);
  const interval = settings.booking?.slotIntervalMin ?? 15;
  return computeSlots({
    dateKey,
    now: q.forStaff ? new Date((q.now ?? new Date()).getTime() - interval * 60_000) : (q.now ?? new Date()),
    durationMin: summary.durationMin,
    bufferMin: summary.bufferMin,
    intervalMin: interval,
    minLeadMinutes: q.forStaff ? 0 : (settings.booking?.minLeadMinutes ?? 0),
    salon: salonDay,
    closures: timeOff.filter((t) => !t.staffId).map((t) => ({ start: t.start, end: t.end })),
    staff: staffDays,
  });
}
