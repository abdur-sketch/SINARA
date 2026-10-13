import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMailer } from "@/lib/mailer";
import { checkRateLimit, LIMITS, requestIdentity } from "@/lib/rate-limit";
import { randomToken, sha256 } from "@/lib/security";

const createSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email(), roleIds: z.array(z.string().uuid()).min(1), employeeId: z.string().uuid().nullable().optional() });

export async function GET(req: Request) {
  const actor = await requireRecentMfa("user.manage");
  if ("error" in actor) return actor.error;
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const active = url.searchParams.get("active");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
  const where: Prisma.UserWhereInput = { organizationId: actor.session.user.organizationId, ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}), ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) };
  const [items, total] = await db.$transaction([db.user.findMany({ where, include: { roles: { include: { role: true } } }, orderBy: { name: "asc" }, skip: (page - 1) * take, take }), db.user.count({ where })]);
  return Response.json({ items, total, page, pages: Math.ceil(total / take) });
}

export async function POST(req: Request) {
  const actor = await requireRecentMfa("user.manage");
  if ("error" in actor) return actor.error;
  const limit = await checkRateLimit("admin-users", requestIdentity(req, actor.session.user.id), LIMITS.admin);
  if (!limit.allowed) return Response.json({ error: "Terlalu banyak perubahan" }, { status: 429 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data pengguna tidak valid" }, { status: 400 });
  const organizationId = actor.session.user.organizationId;
  const roles = await db.role.findMany({ where: { id: { in: parsed.data.roleIds }, organizationId } });
  if (roles.length !== new Set(parsed.data.roleIds).size) return Response.json({ error: "Role tidak valid" }, { status: 400 });
  if (roles.some(role => role.name === "PEGAWAI") && !parsed.data.employeeId) return Response.json({ error: "Role PEGAWAI wajib ditautkan ke data pegawai" }, { status: 400 });
  if (parsed.data.employeeId && !await db.employee.findFirst({ where: { id: parsed.data.employeeId, organizationId }, select: { id: true } })) return Response.json({ error: "Pegawai tidak valid" }, { status: 400 });
  const inviteToken = randomToken(32);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  try {
    const user = await db.user.create({ data: { organizationId, name: parsed.data.name, email: parsed.data.email, employeeId: parsed.data.employeeId, passwordHash: await bcrypt.hash(randomToken(48), 12), passwordResetHash: sha256(inviteToken), passwordResetExpiry: expiresAt, roles: { create: parsed.data.roleIds.map(roleId => ({ roleId })) } } });
    await getMailer().sendPasswordReset({ to: user.email, token: inviteToken, expiresAt });
    await writeAudit({ organizationId, actorId: actor.session.user.id, action: "USER_INVITED", entityType: "User", entityId: user.id, metadata: { roleIds: parsed.data.roleIds } });
    return Response.json({ id: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Email atau pegawai sudah terhubung" }, { status: 409 });
    throw error;
  }
}
