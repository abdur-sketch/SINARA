import { db } from "@/lib/db";

type AuditInput = {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function writeAudit(input: AuditInput) {
  const safeMetadata = input.metadata ? JSON.parse(JSON.stringify(input.metadata, (key, value) =>
    /password|token|secret|content/i.test(key) ? "[REDACTED]" : value
  )) : undefined;
  await db.auditLog.create({ data: { ...input, metadata: safeMetadata } });
}
