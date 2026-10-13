import bcrypt from "bcryptjs";
import { Authenticator } from "@otplib/v12-adapter";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "@/lib/security";

const authenticator = new Authenticator({ window: 1 });
export const MFA_ROLES = new Set(["SUPER_ADMIN", "YAYASAN", "HR_ADMIN", "BENDAHARA"]);
export function mfaLockUntil(attempts:number,now=Date.now()){return attempts>=5?new Date(now+15*60_000):null}
export function requiresMfa(roles: string[]) { return roles.some(role => MFA_ROLES.has(role)); }
export function newTotpSecret() { return authenticator.generateSecret(); }
export function totpUri(email: string, secret: string) { return authenticator.keyuri(email, "SINUR HRM", secret); }
export function verifyTotp(code: string, encrypted: string) { return authenticator.check(code.replace(/\s/g, ""), decryptSecret(encrypted)); }
export function protectTotpSecret(secret: string) { return encryptSecret(secret); }
export async function createChallenge(userId: string, purpose: string, verified = false) {
  const token = randomToken();
  await db.authChallenge.create({ data: { userId, purpose, verified, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return token;
}
export async function consumeVerifiedProof(raw: string) {
  const challenge = await db.authChallenge.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!challenge || !challenge.verified || challenge.consumedAt || challenge.expiresAt <= new Date()) return null;
  const consumed = await db.authChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return null;
  return db.user.findUnique({
    where: { id: challenge.userId },
    include: {
      roles: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });
}
export async function hashRecoveryCodes(codes: string[]) { return Promise.all(codes.map(code => bcrypt.hash(code, 10))); }
export function generateRecoveryCodes() { return Array.from({ length: 8 }, () => `${randomToken(5).slice(0, 5)}-${randomToken(5).slice(0, 5)}`.toUpperCase()); }
export async function consumeRecoveryCode(code: string, hashes: string[]) { for (let i = 0; i < hashes.length; i++) if (await bcrypt.compare(code.toUpperCase(), hashes[i])) return hashes.filter((_, index) => index !== i); return null; }
