import { Prisma } from "@prisma/client";
import { requireRecentMfa } from "@/lib/access";
import { leaveTypeSchema } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await requireRecentMfa("leave.manage"); if ("error" in actor) return actor.error;
  const parsed = leaveTypeSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Jenis cuti tidak valid", details: parsed.error.flatten() }, { status: 400 });
  try {
    const row = await db.leaveType.create({ data: { organizationId: actor.session.user.organizationId, code: parsed.data.code, name: parsed.data.name, annualQuota: parsed.data.annualQuota ?? null, requiresAttachment: parsed.data.requiresAttachment } });
    await writeAudit({ organizationId: row.organizationId, actorId: actor.session.user.id, action: "LEAVE_TYPE_CREATED", entityType: "LeaveType", entityId: row.id, metadata: { code: row.code, annualQuota: row.annualQuota } });
    return Response.json(row, { status: 201 });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Kode jenis cuti sudah digunakan" }, { status: 409 }); throw error; }
}
