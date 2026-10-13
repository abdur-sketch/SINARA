import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const fileArg = process.argv.indexOf("--file");
const explicit = fileArg >= 0 ? process.argv[fileArg + 1] : undefined;
const directory = path.resolve("backups");
const latest = existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith(".dump")).sort().at(-1) : undefined;
const backup = path.resolve(explicit ?? (latest ? path.join(directory, latest) : ""));
if (!backup || !existsSync(backup)) throw new Error("Backup tidak ditemukan. Jalankan npm run db:backup atau gunakan --file.");
const target = `sinur_hrm_restore_${Date.now()}`; const admin = process.env.LOCAL_POSTGRES_ADMIN_URL ?? "postgresql:///postgres"; const targetUrl = admin.replace(/\/[^/?]*(\?.*)?$/, `/${target}`);
if (!target.startsWith("sinur_hrm_restore_")) throw new Error("Target restore tidak aman.");
execFileSync("createdb", [`--maintenance-db=${admin}`, target], { stdio: "inherit" });
try {
  execFileSync("pg_restore", ["--dbname", targetUrl, "--no-owner", "--no-privileges", backup], { stdio: "inherit" });
  const count = execFileSync("psql", [targetUrl, "-Atc", "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"], { encoding: "utf8" }).trim();
  console.info(`Restore terverifikasi pada ${target}: ${count} tabel.`);
} finally {
  if (!process.argv.includes("--keep")) { execFileSync("dropdb", [`--maintenance-db=${admin}`, target], { stdio: "inherit" }); console.info(`Database verifikasi ${target} telah dihapus.`); }
}
