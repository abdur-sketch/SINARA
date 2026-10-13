import { AttendanceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const attendanceReaderPermissions = ["attendance.read.own", "attendance.read.unit", "attendance.read.all"] as const;

export const scheduleSchema = z.object({
  code: z.string().trim().min(2).max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(3).max(120),
  unitId: z.string().uuid().nullable().optional(),
  workDays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.coerce.number().int().min(0).max(300),
  lateTolerance: z.coerce.number().int().min(0).max(180),
});

export const scheduleAssignmentSchema = z.object({
  employeeId: z.string().uuid(), scheduleId: z.string().uuid(),
  effectiveFrom: z.string().date(), effectiveTo: z.string().date().nullable().optional(),
}).refine(data => !data.effectiveTo || data.effectiveTo >= data.effectiveFrom, { message: "Tanggal akhir harus setelah tanggal mulai" });

export const holidaySchema = z.object({ date: z.string().date(), name: z.string().trim().min(3).max(150), isCollective: z.boolean().default(false) });
export const clockSchema = z.object({ action: z.enum(["CHECK_IN", "CHECK_OUT"]) });
export const correctionSchema = z.object({
  employeeId: z.string().uuid().optional(), date: z.string().date(),
  proposedCheckIn: z.string().datetime({ offset: true }).nullable().optional(),
  proposedCheckOut: z.string().datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().min(5).max(1000),
}).refine(data => data.proposedCheckIn || data.proposedCheckOut, { message: "Minimal satu waktu koreksi wajib diisi" });
export const reviewSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]), notes: z.string().trim().max(1000).optional() });
export const leaveSchema = z.object({
  employeeId: z.string().uuid().optional(), leaveTypeId: z.string().uuid(),
  startDate: z.string().date(), endDate: z.string().date(), reason: z.string().trim().min(5).max(1000),
  attachmentRef: z.string().trim().max(500).optional(),
}).refine(data => data.endDate >= data.startDate, { message: "Tanggal akhir harus setelah tanggal mulai" });
export const leaveTypeSchema = z.object({ code: z.string().trim().min(2).max(30).transform(value => value.toUpperCase()), name: z.string().trim().min(3).max(120), annualQuota: z.coerce.number().int().min(1).max(366).nullable().optional(), requiresAttachment: z.boolean().default(false) });

export function timeToMinute(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
export function minuteToTime(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
export function jakartaDate(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function dateOnly(value: string) { return new Date(`${value}T00:00:00.000Z`); }
export function jakartaTime(value: string, minute: number) { return new Date(`${value}T${minuteToTime(minute)}:00+07:00`); }
export function calculateAttendance(checkIn: Date, checkOut: Date | null, startAt: Date, tolerance: number, breakMinutes: number) {
  const lateMinutes = Math.max(0, Math.floor((checkIn.getTime() - startAt.getTime()) / 60000) - tolerance);
  const workMinutes = checkOut ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000) - breakMinutes) : 0;
  return { lateMinutes, workMinutes, status: lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT };
}

export async function findSchedule(organizationId: string, employeeId: string, date: Date) {
  const assignment = await db.workScheduleAssignment.findFirst({
    where: { employeeId, effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }], schedule: { organizationId, isActive: true } },
    include: { schedule: true }, orderBy: { effectiveFrom: "desc" },
  });
  if (assignment) return assignment.schedule;
  const employee = await db.employee.findFirst({ where: { id: employeeId, organizationId }, select: { primaryUnitId: true } });
  if (!employee) return null;
  return await db.workSchedule.findFirst({ where: { organizationId, unitId: employee.primaryUnitId, isActive: true }, orderBy: { createdAt: "desc" } })
    ?? db.workSchedule.findFirst({ where: { organizationId, unitId: null, isActive: true }, orderBy: { createdAt: "desc" } });
}

export function employeeScope(user: { organizationId: string; employeeId?: string | null; permissions: string[] }, unitId?: string | null): Prisma.EmployeeWhereInput {
  if (user.permissions.includes("attendance.read.all")) return { organizationId: user.organizationId };
  if (user.permissions.includes("attendance.read.unit") && unitId) return { organizationId: user.organizationId, primaryUnitId: unitId };
  return { organizationId: user.organizationId, id: user.employeeId ?? "00000000-0000-0000-0000-000000000000" };
}

export async function actorUnitId(userId: string) {
  return (await db.user.findUnique({ where: { id: userId }, select: { employee: { select: { primaryUnitId: true } } } }))?.employee?.primaryUnitId ?? null;
}

export async function countWorkDays(organizationId: string, employeeId: string, start: string, end: string) {
  const startDate = dateOnly(start); const endDate = dateOnly(end);
  const holidays = new Set((await db.holiday.findMany({ where: { organizationId, date: { gte: startDate, lte: endDate } }, select: { date: true } })).map(row => row.date.toISOString().slice(0, 10)));
  let total = 0;
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10); const schedule = await findSchedule(organizationId, employeeId, new Date(cursor));
    if (schedule?.workDays.includes(cursor.getUTCDay()) && !holidays.has(key)) total += 1;
  }
  return total;
}

export function leaveAttendanceStatus(code: string): AttendanceStatus {
  if (code === "SAKIT") return AttendanceStatus.SICK;
  if (code === "IZIN") return AttendanceStatus.PERMISSION;
  if (code === "DINAS") return AttendanceStatus.OFFICIAL_DUTY;
  return AttendanceStatus.LEAVE;
}
