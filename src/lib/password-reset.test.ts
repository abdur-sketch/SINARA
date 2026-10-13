import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), update: vi.fn(), audit: vi.fn(), limit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findFirst: mocks.findFirst, update: mocks.update } } }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.audit }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.limit, LIMITS: { reset: { limit: 3, windowMs: 1, blockMs: 1 } }, requestIdentity: () => "test" }));

describe("konfirmasi reset password", () => {
  beforeEach(() => vi.clearAllMocks());
  it("mencabut sesi dan menolak replay token", async () => {
    const user = { id: "user-1", organizationId: "org-1" };
    mocks.findFirst.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    mocks.update.mockResolvedValue(user);
    const { POST } = await import("@/app/api/auth/password-reset/confirm/route");
    const payload = JSON.stringify({ token: "x".repeat(32), password: "Strong synthetic password 2026!" });
    const first = await POST(new Request("http://local", { method: "POST", headers: { "content-type": "application/json" }, body: payload }));
    const replay = await POST(new Request("http://local", { method: "POST", headers: { "content-type": "application/json" }, body: payload }));
    expect(first.status).toBe(200);
    expect(replay.status).toBe(400);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passwordResetHash: null, passwordResetExpiry: null, sessionVersion: { increment: 1 } }) }));
  });
});
