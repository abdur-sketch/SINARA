import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getApiActor } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { consumeRecoveryCode, mfaLockUntil, verifyTotp } from "@/lib/mfa";
import { checkRateLimit, LIMITS, requestIdentity } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(12).max(128), code: z.string().trim().min(6).max(32) });

export async function POST(req: Request) {
  const actor = await getApiActor("organization.read"); if ("error" in actor) return actor.error;
  const limit=await checkRateLimit("mfa-reset",requestIdentity(req,actor.session.user.id),LIMITS.mfa);if(!limit.allowed)return Response.json({error:"Terlalu banyak percobaan"},{status:429});
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Autentikasi ulang tidak valid" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: actor.session.user.id } });
  if (!user?.mfaEnabled || !user.mfaSecretEncrypted || (user.mfaLockedUntil&&user.mfaLockedUntil>new Date())) return Response.json({ error: "Autentikasi ulang gagal" }, { status: 401 });
  const passwordValid=await bcrypt.compare(parsed.data.password,user.passwordHash);
  let valid = /^\d{6}$/.test(parsed.data.code) && verifyTotp(parsed.data.code, user.mfaSecretEncrypted);
  if (!valid) valid = Boolean(await consumeRecoveryCode(parsed.data.code, (user.mfaRecoveryHashes as string[] | null) ?? []));
  if (!valid||!passwordValid){const attempts=user.mfaFailedAttempts+1;await db.user.update({where:{id:user.id},data:{mfaFailedAttempts:attempts,mfaLockedUntil:mfaLockUntil(attempts)}});await writeAudit({organizationId:user.organizationId,actorId:user.id,action:"MFA_RESET_FAILED",entityType:"User",entityId:user.id});return Response.json({ error: "Autentikasi ulang gagal" }, { status: 401 });}
  await db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaPendingEncrypted: null, mfaRecoveryHashes: Prisma.DbNull, mfaFailedAttempts: 0, mfaLockedUntil: null, sessionVersion: { increment: 1 } } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "MFA_RESET_SELF", entityType: "User", entityId: user.id });
  return Response.json({ ok: true });
}
