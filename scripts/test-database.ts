import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export function testDatabaseUrl(kind: "vitest" | "e2e", runId: string) {
  const base = process.env.TEST_DATABASE_BASE_URL ?? "postgresql://sinur:change-me@localhost:5432/sinur_hrm_dev";
  const url = new URL(base);
  const database = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || database !== "sinur_hrm_dev") throw new Error("Test database hanya boleh memakai sinur_hrm_dev lokal.");
  const safeRunId = runId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  url.searchParams.set("schema", `sinara_${kind}_${safeRunId}`);
  return url.toString();
}

export async function prepareTestDatabase(seed = false) {
  const { schema } = validatedTarget();
  const admin = adminClient();
  await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await admin.$disconnect();
  execFileSync("./node_modules/.bin/prisma", ["migrate", "deploy"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  if (seed) execFileSync("./node_modules/.bin/prisma", ["db", "seed"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
}

export async function cleanupTestDatabase() {
  const { schema } = validatedTarget();
  const admin = adminClient();
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
}

function validatedTarget() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL test tidak tersedia.");
  const url = new URL(value);
  const database = url.pathname.replace(/^\//, "");
  const schema = url.searchParams.get("schema") ?? "";
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || database !== "sinur_hrm_dev" || !/^sinara_(vitest|e2e)_[a-z0-9]+$/.test(schema)) throw new Error("Menolak operasi pada database non-test.");
  return { url, schema };
}

function adminClient() {
  const { url } = validatedTarget();
  url.searchParams.set("schema", "public");
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}
