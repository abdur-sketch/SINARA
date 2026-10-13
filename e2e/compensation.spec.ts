import { test, expect } from "@playwright/test";
import { Authenticator } from "@otplib/v12-adapter";
import { E2E_TOTP_SECRET } from "./global-setup";

test("compensation dashboard and simulator remain draft-only", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_COMPENSATION_EMAIL!);
  await page.getByLabel("Kata sandi").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await page.getByLabel("Kode autentikator atau recovery").fill(new Authenticator().generate(E2E_TOTP_SECRET));
  await page.getByRole("button", { name: "Verifikasi MFA" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/compensation");
  await expect(page.getByRole("heading", { name: "Dashboard kompensasi" })).toBeVisible();

  const [grades, policies, options] = await Promise.all([
    page.request.get("/api/compensation/grades").then(response => response.json()),
    page.request.get("/api/compensation/policies").then(response => response.json()),
    page.request.get("/api/master-options").then(response => response.json()),
  ]);
  const policy = policies.find((item: { name: string }) => item.name === "Kebijakan Sintetis E2E");
  const grade = grades.find((item: { id: string }) => policy.scales.some((scale: { jobGradeId: string }) => scale.jobGradeId === item.id));
  const idempotencyKey = `e2e-${Date.now()}-${test.info().project.name}`;
  const payload = { name: `Simulasi E2E ${test.info().project.name}`, scenario: "GROWTH", salaryPolicyId: policy.id, jobGradeId: grade.id, employeeCount: 3, baseSalary: "1200.10", allowances: "100.00", raisePercent: 10, employerCostPercent: 5, periodStart: "2026-01-01", periodEnd: "2026-01-01", idempotencyKey, allocations: [{ unitId: options.units[0].id, percentage: 70 }, { unitId: options.units[1].id, percentage: 30 }] };
  const created = await page.request.post("/api/compensation/simulations", { data: payload });
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.totalBaseSalary).toBe("3960.33");
  expect(body.results.unitCosts).toHaveLength(2);
  expect((await page.request.post("/api/compensation/simulations", { data: payload })).status()).toBe(409);

  await page.goto("/compensation/simulator");
  await expect(page.getByText("SIMULATION ONLY")).toBeVisible();
  await expect(page.getByText(`Simulasi E2E ${test.info().project.name}`).first()).toBeVisible();
});
