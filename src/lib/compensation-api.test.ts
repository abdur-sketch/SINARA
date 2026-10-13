import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  requireRecentMfa: vi.fn(),
  writeAudit: vi.fn(),
  findFirst: vi.fn(), update: vi.fn(), approvalCreate: vi.fn(),
}));
vi.mock("@/lib/access", () => ({ requireRecentMfa: mocks.requireRecentMfa }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("@/lib/db", () => ({ db: { jobEvaluation: { findFirst: mocks.findFirst, update: mocks.update }, compensationApproval: { create: mocks.approvalCreate } } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRecentMfa.mockResolvedValue({ session: { user: { id: actorId, organizationId } } });
  mocks.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333", organizationId, createdById: "creator", status: "IN_REVIEW" });
  mocks.update.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333", status: "APPROVED" });
});

describe("compensation approval API", () => {
  it("denies unauthorized approval before salary data access", async () => {
    mocks.requireRecentMfa.mockResolvedValueOnce({ error: Response.json({ error: "Akses ditolak" }, { status: 403 }) });
    const { POST } = await import("@/app/api/compensation/evaluations/[id]/review/route");
    const response = await POST(request("APPROVE"), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response!.status).toBe(403); expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("prevents creators from approving their own evaluation", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "33333333-3333-4333-8333-333333333333", organizationId, createdById: actorId, status: "IN_REVIEW" });
    const { POST } = await import("@/app/api/compensation/evaluations/[id]/review/route");
    const response = await POST(request("APPROVE"), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response!.status).toBe(409); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("scopes reads, records approval history, and writes audit", async () => {
    const { POST } = await import("@/app/api/compensation/evaluations/[id]/review/route");
    const response = await POST(request("APPROVE"), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response!.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "33333333-3333-4333-8333-333333333333", organizationId } });
    expect(mocks.approvalCreate).toHaveBeenCalled(); expect(mocks.writeAudit).toHaveBeenCalled();
  });
});

function request(action: string) {
  return new Request("http://local/api/compensation/evaluations/id/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
}
