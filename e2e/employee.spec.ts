import { test,expect } from "@playwright/test";import { Authenticator } from "@otplib/v12-adapter";import { E2E_TOTP_SECRET } from "./global-setup";

test("employee CRUD, uniqueness, assignment, dan audit",async({page})=>{
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMPLOYEE_EMAIL!);
  await page.getByLabel("Kata sandi").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button",{name:"Lanjutkan"}).click();
  await page.getByLabel("Kode autentikator atau recovery").fill(new Authenticator().generate(E2E_TOTP_SECRET));
  await page.getByRole("button",{name:"Verifikasi MFA"}).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const options=await (await page.request.get("/api/master-options")).json();
  expect(options.units.length).toBeGreaterThan(1);expect(options.positions.length).toBeGreaterThan(0);
  const employeeNumber=`E2E-${Date.now()}`;
  const payload={employeeNumber,fullName:"Pegawai Sintetis E2E",gender:"MALE",birthDate:"1994-05-10",email:`${employeeNumber.toLowerCase()}@example.test`,phone:"0800000000",address:"Alamat sintetis",lastEducation:"S1",competencies:"Pengujian",startDate:"2026-01-01",internalStatus:"CGTY",relationshipType:"FIXED_TERM",contractEndDate:"2027-01-01",primaryUnitId:options.units[0].id,positionId:options.positions[0].id};
  const created=await page.request.post("/api/employees",{data:payload});expect(created.status()).toBe(201);const {id}=await created.json();
  const duplicate=await page.request.post("/api/employees",{data:payload});expect(duplicate.status()).toBe(409);
  const updated=await page.request.put(`/api/employees/${id}`,{data:{...payload,fullName:"Pegawai Sintetis Diperbarui"}});expect(updated.status()).toBe(200);
  const assignment=await page.request.post(`/api/employees/${id}/assignments`,{data:{unitId:options.units[1].id,positionId:options.positions[0].id,effectiveFrom:"2026-02-01"}});expect(assignment.status()).toBe(201);
  const detail=await (await page.request.get(`/api/employees/${id}`)).json();expect(detail.fullName).toBe("Pegawai Sintetis Diperbarui");expect(detail.assignments.length).toBe(2);
  const archived=await page.request.delete(`/api/employees/${id}`);expect(archived.status()).toBe(200);
  await page.goto("/audit-logs");await expect(page.getByText("EMPLOYEE_ARCHIVED").first()).toBeVisible();
});
