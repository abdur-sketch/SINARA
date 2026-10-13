import { getApiActor } from "@/lib/access";
import { correctionSchema, dateOnly } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await getApiActor("attendance.correction.create"); if ("error" in actor) return actor.error;
  const parsed = correctionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Pengajuan koreksi tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const user = actor.session.user; const employeeId = user.permissions.includes("attendance.manage") && parsed.data.employeeId ? parsed.data.employeeId : user.employeeId;
  if (!employeeId) return Response.json({ error: "Akun belum terhubung ke pegawai" }, { status: 409 });
  const employee = await db.employee.findFirst({ where: { id: employeeId, organizationId: user.organizationId, isActive: true } }); if (!employee) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const date = dateOnly(parsed.data.date); const existingPending = await db.attendanceCorrection.findFirst({ where: { organizationId: user.organizationId, employeeId, date, status: "PENDING" } }); if (existingPending) return Response.json({ error: "Koreksi tanggal tersebut masih menunggu keputusan" }, { status: 409 });
  const record = await db.attendanceRecord.findUnique({ where: { organizationId_employeeId_date: { organizationId: user.organizationId, employeeId, date } } });
  const correction = await db.attendanceCorrection.create({ data: { organizationId: user.organizationId, recordId: record?.id, employeeId, date, proposedCheckInAt: parsed.data.proposedCheckIn ? new Date(parsed.data.proposedCheckIn) : null, proposedCheckOutAt: parsed.data.proposedCheckOut ? new Date(parsed.data.proposedCheckOut) : null, reason: parsed.data.reason, requestedById: user.id } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "ATTENDANCE_CORRECTION_REQUESTED", entityType: "AttendanceCorrection", entityId: correction.id, metadata: { employeeId, date: parsed.data.date } });
  return Response.json(correction, { status: 201 });
}
