import { test, expect } from "@playwright/test";
import { Authenticator } from "@otplib/v12-adapter";
import { E2E_TOTP_SECRET } from "./global-setup";

test("employee attendance uses server time and preserves correction workflow", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMPLOYEE_EMAIL!);
  await page.getByLabel("Kata sandi").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await page.getByLabel("Kode autentikator atau recovery").fill(new Authenticator().generate(E2E_TOTP_SECRET));
  await page.getByRole("button", { name: "Verifikasi MFA" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/users");
  const userRow = page.getByRole("row").filter({ hasText: process.env.E2E_EMPLOYEE_EMAIL! });
  await expect(userRow.getByRole("combobox", { name: /Tautkan pegawai/ })).toHaveValue(/.+/);
  await page.goto("/attendance");
  await expect(page.getByRole("heading", { name: "Absensi pegawai" })).toBeVisible();
  await page.getByRole("button", { name: "Check-in sekarang" }).click();
  await expect(page.getByText("Berhasil disimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Check-out sekarang" }).click();
  await expect(page.getByText("Absensi hari ini lengkap")).toBeVisible();

  await page.goto("/attendance/records");
  await expect(page.locator("tbody").getByText("Pegawai Absensi E2E")).toBeVisible();
  const correction = page.getByRole("heading", { name: "Ajukan koreksi" }).locator("..");
  await correction.locator('select[name="employeeId"]').selectOption({ label: "E2E-ATT-001 · Pegawai Absensi E2E" });
  await correction.locator('input[name="date"]').fill("2026-10-13");
  await correction.locator('input[name="checkIn"]').fill("2026-10-13T08:00");
  await correction.locator('input[name="checkOut"]').fill("2026-10-13T16:00");
  await correction.locator('textarea[name="reason"]').fill("Koreksi sintetis untuk pengujian E2E");
  await correction.getByRole("button", { name: "Kirim koreksi" }).click();
  await expect(correction.getByText("Berhasil disimpan.")).toBeVisible();
  await page.goto("/attendance/corrections");
  await expect(page.getByText("Koreksi sintetis untuk pengujian E2E")).toBeVisible();
  await expect(page.getByText("PENDING")).toBeVisible();
});
