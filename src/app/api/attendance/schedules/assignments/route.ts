import { requireRecentMfa } from "@/lib/access";
import { scheduleAssignmentSchema, dateOnly } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await requireRecentMfa("attendance.schedule.manage"); if ("error" in actor) return actor.error;
  const parsed = scheduleAssignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Penugasan jadwal tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const organizationId = actor.session.user.organizationId; const data = parsed.data;
  const [employee, schedule] = await Promise.all([db.employee.findFirst({ where: { id: data.employeeId, organizationId, isActive: true } }), db.workSchedule.findFirst({ where: { id: data.scheduleId, organizationId, isActive: true } })]);
  if (!employee || !schedule) return Response.json({ error: "Pegawai atau jadwal tidak ditemukan" }, { status: 404 });
  const from = dateOnly(data.effectiveFrom); const to = data.effectiveTo ? dateOnly(data.effectiveTo) : null;
  const overlap = await db.workScheduleAssignment.findFirst({ where: { employeeId: employee.id, effectiveFrom: { lte: to ?? new Date("9999-12-31") }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] } });
  if (overlap) return Response.json({ error: "Periode jadwal pegawai bertumpang tindih" }, { status: 409 });
  const assignment = await db.workScheduleAssignment.create({ data: { employeeId: employee.id, scheduleId: schedule.id, effectiveFrom: from, effectiveTo: to } });
  await writeAudit({ organizationId, actorId: actor.session.user.id, action: "WORK_SCHEDULE_ASSIGNED", entityType: "WorkScheduleAssignment", entityId: assignment.id, metadata: { employeeId: employee.id, scheduleId: schedule.id } });
  return Response.json(assignment, { status: 201 });
}
