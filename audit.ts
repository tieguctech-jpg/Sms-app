import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { genId } from "./auth";

interface AuditParams {
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export async function audit(params: AuditParams) {
  try {
    await db.insert(auditLogsTable).values({
      id: genId(),
      actorId: params.actorId ?? null,
      actorEmail: params.actorEmail ?? null,
      action: params.action,
      targetId: params.targetId ?? null,
      targetType: params.targetType ?? null,
      ipAddress: params.ipAddress ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Audit failures are non-fatal
  }
}
