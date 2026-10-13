import { Prisma } from "@prisma/client";
import { getApiActorAny, requireRecentMfa } from "@/lib/access";
import { attendanceReaderPermissions, scheduleSchema, timeToMinute } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function GET() {
  const actor = await getApiActorAny([...attendanceReaderPermissions, "attendance.schedule.manage"]);
  if ("error" in actor) return actor.error;
  return Response.json(await db.workSchedule.findMany({ where: { organizationId: actor.session.user.organizationId }, include: { unit: { select: { name: true } }, _count: { select: { assignments: true } } }, orderBy: { code: "asc" } }));
}

export async function POST(request: Request) {
  const actor = await requireRecentMfa("attendance.schedule.manage");
  if ("error" in actor) return actor.error;
  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Jadwal tidak valid", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data; const startMinute = timeToMinute(data.startTime); const endMinute = timeToMinute(data.endTime);
  if (endMinute <= startMinute) return Response.json({ error: "Jam selesai harus setelah jam mulai" }, { status: 400 });
  if (data.unitId && !await db.unit.findFirst({ where: { id: data.unitId, organizationId: actor.session.user.organizationId, isActive: true } })) return Response.json({ error: "Unit tidak ditemukan" }, { status: 404 });
  try {
    const schedule = await db.workSchedule.create({ data: { organizationId: actor.session.user.organizationId, unitId: data.unitId || null, code: data.code, name: data.name, workDays: [...new Set(data.workDays)].sort(), startMinute, endMinute, breakMinutes: data.breakMinutes, lateTolerance: data.lateTolerance } });
    await writeAudit({ organizationId: schedule.organizationId, actorId: actor.session.user.id, action: "WORK_SCHEDULE_CREATED", entityType: "WorkSchedule", entityId: schedule.id, metadata: { code: schedule.code } });
    return Response.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Kode jadwal sudah digunakan" }, { status: 409 });
    throw error;
  }
}
