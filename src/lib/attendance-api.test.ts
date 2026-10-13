import { beforeEach, describe, expect, it, vi } from "vitest";

const actorId = "11111111-1111-4111-8111-111111111111"; const organizationId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ requireRecentMfa: vi.fn(), findFirst: vi.fn(), update: vi.fn(), writeAudit: vi.fn() }));
vi.mock("@/lib/access", () => ({ requireRecentMfa: mocks.requireRecentMfa }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("@/lib/db", () => ({ db: { attendanceCorrection: { findFirst: mocks.findFirst, update: mocks.update } } }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.requireRecentMfa.mockResolvedValue({ session: { user: { id: actorId, organizationId, permissions: ["attendance.read.all"] } } });
  mocks.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333", organizationId, requestedById: actorId, status: "PENDING", employee: { primaryUnitId: "unit" }, record: null });
});

describe("attendance approval API", () => {
  it("checks permission before reading requests", async () => {
    mocks.requireRecentMfa.mockResolvedValueOnce({ error: Response.json({ error: "Akses ditolak" }, { status: 403 }) });
    const { POST } = await import("@/app/api/attendance/corrections/[id]/review/route"); const response = await POST(request(), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response!.status).toBe(403); expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("prevents a requester from approving their own correction", async () => {
    const { POST } = await import("@/app/api/attendance/corrections/[id]/review/route"); const response = await POST(request(), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response!.status).toBe(409); expect(mocks.update).not.toHaveBeenCalled();
  });
});
function request(){return new Request("http://local/api/attendance/corrections/id/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"APPROVE"})})}
