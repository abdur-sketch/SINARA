import { createHmac, timingSafeEqual } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const emailIndex = process.argv.indexOf("--email");
const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : undefined;

async function main() {
  const encryptionKey = process.env.MFA_ENCRYPTION_KEY;
  const supplied = process.env.MFA_RECOVERY_AUTH;
  if (!email || !encryptionKey || !supplied) throw new Error("Gunakan --email dan set MFA_ENCRYPTION_KEY serta MFA_RECOVERY_AUTH.");
  const expected = createHmac("sha256", encryptionKey).update(`reset-mfa:${email}`).digest("hex");
  const valid = supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) throw new Error("Otorisasi recovery tidak valid.");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaPendingEncrypted: null, mfaRecoveryHashes: Prisma.DbNull, mfaFailedAttempts: 0, mfaLockedUntil: null, sessionVersion: { increment: 1 } } }),
    db.auditLog.create({ data: { organizationId: user.organizationId, action: "MFA_ADMIN_RECOVERY", entityType: "User", entityId: user.id, metadata: { channel: "local-cli" } } }),
  ]);
  console.info(`MFA dinonaktifkan dan seluruh sesi dicabut untuk ${email}.`);
}

main().finally(() => db.$disconnect());
