import { getApiActor } from "@/lib/access";
import { actorUnitId, dateOnly, employeeScope, jakartaDate } from "@/lib/attendance";
import { db } from "@/lib/db";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: Request) {
  const actor = await getApiActor("attendance.report.export"); if ("error" in actor) return actor.error;
  const params = new URL(request.url).searchParams; const today = jakartaDate(); const defaultStart = `${today.slice(0, 8)}01`;
  const start = params.get("start") ?? defaultStart; const end = params.get("end") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return Response.json({ error: "Periode tidak valid" }, { status: 400 });
  const unitId = await actorUnitId(actor.session.user.id); const scope = employeeScope(actor.session.user, unitId);
  const rows = await db.attendanceRecord.findMany({ where: { organizationId: actor.session.user.organizationId, date: { gte: dateOnly(start), lte: dateOnly(end) }, employee: scope }, include: { employee: { include: { primaryUnit: { select: { name: true } } } } }, orderBy: [{ date: "asc" }, { employee: { fullName: "asc" } }] });
  const header = ["Tanggal", "NIP", "Nama", "Unit", "Status", "Check-in", "Check-out", "Terlambat (menit)", "Durasi kerja (menit)"];
  const lines = [header.map(csv).join(","), ...rows.map(row => [row.date.toISOString().slice(0, 10), row.employee.employeeNumber, row.employee.fullName, row.employee.primaryUnit.name, row.status, row.checkInAt?.toISOString(), row.checkOutAt?.toISOString(), row.lateMinutes, row.workMinutes].map(csv).join(","))];
  return new Response(`\uFEFF${lines.join("\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rekap-absensi-${start}-${end}.csv"`, "cache-control": "no-store" } });
}
