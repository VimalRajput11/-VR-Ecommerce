import { AuditLog } from "@/server/models";
import type { AuthUser } from "@/server/auth/session";

export async function audit(
  actor: AuthUser | null,
  action: string,
  entity: string,
  entityId: string | undefined,
  summary: string,
  meta?: Record<string, unknown>,
) {
  try {
    await AuditLog.create({
      actorId: actor?.id,
      actorName: actor?.name ?? "System",
      actorRole: actor?.role ?? "system",
      action,
      entity,
      entityId,
      summary: summary.slice(0, 500),
      meta,
    });
  } catch (err) {
    // Auditing must never break the primary action.
    console.error("[audit]", err);
  }
}
