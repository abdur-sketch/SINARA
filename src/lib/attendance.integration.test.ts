import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { countWorkDays, dateOnly, findSchedule } from "./attendance";

const db = new PrismaClient(); let organizationId = ""; let employeeId = ""; let scheduleId = "";
beforeAll(async () => {
  const organization = await db.organization.create({ data: { code: "ATT_TEST", name: "Attendance Test" } }); organizationId = organization.id;
  const unit = await db.unit.create({ data: { organizationId, code: "ATT", name: "Attendance Unit", type: "TEST" } });
  const employee = await db.employee.create({ data: { organizationId, employeeNumber: "ATT-001", fullName: "Attendance Synthetic", gender: "MALE", startDate: dateOnly("2026-01-01"), internalStatus: "GTY", primaryUnitId: unit.id } }); employeeId = employee.id;
  const schedule = await db.workSchedule.create({ data: { organizationId, code: "ATT-REG", name: "Regular", workDays: [1,2,3,4,5], startMinute: 480, endMinute: 960, breakMinutes: 60, lateTolerance: 10 } }); scheduleId = schedule.id;
  await db.workScheduleAssignment.create({ data: { employeeId, scheduleId, effectiveFrom: dateOnly("2026-01-01") } });
  await db.holiday.create({ data: { organizationId, date: dateOnly("2026-10-14"), name: "Synthetic Holiday" } });
});
afterAll(() => db.$disconnect());

describe("attendance database safeguards", () => {
  it("resolves effective schedules and excludes holidays", async () => {
    expect((await findSchedule(organizationId, employeeId, dateOnly("2026-10-13")))?.id).toBe(scheduleId);
    expect(await countWorkDays(organizationId, employeeId, "2026-10-12", "2026-10-16")).toBe(4);
  });
  it("prevents duplicate daily records", async () => {
    const data = { organizationId, employeeId, date: dateOnly("2026-10-13"), status: "PRESENT" as const };
    await db.attendanceRecord.create({ data });
    await expect(db.attendanceRecord.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });
  it("keeps records isolated by organization", async () => expect(await db.attendanceRecord.findFirst({ where: { employeeId, organizationId: "00000000-0000-0000-0000-000000000000" } })).toBeNull());
});
