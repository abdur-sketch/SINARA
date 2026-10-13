import bcrypt from "bcryptjs";
import { Authenticator } from "@otplib/v12-adapter";
import { Prisma, PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/lib/security";

export const E2E_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const db = new PrismaClient();

export default async function globalSetup() {
  const organization = await db.organization.findUnique({ where: { code: "YNI" } });
  if (!organization) throw new Error("Jalankan migrasi dan seed development sebelum E2E.");
  const role = await db.role.findUniqueOrThrow({ where: { organizationId_name: { organizationId: organization.id, name: "SUPER_ADMIN" } } });
  const passwordHash = await bcrypt.hash(process.env.E2E_ADMIN_PASSWORD!, 12);
  const recovery = await bcrypt.hash("RECOV-E2E-2026", 10);
  for (const [email, enrolled] of [[process.env.E2E_ADMIN_EMAIL!, true], [process.env.E2E_EMPLOYEE_EMAIL!, true], [`e2e-enroll-desktop-${process.env.E2E_RUN_ID}@example.test`, false], [`e2e-enroll-mobile-${process.env.E2E_RUN_ID}@example.test`, false]] as const) {
    const user = await db.user.upsert({
      where: { email },
      update: { organizationId: organization.id, name: "Administrator E2E Sintetis", passwordHash, isActive: true, mfaEnabled: enrolled, mfaSecretEncrypted: enrolled ? encryptSecret(E2E_TOTP_SECRET) : null, mfaPendingEncrypted: null, mfaRecoveryHashes: enrolled ? [recovery] : Prisma.DbNull, failedLoginAttempts: 0, lockedUntil: null, mfaFailedAttempts: 0, mfaLockedUntil: null, sessionVersion: { increment: 1 } },
      create: { organizationId: organization.id, email, name: "Administrator E2E Sintetis", passwordHash, mfaEnabled: enrolled, mfaSecretEncrypted: enrolled ? encryptSecret(E2E_TOTP_SECRET) : null, mfaRecoveryHashes: enrolled ? [recovery] : Prisma.DbNull },
    });
    await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  }
  new Authenticator().generate(E2E_TOTP_SECRET);
  await db.$disconnect();
}
