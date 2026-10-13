import { createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual } from "crypto";

export function sha256(value:string){return createHash("sha256").update(value).digest("hex")}
export function randomToken(bytes=32){return randomBytes(bytes).toString("base64url")}
function encryptionKey(){const raw=process.env.MFA_ENCRYPTION_KEY;if(!raw)throw new Error("MFA_ENCRYPTION_KEY belum dikonfigurasi");const key=Buffer.from(raw,"base64");if(key.length!==32)throw new Error("MFA_ENCRYPTION_KEY harus 32 byte Base64");return key}
export function encryptSecret(value:string){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".")}
export function decryptSecret(value:string){const [version,iv,tag,data]=value.split(".");if(version!=="v1"||!iv||!tag||!data)throw new Error("Format secret tidak valid");const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64url"));decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8")}
export function safeEqual(a:string,b:string){const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
