import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { writeAudit } from "./audit";

process.env.DATABASE_URL ||= "postgresql://sinur:change-me@localhost:5432/sinur_hrm_dev";
const db = new PrismaClient();
let orgA = "", orgB = "", userA = "", gradeB = "", policyB = "";

beforeAll(async () => {
  const [a, b] = await Promise.all([
    db.organization.upsert({ where: { code: "COMP_TEST_A" }, update: { name: "Compensation Test A" }, create: { code: "COMP_TEST_A", name: "Compensation Test A" } }),
    db.organization.upsert({ where: { code: "COMP_TEST_B" }, update: { name: "Compensation Test B" }, create: { code: "COMP_TEST_B", name: "Compensation Test B" } }),
  ]); orgA = a.id; orgB = b.id;
  const [actor, grade] = await Promise.all([
    db.user.upsert({ where: { email: "comp-test-a@example.test" }, update: { organizationId: orgA }, create: { organizationId: orgA, email: "comp-test-a@example.test", name: "Comp Test A", passwordHash: "not-a-login-credential" } }),
    db.jobGrade.upsert({ where: { organizationId_code: { organizationId: orgB, code: "COMP-B-I" } }, update: { name: "Synthetic B I" }, create: { organizationId: orgB, code: "COMP-B-I", name: "Synthetic B I", level: 901, minimumScore: 1, maximumScore: 5 } }),
  ]); userA = actor.id; gradeB = grade.id;
  const creatorB = await db.user.upsert({ where: { email: "comp-test-b@example.test" }, update: { organizationId: orgB }, create: { organizationId: orgB, email: "comp-test-b@example.test", name: "Comp Test B", passwordHash: "not-a-login-credential" } });
  const policy = await db.salaryPolicy.upsert({ where: { organizationId_name_version: { organizationId: orgB, name: "Synthetic Policy B", version: 1 } }, update: {}, create: { organizationId: orgB, name: "Synthetic Policy B", version: 1, periodStart: new Date("2026-01-01"), effectiveDate: new Date("2026-01-01"), createdById: creatorB.id, scales: { create: { jobGradeId: gradeB, minimum: 1000, midpoint: 1500, maximum: 2000 } } } });
  policyB = policy.id;
});

afterAll(() => db.$disconnect());

describe("compensation database safeguards", () => {
  it("isolates salary policy from another organization", async () => expect(await db.salaryPolicy.findFirst({ where: { id: policyB, organizationId: orgA } })).toBeNull());
  it("enforces policy version uniqueness", async () => {
    await expect(db.salaryPolicy.create({ data: { organizationId: orgB, name: "Synthetic Policy B", version: 1, periodStart: new Date("2027-01-01"), effectiveDate: new Date("2027-01-01"), createdById: userA } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("enforces duplicate simulation request protection", async () => {
    await db.compensationSimulation.upsert({ where: { organizationId_idempotencyKey: { organizationId: orgA, idempotencyKey: "integration-duplicate-key" } }, update: {}, create: { organizationId: orgA, name: "Synthetic simulation", scenario: "BASELINE", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), assumptions: {}, results: {}, totalBaseSalary: 100, totalAllowances: 0, totalCompensation: 100, employerCost: 100, idempotencyKey: "integration-duplicate-key", createdById: userA } });
    await expect(db.compensationSimulation.create({ data: { organizationId: orgA, name: "Duplicate", scenario: "BASELINE", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), assumptions: {}, results: {}, totalBaseSalary: 100, totalAllowances: 0, totalCompensation: 100, employerCost: 100, idempotencyKey: "integration-duplicate-key", createdById: userA } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("writes a scoped, redacted compensation audit record", async () => {
    await writeAudit({ organizationId: orgA, actorId: userA, action: "COMPENSATION_TEST_AUDIT", entityType: "CompensationSimulation", entityId: "synthetic", metadata: { token: "must-not-leak", outcome: "ok" } });
    const row = await db.auditLog.findFirstOrThrow({ where: { organizationId: orgA, action: "COMPENSATION_TEST_AUDIT" }, orderBy: { createdAt: "desc" } });
    expect(row.metadata).toEqual({ token: "[REDACTED]", outcome: "ok" } satisfies Prisma.JsonObject);
  });
});
