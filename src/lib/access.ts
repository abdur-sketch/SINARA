import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requirePermission(permission: PermissionKey) {
  const session = await requireSession();
  if (!hasPermission(session.user.permissions, permission)) redirect("/forbidden");
  return session;
}

export async function getApiActor(permission: PermissionKey) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: new Response(JSON.stringify({ error: "Tidak terautentikasi" }), { status: 401, headers: { "content-type": "application/json" } }) } as const;
  if (!hasPermission(session.user.permissions, permission)) return { error: new Response(JSON.stringify({ error: "Akses ditolak" }), { status: 403, headers: { "content-type": "application/json" } }) } as const;
  return { session } as const;
}
