import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { db } from "@/lib/db";

async function freshActor(id:string){return db.user.findUnique({where:{id},include:{roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}}})}
export function sessionVersionMatches(active:boolean,current:number,session:number){return active&&current===session}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user=await freshActor(session.user.id);
  if(!user||!sessionVersionMatches(user.isActive,user.sessionVersion,session.user.sessionVersion))redirect("/login");
  session.user.roles=user.roles.map(r=>r.role.name);
  session.user.permissions=[...new Set(user.roles.flatMap(r=>r.role.permissions.map(p=>p.permission.key)))];
  session.user.employeeId=user.employeeId;
  return session;
}

export async function requirePermission(permission: PermissionKey) {
  const session = await requireSession();
  if (!hasPermission(session.user.permissions, permission)) redirect("/forbidden");
  return session;
}

export async function requireAnyPermission(permissions: readonly PermissionKey[]) {
  const session = await requireSession();
  if (!permissions.some(permission => hasPermission(session.user.permissions, permission))) redirect("/forbidden");
  return session;
}

export async function getApiActor(permission: PermissionKey) {
  const actor = await getAuthenticatedApiActor();
  if ("error" in actor) return actor;
  if (!hasPermission(actor.session.user.permissions, permission)) return { error: new Response(JSON.stringify({ error: "Akses ditolak" }), { status: 403, headers: { "content-type": "application/json" } }) } as const;
  return actor;
}

export async function getApiActorAny(permissions: readonly PermissionKey[]) {
  const actor = await getAuthenticatedApiActor();
  if ("error" in actor) return actor;
  if (!permissions.some(permission => hasPermission(actor.session.user.permissions, permission))) return { error: new Response(JSON.stringify({ error: "Akses ditolak" }), { status: 403, headers: { "content-type": "application/json" } }) } as const;
  return actor;
}

async function getAuthenticatedApiActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: new Response(JSON.stringify({ error: "Tidak terautentikasi" }), { status: 401, headers: { "content-type": "application/json" } }) } as const;
  const user=await freshActor(session.user.id);
  if(!user||!sessionVersionMatches(user.isActive,user.sessionVersion,session.user.sessionVersion))return {error:Response.json({error:"Sesi tidak berlaku"},{status:401})} as const;
  const permissions=[...new Set(user.roles.flatMap(r=>r.role.permissions.map(p=>p.permission.key)))];
  const roles=user.roles.map(r=>r.role.name);
  Object.assign(session.user,{permissions,roles,organizationId:user.organizationId,employeeId:user.employeeId});
  return { session } as const;
}

export async function requireRecentMfa(permission:PermissionKey){const actor=await getApiActor(permission);if("error" in actor)return actor;const sensitive=actor.session.user.roles.some(r=>["SUPER_ADMIN","YAYASAN","HR_ADMIN","BENDAHARA"].includes(r));if(sensitive&&(!actor.session.user.mfaVerifiedAt||Date.now()-actor.session.user.mfaVerifiedAt>10*60_000))return {error:Response.json({error:"Autentikasi MFA terbaru diperlukan"},{status:403})} as const;return actor}
