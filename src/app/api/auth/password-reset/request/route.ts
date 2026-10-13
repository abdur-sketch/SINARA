import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getMailer } from "@/lib/mailer";
import { checkRateLimit, LIMITS, requestIdentity } from "@/lib/rate-limit";
import { randomToken, sha256 } from "@/lib/security";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const email = parsed.success ? parsed.data.email : "invalid";
  const limit = await checkRateLimit("password-reset", requestIdentity(req, email), LIMITS.reset);
  if (!limit.allowed) return Response.json({ ok: true }, { status: 202 });
  if (!parsed.success) return Response.json({ ok: true }, { status: 202 });

  const user = await db.user.findUnique({ where: { email } });
  if (user?.isActive) {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await db.user.update({
      where: { id: user.id },
      data: { passwordResetHash: sha256(token), passwordResetExpiry: expiresAt },
    });
    await getMailer().sendPasswordReset({ to: user.email, token, expiresAt });
    await writeAudit({ organizationId: user.organizationId, actorId: null, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id });
  }
  return Response.json({ ok: true }, { status: 202 });
}
