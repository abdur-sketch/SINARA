import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/).optional(), type: z.enum(["EDUCATION", "BOARDING", "CENTRAL_ADMIN"]).optional(), isActive: z.boolean().optional() }).refine(value => Object.keys(value).length > 0);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("unit.manage"); if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data unit tidak valid" }, { status: 400 });
  const { id } = await params; const organizationId = actor.session.user.organizationId;
  const unit = await db.unit.findFirst({ where: { id, organizationId } }); if (!unit) return Response.json({ error: "Unit tidak ditemukan" }, { status: 404 });
  if (parsed.data.isActive === false) { const activeRelations = await db.employee.count({ where: { organizationId, primaryUnitId: id, isActive: true } }); if (activeRelations) return Response.json({ error: "Unit masih menjadi unit utama pegawai aktif" }, { status: 409 }); }
  try { const updated = await db.unit.update({ where: { id }, data: parsed.data }); await writeAudit({ organizationId, actorId: actor.session.user.id, action: parsed.data.isActive === false ? "UNIT_DEACTIVATED" : "UNIT_UPDATED", entityType: "Unit", entityId: id }); return Response.json(updated); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Kode unit sudah digunakan" }, { status: 409 }); throw error; }
}
