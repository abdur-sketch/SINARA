import { Prisma } from "@prisma/client";
import { requireRecentMfa } from "@/lib/access";
import { dateOnly, holidaySchema } from "@/lib/attendance";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const actor = await requireRecentMfa("attendance.schedule.manage"); if ("error" in actor) return actor.error;
  const parsed = holidaySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Hari libur tidak valid" }, { status: 400 });
  try {
    const holiday = await db.holiday.create({ data: { organizationId: actor.session.user.organizationId, date: dateOnly(parsed.data.date), name: parsed.data.name, isCollective: parsed.data.isCollective } });
    await writeAudit({ organizationId: holiday.organizationId, actorId: actor.session.user.id, action: "HOLIDAY_CREATED", entityType: "Holiday", entityId: holiday.id, metadata: { date: parsed.data.date } });
    return Response.json(holiday, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Tanggal libur sudah tercatat" }, { status: 409 });
    throw error;
  }
}
