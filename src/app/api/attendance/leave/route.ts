import { getApiActor } from "@/lib/access";
import { countWorkDays, dateOnly, leaveSchema } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await getApiActor("leave.create"); if ("error" in actor) return actor.error;
  const parsed = leaveSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Pengajuan cuti/izin tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const user = actor.session.user; const employeeId = user.permissions.includes("leave.manage") && parsed.data.employeeId ? parsed.data.employeeId : user.employeeId;
  if (!employeeId) return Response.json({ error: "Akun belum terhubung ke pegawai" }, { status: 409 });
  const startDate = dateOnly(parsed.data.startDate); const endDate = dateOnly(parsed.data.endDate);
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) return Response.json({ error: "Pengajuan lintas tahun harus dipisahkan" }, { status: 400 });
  const [employee, leaveType, overlap] = await Promise.all([
    db.employee.findFirst({ where: { id: employeeId, organizationId: user.organizationId, isActive: true } }),
    db.leaveType.findFirst({ where: { id: parsed.data.leaveTypeId, organizationId: user.organizationId, isActive: true } }),
    db.leaveRequest.findFirst({ where: { organizationId: user.organizationId, employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: endDate }, endDate: { gte: startDate } } }),
  ]);
  if (!employee || !leaveType) return Response.json({ error: "Pegawai atau jenis cuti tidak ditemukan" }, { status: 404 });
  if (overlap) return Response.json({ error: "Periode bertumpang tindih dengan pengajuan lain" }, { status: 409 });
  if (leaveType.requiresAttachment && !parsed.data.attachmentRef) return Response.json({ error: "Referensi lampiran wajib untuk jenis ini" }, { status: 400 });
  const workDays = await countWorkDays(user.organizationId, employeeId, parsed.data.startDate, parsed.data.endDate); if (workDays < 1) return Response.json({ error: "Periode tidak memiliki hari kerja" }, { status: 400 });
  if (leaveType.annualQuota !== null) {
    const balance = await db.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year: startDate.getUTCFullYear() } } });
    const allowance = balance?.allowance ?? leaveType.annualQuota; const used = balance?.used ?? 0;
    if (used + workDays > allowance) return Response.json({ error: `Saldo tidak cukup. Tersisa ${allowance - used} hari.` }, { status: 409 });
  }
  const leave = await db.leaveRequest.create({ data: { organizationId: user.organizationId, employeeId, leaveTypeId: leaveType.id, startDate, endDate, workDays, reason: parsed.data.reason, attachmentRef: parsed.data.attachmentRef || null, requestedById: user.id } });
  await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "LEAVE_REQUESTED", entityType: "LeaveRequest", entityId: leave.id, metadata: { employeeId, workDays, leaveType: leaveType.code } });
  return Response.json(leave, { status: 201 });
}
