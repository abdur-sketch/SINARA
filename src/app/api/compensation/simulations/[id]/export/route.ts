import { getApiActor } from "@/lib/access";
import { db } from "@/lib/db";

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getApiActor("compensation.simulation.export");
  if ("error" in actor) return actor.error;
  const { id } = await params;
  const row = await db.compensationSimulation.findFirst({ where: { id, organizationId: actor.session.user.organizationId } });
  if (!row) return Response.json({ error: "Simulasi tidak ditemukan" }, { status: 404 });
  const lines = [
    ["SIMULATION ONLY", "Bukan payroll atau nominal disahkan"],
    ["Nama", row.name], ["Skenario", row.scenario], ["Periode mulai", row.periodStart.toISOString().slice(0, 10)], ["Periode akhir", row.periodEnd.toISOString().slice(0, 10)],
    ["Total gaji pokok", row.totalBaseSalary.toFixed(2)], ["Total tunjangan", row.totalAllowances.toFixed(2)], ["Total kompensasi", row.totalCompensation.toFixed(2)], ["Estimasi biaya pemberi kerja", row.employerCost.toFixed(2)],
  ].map(columns => columns.map(csv).join(",")).join("\r\n");
  return new Response(lines, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="simulation-${row.id}.csv"`, "cache-control": "no-store" } });
}
