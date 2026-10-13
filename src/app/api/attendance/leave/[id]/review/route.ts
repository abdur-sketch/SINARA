import { requireRecentMfa } from "@/lib/access";
import { actorUnitId, findSchedule, leaveAttendanceStatus, reviewSchema } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRecentMfa("leave.review"); if ("error" in actor) return actor.error;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Keputusan tidak valid" }, { status: 400 });
  const { id } = await params; const user = actor.session.user;
  const leave = await db.leaveRequest.findFirst({ where: { id, organizationId: user.organizationId }, include: { leaveType: true, employee: { select: { primaryUnitId: true } } } });
  if (!leave) return Response.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
  if (leave.status !== "PENDING") return Response.json({ error: "Pengajuan sudah diputuskan" }, { status: 409 });
  if (leave.requestedById === user.id) return Response.json({ error: "Pemohon tidak boleh menyetujui pengajuannya sendiri" }, { status: 409 });
  if (!user.permissions.includes("attendance.read.all") && await actorUnitId(user.id) !== leave.employee.primaryUnitId) return Response.json({ error: "Pengajuan berada di luar unit Anda" }, { status: 403 });
  if (parsed.data.action === "APPROVE") {
    const workDates: Date[] = [];
    for (let cursor = new Date(leave.startDate); cursor <= leave.endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = new Date(cursor); const schedule = await findSchedule(user.organizationId, leave.employeeId, date);
      const holiday = await db.holiday.findUnique({ where: { organizationId_date: { organizationId: user.organizationId, date } } });
      if (schedule?.workDays.includes(date.getUTCDay()) && !holiday) workDates.push(date);
    }
    const conflict = await db.attendanceRecord.findFirst({ where: { organizationId: user.organizationId, employeeId: leave.employeeId, date: { in: workDates }, OR: [{ checkInAt: { not: null } }, { status: { in: ["LEAVE", "SICK", "PERMISSION", "OFFICIAL_DUTY"] } }] } });
    if (conflict) return Response.json({ error: "Periode memiliki kehadiran atau ketidakhadiran yang sudah tercatat" }, { status: 409 });
    if (leave.leaveType.annualQuota !== null) {
      const balance = await db.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: leave.startDate.getUTCFullYear() } } });
      const allowance = balance?.allowance ?? leave.leaveType.annualQuota; if ((balance?.used ?? 0) + leave.workDays > allowance) return Response.json({ error: "Saldo cuti tidak lagi mencukupi" }, { status: 409 });
    }
    await db.$transaction(async tx => {
      await tx.leaveRequest.update({ where: { id }, data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date(), reviewerNotes: parsed.data.notes } });
      if (leave.leaveType.annualQuota !== null) await tx.leaveBalance.upsert({ where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: leave.startDate.getUTCFullYear() } }, update: { used: { increment: leave.workDays } }, create: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: leave.startDate.getUTCFullYear(), allowance: leave.leaveType.annualQuota, used: leave.workDays } });
      for (const date of workDates) await tx.attendanceRecord.upsert({ where: { organizationId_employeeId_date: { organizationId: user.organizationId, employeeId: leave.employeeId, date } }, update: { status: leaveAttendanceStatus(leave.leaveType.code), notes: `${leave.leaveType.name}: ${leave.reason}` }, create: { organizationId: user.organizationId, employeeId: leave.employeeId, date, status: leaveAttendanceStatus(leave.leaveType.code), source: "ADMIN", notes: `${leave.leaveType.name}: ${leave.reason}`, manuallyCreatedById: user.id } });
    });
  } else await db.leaveRequest.update({ where: { id }, data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewerNotes: parsed.data.notes } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: `LEAVE_${parsed.data.action}D`, entityType: "LeaveRequest", entityId: id, metadata: { workDays: leave.workDays } });
  return Response.json({ ok: true });
}
