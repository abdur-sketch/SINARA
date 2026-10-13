import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit, LIMITS, requestIdentity } from "@/lib/rate-limit";
import { sha256 } from "@/lib/security";

const schema = z.object({ token: z.string().min(32), password: z.string().min(14).max(128) });

export async function POST(req: Request) {
  const limit = await checkRateLimit("password-reset-confirm", requestIdentity(req), LIMITS.reset);
  if (!limit.allowed) return Response.json({ error: "Terlalu banyak percobaan" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  const user = await db.user.findFirst({ where: { passwordResetHash: sha256(parsed.data.token), passwordResetExpiry: { gt: new Date() }, isActive: true } });
  if (!user) return Response.json({ error: "Token tidak valid atau kedaluwarsa" }, { status: 400 });
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), passwordResetHash: null, passwordResetExpiry: null, sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null },
  });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: user.id });
  return Response.json({ ok: true });
}
