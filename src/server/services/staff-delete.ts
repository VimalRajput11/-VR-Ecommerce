import type { Types } from "mongoose";
import { Appointment, Invoice, PayEntry, PayProfile, Session, TimeOff, User } from "@/server/models";
import type { AuthUser } from "@/server/auth/session";
import { conflict, forbidden, notFound } from "@/server/lib/errors";
import { audit } from "./audit";

const OPEN_STATUSES = ["pending", "confirmed", "checked_in", "in_progress"];

/**
 * Owner removes an employee. They are signed out and can never sign in again.
 * - No history: the account is deleted completely.
 * - Has history (appointments, bills, payroll): the name stays on those records, but the account
 *   loses its email and password, is switched off and hidden from staff lists.
 * Upcoming appointments must be moved to someone else first.
 */
export async function deleteStaff(id: Types.ObjectId, actor: AuthUser) {
  if (actor.role !== "owner") throw forbidden("Only the owner can delete staff.");
  if (String(id) === actor.id) throw conflict("You can't delete your own account.");
  const target = await User.findOne({ _id: id, role: { $in: ["owner", "receptionist", "stylist"] }, deletedAt: { $exists: false } }).select("name role").lean();
  if (!target) throw notFound("Staff member not found.");
  if (target.role === "owner") throw conflict("The owner account can't be deleted.");

  const upcoming = await Appointment.countDocuments({ staffId: id, status: { $in: OPEN_STATUSES }, start: { $gte: new Date() } });
  if (upcoming) throw conflict(`${target.name} has ${upcoming} upcoming appointment${upcoming === 1 ? "" : "s"}. Move them to another stylist first.`);

  const hasHistory =
    !!(await Appointment.exists({ staffId: id })) ||
    !!(await Invoice.exists({ $or: [{ staffId: id }, { "lines.allocations.staffId": id }] })) ||
    !!(await PayEntry.exists({ userId: id }));

  await Promise.all([Session.deleteMany({ userId: id }), TimeOff.deleteMany({ staffId: id })]);
  if (hasHistory) {
    await User.updateOne(
      { _id: id },
      { $set: { active: false, deletedAt: new Date(), "staff.bookable": false, extraPermissions: [] }, $unset: { email: "", passwordHash: "" } },
    );
  } else {
    await Promise.all([User.deleteOne({ _id: id }), PayProfile.deleteOne({ userId: id })]);
  }
  await audit(actor, "staff.delete", "User", String(id), `Deleted staff ${target.name}${hasHistory ? " (name kept on past records)" : ""}`);
  return { removed: hasHistory ? "archived" : "deleted" };
}
