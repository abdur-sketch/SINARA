import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL tidak tersedia.");
const url = new URL(databaseUrl); const database = url.pathname.replace(/^\//, "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || database !== "sinur_hrm_dev") throw new Error("Backup hanya diizinkan untuk sinur_hrm_dev lokal.");
url.searchParams.delete("schema");
const directory = path.resolve("backups"); mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-"); const output = path.join(directory, `sinara-dev-${stamp}.dump`);
execFileSync("pg_dump", ["--dbname", url.toString(), "--format=custom", "--no-owner", "--no-privileges", "--file", output], { stdio: "inherit" });
console.info(`Backup development dibuat: ${output}`);
