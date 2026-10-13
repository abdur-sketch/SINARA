import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRecentMfa } from "@/lib/access";
import { isLastActiveSuperAdmin } from "@/lib/administration";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional(), employeeId: z.string().uuid().nullable().optional() }).refine(value => Object.keys(value).length > 0);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("user.manage");
  if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Perubahan tidak valid" }, { status: 400 });
  const { id } = await params;
  const organizationId = actor.session.user.organizationId;
  const target = await db.user.findFirst({ where: { id, organizationId }, include: { roles: { include: { role: true } } } });
  if (!target) return Response.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
  if (parsed.data.isActive === false && id === actor.session.user.id) return Response.json({ error: "Tidak dapat menonaktifkan akun sendiri" }, { status: 409 });
  if (parsed.data.isActive === false && await isLastActiveSuperAdmin(organizationId, id)) return Response.json({ error: "SUPER_ADMIN aktif terakhir tidak dapat dinonaktifkan" }, { status: 409 });
  if (parsed.data.employeeId === null && target.roles.some(item => item.role.name === "PEGAWAI")) return Response.json({ error: "Role PEGAWAI memerlukan tautan data pegawai" }, { status: 409 });
  if (parsed.data.employeeId && !await db.employee.findFirst({ where: { id: parsed.data.employeeId, organizationId, isActive: true }, select: { id: true } })) return Response.json({ error: "Pegawai tidak valid" }, { status: 400 });
  let user;
  try { user = await db.user.update({ where: { id }, data: { ...parsed.data, ...(parsed.data.isActive !== undefined || parsed.data.employeeId !== undefined ? { sessionVersion: { increment: 1 } } : {}) } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Pegawai sudah terhubung ke akun lain" }, { status: 409 }); throw error; }
  await writeAudit({ organizationId, actorId: actor.session.user.id, action: parsed.data.isActive === false ? "USER_DEACTIVATED" : parsed.data.isActive === true ? "USER_ACTIVATED" : "USER_UPDATED", entityType: "User", entityId: id });
  return Response.json(user);
}
