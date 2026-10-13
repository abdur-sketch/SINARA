import { describe, expect, it } from "vitest";
import { calculateAttendance, dateOnly, employeeScope, jakartaTime, minuteToTime, timeToMinute } from "./attendance";

describe("attendance calculations", () => {
  it("converts schedule minutes consistently", () => { expect(timeToMinute("08:15")).toBe(495); expect(minuteToTime(495)).toBe("08:15"); });
  it("applies tolerance, lateness, breaks, and server timestamps", () => {
    const date = "2026-10-13"; const start = jakartaTime(date, 480);
    expect(calculateAttendance(new Date("2026-10-13T08:09:00+07:00"), new Date("2026-10-13T16:00:00+07:00"), start, 10, 60)).toMatchObject({ status: "PRESENT", lateMinutes: 0, workMinutes: 411 });
    expect(calculateAttendance(new Date("2026-10-13T08:31:00+07:00"), null, start, 10, 60)).toMatchObject({ status: "LATE", lateMinutes: 21, workMinutes: 0 });
  });
  it("builds fail-closed employee scopes", () => {
    const base = { organizationId: "org", employeeId: "employee", permissions: ["attendance.read.own"] };
    expect(employeeScope(base)).toEqual({ organizationId: "org", id: "employee" });
    expect(employeeScope({ ...base, permissions: ["attendance.read.unit"] }, "unit")).toEqual({ organizationId: "org", primaryUnitId: "unit" });
    expect(employeeScope({ ...base, permissions: ["attendance.read.all"] }, "unit")).toEqual({ organizationId: "org" });
    expect(dateOnly("2026-10-13").toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });
});
