import { describe, expect, it } from "vitest";

describe("rate limiter PostgreSQL bersama", () => {
  it("memblokir bucket yang sama lintas pemanggilan", async () => {
    process.env.DATABASE_URL ||= "postgresql://sinur:change-me@localhost:5432/sinur_hrm_dev";
    const { checkRateLimit } = await import("./rate-limit");
    const id = `vitest-${crypto.randomUUID()}`;
    expect((await checkRateLimit("integration", id, { limit: 2, windowMs: 60_000, blockMs: 60_000 })).allowed).toBe(true);
    expect((await checkRateLimit("integration", id, { limit: 2, windowMs: 60_000, blockMs: 60_000 })).allowed).toBe(true);
    expect((await checkRateLimit("integration", id, { limit: 2, windowMs: 60_000, blockMs: 60_000 })).allowed).toBe(false);
  });
});
