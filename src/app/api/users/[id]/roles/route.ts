import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { isLastActiveSuperAdmin } from "@/lib/administration";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

const schema = z.object({ roleId: z.string().uuid() });

async function context(req: Request, params: Promise<{ id: string }>) {
  const actor = await requireRecentMfa("user.manage");
  if ("error" in actor) return { error: actor.error } as const;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id); if (limited) return { error: limited } as const;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return { error: Response.json({ error: "Role tidak valid" }, { status: 400 }) } as const;
  const { id } = await params;
  const organizationId = actor.session.user.organizationId;
  if (id === actor.session.user.id) return { error: Response.json({ error: "Perubahan role akun sendiri tidak diizinkan" }, { status: 409 }) } as const;
  const [user, role] = await Promise.all([db.user.findFirst({ where: { id, organizationId } }), db.role.findFirst({ where: { id: parsed.data.roleId, organizationId } })]);
  if (!user || !role) return { error: Response.json({ error: "Pengguna atau role tidak ditemukan" }, { status: 404 }) } as const;
  return { actor, user, role, organizationId } as const;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const value = await context(req, params); if ("error" in value) return value.error;
  await db.$transaction([db.userRole.upsert({ where: { userId_roleId: { userId: value.user.id, roleId: value.role.id } }, create: { userId: value.user.id, roleId: value.role.id }, update: {} }), db.user.update({ where: { id: value.user.id }, data: { sessionVersion: { increment: 1 } } })]);
  await writeAudit({ organizationId: value.organizationId, actorId: value.actor.session.user.id, action: "USER_ROLE_ASSIGNED", entityType: "User", entityId: value.user.id, metadata: { roleId: value.role.id } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const value = await context(req, params); if ("error" in value) return value.error;
  if (value.role.name === "SUPER_ADMIN" && await isLastActiveSuperAdmin(value.organizationId, value.user.id)) return Response.json({ error: "Role SUPER_ADMIN aktif terakhir tidak dapat dicabut" }, { status: 409 });
  await db.$transaction([db.userRole.deleteMany({ where: { userId: value.user.id, roleId: value.role.id } }), db.user.update({ where: { id: value.user.id }, data: { sessionVersion: { increment: 1 } } })]);
  await writeAudit({ organizationId: value.organizationId, actorId: value.actor.session.user.id, action: "USER_ROLE_REVOKED", entityType: "User", entityId: value.user.id, metadata: { roleId: value.role.id } });
  return Response.json({ ok: true });
}
