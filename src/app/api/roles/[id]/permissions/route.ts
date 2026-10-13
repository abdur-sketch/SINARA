import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ permissionIds: z.array(z.string().uuid()) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("role.manage");
  if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Permission tidak valid" }, { status: 400 });
  const { id } = await params;
  const organizationId = actor.session.user.organizationId;
  const role = await db.role.findFirst({ where: { id, organizationId }, include: { users: { where: { userId: actor.session.user.id } } } });
  if (!role) return Response.json({ error: "Role tidak ditemukan" }, { status: 404 });
  if (role.name === "SUPER_ADMIN") return Response.json({ error: "Permission SUPER_ADMIN sistem tidak dapat diubah" }, { status: 409 });
  if (role.users.length) return Response.json({ error: "Tidak dapat mengubah role yang sedang dipakai akun sendiri" }, { status: 409 });
  const permissions = await db.permission.findMany({ where: { id: { in: parsed.data.permissionIds } }, select: { id: true } });
  if (permissions.length !== new Set(parsed.data.permissionIds).size) return Response.json({ error: "Permission tidak ditemukan" }, { status: 400 });
  await db.$transaction(async tx => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map(permission => ({ roleId: id, permissionId: permission.id })) });
    await tx.user.updateMany({ where: { organizationId, roles: { some: { roleId: id } } }, data: { sessionVersion: { increment: 1 } } });
  });
  await writeAudit({ organizationId, actorId: actor.session.user.id, action: "ROLE_PERMISSIONS_UPDATED", entityType: "Role", entityId: id, metadata: { permissionIds: parsed.data.permissionIds } });
  return Response.json({ ok: true });
}
