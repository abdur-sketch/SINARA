import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, LIMITS, requestIdentity } from "@/lib/rate-limit";
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCodes, mfaLockUntil, protectTotpSecret, verifyTotp } from "@/lib/mfa";
import { decryptSecret, sha256 } from "@/lib/security";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ code: z.string().trim().min(6).max(32) });

export async function POST(req: Request) {
  const ticket = (await cookies()).get("sinur.mfa-ticket")?.value;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!ticket || !parsed.success) return Response.json({ error: "Challenge tidak valid" }, { status: 401 });
  const challenge = await db.authChallenge.findUnique({ where: { tokenHash: sha256(ticket) }, include: { user: true } });
  if (!challenge || !challenge.user.isActive || challenge.verified || challenge.consumedAt || challenge.expiresAt <= new Date()) return Response.json({ error: "Challenge tidak berlaku" }, { status: 401 });
  const limit = await checkRateLimit("mfa", requestIdentity(req, challenge.userId), LIMITS.mfa);
  if (!limit.allowed) return Response.json({ error: "Challenge MFA terkunci sementara", retryAfter: limit.retryAfter }, { status: 429 });
  if (challenge.user.mfaLockedUntil && challenge.user.mfaLockedUntil > new Date()) return Response.json({ error: "MFA terkunci sementara" }, { status: 429 });

  let valid = false;
  let usedRecovery = false;
  let recoveryHashes = (challenge.user.mfaRecoveryHashes as string[] | null) ?? [];
  const encrypted = challenge.purpose === "MFA_ENROLL" ? challenge.user.mfaPendingEncrypted : challenge.user.mfaSecretEncrypted;
  if (encrypted && /^\d{6}$/.test(parsed.data.code)) valid = verifyTotp(parsed.data.code, encrypted);
  if (!valid && challenge.purpose !== "MFA_ENROLL") {
    const remaining = await consumeRecoveryCode(parsed.data.code, recoveryHashes);
    if (remaining) { valid = true; usedRecovery = true; recoveryHashes = remaining; }
  }
  if (!valid) {
    const attempts = challenge.attempts + 1;
    await db.authChallenge.update({ where: { id: challenge.id }, data: { attempts } });
    await db.user.update({ where: { id: challenge.userId }, data: { mfaFailedAttempts: { increment: 1 }, mfaLockedUntil: mfaLockUntil(attempts) } });
    await writeAudit({ organizationId: challenge.user.organizationId, actorId: challenge.userId, action: "MFA_CHALLENGE_FAILED", entityType: "User", entityId: challenge.userId, metadata: { attempts } });
    return Response.json({ error: "Kode MFA tidak valid" }, { status: 401 });
  }

  const claimed = await db.authChallenge.updateMany({ where: { id: challenge.id, verified: false, consumedAt: null }, data: { verified: true } });
  if (claimed.count !== 1) return Response.json({ error: "Challenge sudah digunakan" }, { status: 401 });
  let recoveryCodes: string[] | undefined;
  if (challenge.purpose === "MFA_ENROLL") {
    recoveryCodes = generateRecoveryCodes();
    recoveryHashes = await hashRecoveryCodes(recoveryCodes);
    await db.user.update({ where: { id: challenge.userId }, data: { mfaEnabled: true, mfaSecretEncrypted: protectTotpSecret(decryptSecret(encrypted!)), mfaPendingEncrypted: null, mfaRecoveryHashes: recoveryHashes, mfaFailedAttempts: 0, mfaLockedUntil: null, sessionVersion: { increment: 1 } } });
    await writeAudit({ organizationId: challenge.user.organizationId, actorId: challenge.userId, action: "MFA_ENROLLED", entityType: "User", entityId: challenge.userId });
  } else {
    await db.user.update({ where: { id: challenge.userId }, data: { mfaRecoveryHashes: usedRecovery ? recoveryHashes : undefined, mfaFailedAttempts: 0, mfaLockedUntil: null } });
    await writeAudit({ organizationId: challenge.user.organizationId, actorId: challenge.userId, action: usedRecovery ? "MFA_RECOVERY_USED" : "MFA_CHALLENGE_SUCCESS", entityType: "User", entityId: challenge.userId });
  }
  return Response.json({ proof: ticket, recoveryCodes });
}
