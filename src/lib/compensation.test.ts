import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { allocateMoney, componentSchema, DEFAULT_FACTORS, factorSchema, periodsOverlap, policySchema, runSimulation, scaleSchema, simulationSchema, calculateJobScore, validateAllocation } from "./compensation";

describe("compensation domain rules", () => {
  it("calculates a weighted score with decimal precision", () => {
    expect(calculateJobScore({ responsibility: 4, competency: 3, complexity: 4, impact: 3, independence: 3 }, DEFAULT_FACTORS).toFixed(2)).toBe("3.50");
  });
  it("requires factor weights to total 100 percent", () => expect(factorSchema.safeParse(DEFAULT_FACTORS.map(x => ({ ...x, weight: 10 }))).success).toBe(false));
  it("requires minimum, midpoint and maximum ordering", () => expect(scaleSchema.safeParse({ jobGradeId: crypto.randomUUID(), minimum: 200, midpoint: 100, maximum: 300 }).success).toBe(false));
  it("rejects negative monetary values", () => expect(scaleSchema.safeParse({ jobGradeId: crypto.randomUUID(), minimum: -1, midpoint: 100, maximum: 300 }).success).toBe(false));
  it("detects overlapping effective periods", () => expect(periodsOverlap(new Date("2026-01-01"), new Date("2026-12-31"), new Date("2026-12-01"), null)).toBe(true));
  it("requires a traceable source for configured minimum wage", () => expect(policySchema.safeParse({ name: "Policy", version: 1, periodStart: "2026-01-01", effectiveDate: "2026-01-01", minimumWageConfig: { amount: 1000, source: "", verifiedAt: "2026-01-01" }, scales: [{ jobGradeId: crypto.randomUUID(), minimum: 1, midpoint: 2, maximum: 3 }] }).success).toBe(false));
  it("keeps legal classification as explicit notes, not an assumption", () => expect(componentSchema.parse({ code: "TUN", name: "Tunjangan", type: "FIXED_ALLOWANCE", method: "MANUAL", effectiveDate: "2026-01-01" }).legalNotes).toBeUndefined());
  it("requires complete allocation unless explicitly incomplete", () => { expect(validateAllocation([{ percentage: 90 }]).valid).toBe(false); expect(validateAllocation([{ percentage: 90 }], true).valid).toBe(true); });
  it("assigns rounding remainder without duplicating cross-unit cost", () => { const rows=allocateMoney(new Prisma.Decimal("4473.35"),[{unitId:"a",percentage:70},{unitId:"b",percentage:30}]);expect(rows).toEqual([{unitId:"a",percentage:70,cost:"3131.35"},{unitId:"b",percentage:30,cost:"1342.00"}]); });
  it("uses decimal math and does not mutate inputs", () => {
    const input = { name: "Scenario", scenario: "CUSTOM" as const, salaryPolicyId: crypto.randomUUID(), jobGradeId: crypto.randomUUID(), employeeCount: 3, baseSalary: "1000.10", allowances: 0, raisePercent: 10, employerCostPercent: 0, periodStart: "2026-01-01", periodEnd: "2026-01-01", idempotencyKey: "unique-123", allocations: [{ unitId: crypto.randomUUID(), percentage: 100 }] };
    const before = structuredClone(input); const result = runSimulation(simulationSchema.parse(input));
    expect(result.totalBaseSalary.toFixed(2)).toBe("3300.33"); expect(input).toEqual(before);
  });
});
