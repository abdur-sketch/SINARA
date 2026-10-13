import { Prisma } from "@prisma/client";
import { getApiActor, requireRecentMfa } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { allocateMoney, decimalJson, runSimulation, simulationSchema } from "@/lib/compensation";
import { db } from "@/lib/db";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const actor = await getApiActor("compensation.simulation.run");
  if ("error" in actor) return actor.error;
  return Response.json(await db.compensationSimulation.findMany({ where: { organizationId: actor.session.user.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }));
}

export async function POST(req: Request) {
  const actor = await requireRecentMfa("compensation.simulation.run");
  if ("error" in actor) return actor.error;
  const limited = await enforceAdminRateLimit(req, actor.session.user.id);
  if (limited) return limited;
  const parsed = simulationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Input simulasi tidak valid", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.periodStart > parsed.data.periodEnd) return Response.json({ error: "Periode simulasi tidak valid" }, { status: 400 });
  const organizationId = actor.session.user.organizationId;
  const unitIds = [...new Set(parsed.data.allocations.map(item => item.unitId))];
  const [policy, units] = await Promise.all([
    db.salaryPolicy.findFirst({ where: { id: parsed.data.salaryPolicyId, organizationId }, include: { scales: { where: { jobGradeId: parsed.data.jobGradeId } } } }),
    db.unit.findMany({ where: { organizationId, id: { in: unitIds }, isActive: true }, select: { id: true } }),
  ]);
  if (!policy || policy.scales.length !== 1 || units.length !== unitIds.length) return Response.json({ error: "Kebijakan, golongan, atau unit organisasi tidak valid" }, { status: 400 });
  const result = runSimulation(parsed.data);
  if (!result.allocation.complete) return Response.json({ error: "Alokasi biaya wajib 100% untuk finalisasi simulasi" }, { status: 400 });
  const scale = policy.scales[0];
  const outsidePolicyRange = parsed.data.baseSalary.lessThan(scale.minimum) || parsed.data.baseSalary.greaterThan(scale.maximum);
  const minimumConfig = readMinimumConfig(policy.minimumWageConfig);
  const belowConfiguredMinimum = minimumConfig ? parsed.data.baseSalary.lessThan(minimumConfig.amount) : null;
  const warnings = [outsidePolicyRange ? "Penempatan berada di luar rentang kebijakan." : null, belowConfiguredMinimum === true ? `Potensi di bawah ketentuan minimum terkonfigurasi; verifikasi sumber ${minimumConfig?.source}.` : null, minimumConfig ? null : "Referensi ketentuan minimum belum dikonfigurasi dan harus diverifikasi."].filter(Boolean);
  try {
    const unitCosts = allocateMoney(result.employerCost, parsed.data.allocations);
    const row = await db.compensationSimulation.create({ data: { organizationId, salaryPolicyId: policy.id, name: parsed.data.name, scenario: parsed.data.scenario, periodStart: new Date(parsed.data.periodStart), periodEnd: new Date(parsed.data.periodEnd), assumptions: { employeeCount: parsed.data.employeeCount, jobGradeId: parsed.data.jobGradeId, baseSalary: decimalJson(parsed.data.baseSalary), allowances: decimalJson(parsed.data.allowances), raisePercent: parsed.data.raisePercent, employerCostPercent: parsed.data.employerCostPercent, allocations: parsed.data.allocations }, results: { months: result.months, baseline: decimalJson(result.baseline), change: decimalJson(result.change), allocationTotal: result.allocation.total, unitCosts, outsidePolicyRange, belowConfiguredMinimum, warnings }, totalBaseSalary: result.totalBaseSalary, totalAllowances: result.totalAllowances, totalCompensation: result.totalCompensation, employerCost: result.employerCost, idempotencyKey: parsed.data.idempotencyKey, createdById: actor.session.user.id } });
    await writeAudit({ organizationId, actorId: actor.session.user.id, action: "COMPENSATION_SIMULATION_RUN", entityType: "CompensationSimulation", entityId: row.id, metadata: { scenario: row.scenario, employeeCount: parsed.data.employeeCount, outsidePolicyRange, belowConfiguredMinimum } });
    return Response.json({ ...row, warnings }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Permintaan simulasi duplikat" }, { status: 409 });
    throw error;
  }
}

function readMinimumConfig(value: Prisma.JsonValue | null): { amount: Prisma.Decimal; source: string } | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const amount = value.amount; const source = value.source;
  if ((typeof amount !== "string" && typeof amount !== "number") || typeof source !== "string") return null;
  return { amount: new Prisma.Decimal(amount), source };
}
