import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("employee.document.manage");
  if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Keputusan tidak valid" }, { status: 400 });
  const { id } = await params;
  const document = await db.employeeDocument.findFirst({ where: { id, organizationId: actor.session.user.organizationId } });
  if (!document) return Response.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  const updated = await db.employeeDocument.update({ where: { id }, data: { scanStatus: parsed.data.status, scanNote: parsed.data.note, reviewedById: actor.session.user.id, reviewedAt: new Date() } });
  await writeAudit({ organizationId: actor.session.user.organizationId, actorId: actor.session.user.id, action: `DOCUMENT_${parsed.data.status}`, entityType: "EmployeeDocument", entityId: id });
  return Response.json(updated);
}
