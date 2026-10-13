import { readFile } from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDevelopmentOutbox, getMailer, readDevelopmentOutbox } from "./mailer";
import { quarantineScan, validateFileSignature } from "./documents";
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCodes, mfaLockUntil, newTotpSecret, protectTotpSecret, verifyTotp } from "./mfa";
import { sessionVersionMatches } from "./access";
import { decryptSecret, encryptSecret } from "./security";
import { Authenticator } from "@otplib/v12-adapter";

beforeEach(() => { process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); process.env.MAILER_ADAPTER = "fake"; clearDevelopmentOutbox(); });

describe("MFA", () => {
  it("mengenkripsi secret dan memvalidasi TOTP", () => { const secret = newTotpSecret(); const encrypted = protectTotpSecret(secret); expect(encrypted).not.toContain(secret); expect(decryptSecret(encrypted)).toBe(secret); expect(verifyTotp(new Authenticator({ window: 1 }).generate(secret), encrypted)).toBe(true); });
  it("recovery code hanya dapat dipakai sekali", async () => { const code = generateRecoveryCodes()[0]; const hashes = await hashRecoveryCodes([code]); const remaining = await consumeRecoveryCode(code, hashes); expect(remaining).toEqual([]); expect(await consumeRecoveryCode(code, remaining!)).toBeNull(); });
  it("ciphertext memakai nonce sehingga berbeda", () => expect(encryptSecret("same")).not.toBe(encryptSecret("same")));
  it("mengunci challenge setelah lima kegagalan", () => { expect(mfaLockUntil(4,0)).toBeNull(); expect(mfaLockUntil(5,0)?.getTime()).toBe(15*60_000); });
});

describe("session revocation",()=>{it("menolak session version lama dan akun nonaktif",()=>{expect(sessionVersionMatches(true,2,1)).toBe(false);expect(sessionVersionMatches(false,1,1)).toBe(false);expect(sessionVersionMatches(true,2,2)).toBe(true)})});

describe("dokumen", () => {
  it("memeriksa magic bytes", () => { expect(validateFileSignature(Uint8Array.from([0x25,0x50,0x44,0x46,0x2d]), "application/pdf").valid).toBe(true); expect(validateFileSignature(Uint8Array.from([0x4d,0x5a]), "application/pdf").valid).toBe(false); });
  it("menolak signature EICAR", () => expect(quarantineScan(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")).status).toBe("REJECTED"));
});

describe("mailer", () => { it("menyimpan reset hanya di outbox development tanpa logging", async () => { await getMailer().sendPasswordReset({ to: "synthetic@example.test", token: "secret", expiresAt: new Date() }); expect(readDevelopmentOutbox()).toHaveLength(1); }); });

describe("PWA", () => { it("hanya melakukan cache aset publik eksplisit", async () => { const source = await readFile(path.join(process.cwd(), "public/sw.js"), "utf8"); expect(source).toContain('PUBLIC_ASSETS = ["/offline.html", "/icons/icon.svg"]'); expect(source).not.toMatch(/cache\.put|\/api\/|\/documents\//); }); });
