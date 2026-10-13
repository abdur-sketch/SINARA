import { Prisma } from "@prisma/client";
import { getApiActor } from "@/lib/access";
import { calculateAttendance, clockSchema, dateOnly, findSchedule, jakartaDate, jakartaTime } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await getApiActor("attendance.checkin"); if ("error" in actor) return actor.error;
  const parsed = clockSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Aksi absensi tidak valid" }, { status: 400 });
  const user = actor.session.user; if (!user.employeeId) return Response.json({ error: "Akun belum terhubung ke data pegawai" }, { status: 409 });
  const employee = await db.employee.findFirst({ where: { id: user.employeeId, organizationId: user.organizationId, isActive: true } }); if (!employee) return Response.json({ error: "Data pegawai aktif tidak ditemukan" }, { status: 404 });
  const now = new Date(); const dateKey = jakartaDate(now); const date = dateOnly(dateKey);
  if (await db.holiday.findUnique({ where: { organizationId_date: { organizationId: user.organizationId, date } } })) return Response.json({ error: "Hari ini tercatat sebagai hari libur" }, { status: 409 });
  const schedule = await findSchedule(user.organizationId, employee.id, date); if (!schedule || !schedule.workDays.includes(date.getUTCDay())) return Response.json({ error: "Tidak ada jadwal kerja aktif hari ini" }, { status: 409 });
  const existing = await db.attendanceRecord.findUnique({ where: { organizationId_employeeId_date: { organizationId: user.organizationId, employeeId: employee.id, date } } });
  if (parsed.data.action === "CHECK_IN") {
    if (existing?.checkInAt) return Response.json({ error: "Check-in hari ini sudah tercatat" }, { status: 409 });
    const metrics = calculateAttendance(now, null, jakartaTime(dateKey, schedule.startMinute), schedule.lateTolerance, schedule.breakMinutes);
    try {
      const record = existing ? await db.attendanceRecord.update({ where: { id: existing.id }, data: { checkInAt: now, scheduleId: schedule.id, status: metrics.status, lateMinutes: metrics.lateMinutes } }) : await db.attendanceRecord.create({ data: { organizationId: user.organizationId, employeeId: employee.id, scheduleId: schedule.id, date, checkInAt: now, status: metrics.status, lateMinutes: metrics.lateMinutes, source: "WEB" } });
      await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "ATTENDANCE_CHECKED_IN", entityType: "AttendanceRecord", entityId: record.id, metadata: { date: dateKey, lateMinutes: metrics.lateMinutes } });
      return Response.json(record, { status: 201 });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Check-in hari ini sudah tercatat" }, { status: 409 }); throw error; }
  }
  if (!existing?.checkInAt) return Response.json({ error: "Check-in harus dilakukan terlebih dahulu" }, { status: 409 });
  if (existing.checkOutAt) return Response.json({ error: "Check-out hari ini sudah tercatat" }, { status: 409 });
  const metrics = calculateAttendance(existing.checkInAt, now, jakartaTime(dateKey, schedule.startMinute), schedule.lateTolerance, schedule.breakMinutes);
  const record = await db.attendanceRecord.update({ where: { id: existing.id }, data: { checkOutAt: now, workMinutes: metrics.workMinutes } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "ATTENDANCE_CHECKED_OUT", entityType: "AttendanceRecord", entityId: record.id, metadata: { date: dateKey, workMinutes: metrics.workMinutes } });
  return Response.json(record);
}
