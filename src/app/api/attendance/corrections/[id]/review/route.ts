import { requireRecentMfa } from "@/lib/access";
import { actorUnitId, calculateAttendance, findSchedule, jakartaTime, reviewSchema } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("attendance.correction.review"); if ("error" in actor) return actor.error;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Keputusan tidak valid" }, { status: 400 });
  const { id } = await params; const user = actor.session.user;
  const correction = await db.attendanceCorrection.findFirst({ where: { id, organizationId: user.organizationId }, include: { record: true, employee: { select: { primaryUnitId: true } } } });
  if (!correction) return Response.json({ error: "Koreksi tidak ditemukan" }, { status: 404 });
  if (correction.status !== "PENDING") return Response.json({ error: "Koreksi sudah diputuskan" }, { status: 409 });
  if (correction.requestedById === user.id) return Response.json({ error: "Pemohon tidak boleh menyetujui koreksinya sendiri" }, { status: 409 });
  if (!user.permissions.includes("attendance.read.all") && await actorUnitId(user.id) !== correction.employee.primaryUnitId) return Response.json({ error: "Koreksi berada di luar unit Anda" }, { status: 403 });
  if (parsed.data.action === "APPROVE") {
    const checkInAt = correction.proposedCheckInAt ?? correction.record?.checkInAt ?? null; const checkOutAt = correction.proposedCheckOutAt ?? correction.record?.checkOutAt ?? null;
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) return Response.json({ error: "Check-out harus setelah check-in" }, { status: 400 });
    const schedule = await findSchedule(user.organizationId, correction.employeeId, correction.date); const dateKey = correction.date.toISOString().slice(0, 10);
    const metrics = checkInAt && schedule ? calculateAttendance(checkInAt, checkOutAt, jakartaTime(dateKey, schedule.startMinute), schedule.lateTolerance, schedule.breakMinutes) : { lateMinutes: 0, workMinutes: 0, status: "PRESENT" as const };
    await db.$transaction(async tx => {
      const record = await tx.attendanceRecord.upsert({ where: { organizationId_employeeId_date: { organizationId: user.organizationId, employeeId: correction.employeeId, date: correction.date } }, update: { checkInAt, checkOutAt, scheduleId: schedule?.id, status: metrics.status, lateMinutes: metrics.lateMinutes, workMinutes: metrics.workMinutes }, create: { organizationId: user.organizationId, employeeId: correction.employeeId, date: correction.date, checkInAt, checkOutAt, scheduleId: schedule?.id, status: metrics.status, lateMinutes: metrics.lateMinutes, workMinutes: metrics.workMinutes, source: "ADMIN", manuallyCreatedById: user.id } });
      await tx.attendanceCorrection.update({ where: { id }, data: { status: "APPROVED", recordId: record.id, reviewedById: user.id, reviewedAt: new Date(), reviewerNotes: parsed.data.notes } });
    });
  } else await db.attendanceCorrection.update({ where: { id }, data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewerNotes: parsed.data.notes } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: `ATTENDANCE_CORRECTION_${parsed.data.action}D`, entityType: "AttendanceCorrection", entityId: id });
  return Response.json({ ok: true });
}
