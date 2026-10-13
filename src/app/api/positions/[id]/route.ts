import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/).optional(), isActive: z.boolean().optional() }).refine(value => Object.keys(value).length > 0);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("position.manage"); if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Data jabatan tidak valid" }, { status: 400 });
  const { id } = await params; const organizationId = actor.session.user.organizationId;
  const position = await db.position.findFirst({ where: { id, organizationId } }); if (!position) return Response.json({ error: "Jabatan tidak ditemukan" }, { status: 404 });
  if (parsed.data.isActive === false) { const activeRelations = await db.employeeAssignment.count({ where: { organizationId, positionId: id, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] } }); if (activeRelations) return Response.json({ error: "Jabatan masih memiliki penugasan aktif" }, { status: 409 }); }
  try { const updated = await db.position.update({ where: { id }, data: parsed.data }); await writeAudit({ organizationId, actorId: actor.session.user.id, action: parsed.data.isActive === false ? "POSITION_DEACTIVATED" : "POSITION_UPDATED", entityType: "Position", entityId: id }); return Response.json(updated); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Kode jabatan sudah digunakan" }, { status: 409 }); throw error; }
}
