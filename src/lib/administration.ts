import { db } from "@/lib/db";

export async function isLastActiveSuperAdmin(organizationId: string, userId: string) {
  const target = await db.user.findFirst({ where: { id: userId, organizationId, isActive: true, roles: { some: { role: { name: "SUPER_ADMIN" } } } }, select: { id: true } });
  if (!target) return false;
  const count = await db.user.count({ where: { organizationId, isActive: true, roles: { some: { role: { name: "SUPER_ADMIN" } } } } });
  return count <= 1;
}
