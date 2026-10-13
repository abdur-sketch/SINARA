import { z } from "zod";
import { requireRecentMfa } from "@/lib/access";
import { calculateAttendance, dateOnly, findSchedule, jakartaTime } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

const schema = z.object({ employeeId: z.string().uuid(), date: z.string().date(), checkIn: z.string().datetime({ offset: true }).nullable().optional(), checkOut: z.string().datetime({ offset: true }).nullable().optional(), status: z.enum(["PRESENT", "LATE", "ABSENT", "LEAVE", "SICK", "PERMISSION", "OFFICIAL_DUTY", "HOLIDAY"]), notes: z.string().trim().max(1000).optional() });

export async function POST(request: Request) {
  const actor = await requireRecentMfa("attendance.manage"); if ("error" in actor) return actor.error;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Catatan absensi tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data; const organizationId = actor.session.user.organizationId; const date = dateOnly(data.date);
  const employee = await db.employee.findFirst({ where: { id: data.employeeId, organizationId, isActive: true } }); if (!employee) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const schedule = await findSchedule(organizationId, employee.id, date); const checkInAt = data.checkIn ? new Date(data.checkIn) : null; const checkOutAt = data.checkOut ? new Date(data.checkOut) : null;
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) return Response.json({ error: "Check-out harus setelah check-in" }, { status: 400 });
  const metrics = checkInAt && schedule ? calculateAttendance(checkInAt, checkOutAt, jakartaTime(data.date, schedule.startMinute), schedule.lateTolerance, schedule.breakMinutes) : { lateMinutes: 0, workMinutes: 0 };
  const record = await db.attendanceRecord.upsert({ where: { organizationId_employeeId_date: { organizationId, employeeId: employee.id, date } }, update: { checkInAt, checkOutAt, status: data.status, lateMinutes: metrics.lateMinutes, workMinutes: metrics.workMinutes, notes: data.notes, scheduleId: schedule?.id, source: "ADMIN", manuallyCreatedById: actor.session.user.id }, create: { organizationId, employeeId: employee.id, scheduleId: schedule?.id, date, checkInAt, checkOutAt, status: data.status, lateMinutes: metrics.lateMinutes, workMinutes: metrics.workMinutes, notes: data.notes, source: "ADMIN", manuallyCreatedById: actor.session.user.id } });
  await writeAudit({ organizationId, actorId: actor.session.user.id, action: "ATTENDANCE_MANUALLY_RECORDED", entityType: "AttendanceRecord", entityId: record.id, metadata: { employeeId: employee.id, date: data.date, status: data.status } });
  return Response.json(record, { status: 201 });
}
