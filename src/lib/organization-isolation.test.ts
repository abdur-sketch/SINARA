import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const dbMock = {
  employee: { findFirst: vi.fn(), updateMany: vi.fn() },
  employeeDocument: { findFirst: vi.fn() },
  unit: { findFirst: vi.fn() },
  position: { findFirst: vi.fn() },
  employeeAssignment: { create: vi.fn() },
  user: { findFirst: vi.fn(), count: vi.fn() },
};
vi.mock("@/lib/access", () => ({ getApiActor: vi.fn(async () => ({ session: { user: { id: "actor", organizationId } } })), requireRecentMfa: vi.fn(async () => ({ session: { user: { id: "actor", organizationId } } })) }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceAdminRateLimit: vi.fn(async()=>null) }));

beforeEach(() => { vi.clearAllMocks(); dbMock.employee.findFirst.mockResolvedValue(null); dbMock.employee.updateMany.mockResolvedValue({ count: 0 }); dbMock.employeeDocument.findFirst.mockResolvedValue(null); dbMock.unit.findFirst.mockResolvedValue(null); dbMock.position.findFirst.mockResolvedValue(null); });

describe("isolasi dua organisasi", () => {
  it("menolak baca pegawai organisasi lain", async () => { const { GET } = await import("@/app/api/employees/[id]/route"); const response = await GET(new Request("http://local"), { params: Promise.resolve({ id: foreignId }) }); expect(response!.status).toBe(404); expect(dbMock.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: foreignId, organizationId } })); });
  it("menolak edit pegawai organisasi lain", async () => { const { PUT } = await import("@/app/api/employees/[id]/route"); const body={employeeNumber:"S-01",fullName:"Synthetic User",gender:"MALE",startDate:"2026-01-01",internalStatus:"GTY",relationshipType:"PERMANENT",primaryUnitId:foreignId,positionId:foreignId}; const response=await PUT(new Request("http://local",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),{params:Promise.resolve({id:foreignId})}); expect(response!.status).toBe(404); expect(dbMock.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:foreignId,organizationId})})); });
  it("menolak arsip pegawai organisasi lain", async () => { const { DELETE } = await import("@/app/api/employees/[id]/route"); const response=await DELETE(new Request("http://local"),{params:Promise.resolve({id:foreignId})}); expect(response!.status).toBe(404); expect(dbMock.employee.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:foreignId,organizationId})})); });
  it("menolak akses dokumen organisasi lain", async () => { const { GET }=await import("@/app/api/documents/[id]/route"); const response=await GET(new Request("http://local"),{params:Promise.resolve({id:foreignId})}); expect(response!.status).toBe(404); expect(dbMock.employeeDocument.findFirst).toHaveBeenCalledWith({where:{id:foreignId,organizationId}}); });
  it("menolak unduh dokumen karantina", async () => { dbMock.employeeDocument.findFirst.mockResolvedValueOnce({id:foreignId,organizationId,scanStatus:"PENDING"});const { GET }=await import("@/app/api/documents/[id]/route"); const response=await GET(new Request("http://local"),{params:Promise.resolve({id:foreignId})}); expect(response!.status).toBe(423); });
  it("menolak assignment lintas organisasi", async () => { const { POST }=await import("@/app/api/employees/[id]/assignments/route"); const request=new Request("http://local",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({unitId:foreignId,positionId:foreignId,effectiveFrom:"2026-01-01"})}); const response=await POST(request,{params:Promise.resolve({id:foreignId})}); expect(response!.status).toBe(404); expect(dbMock.unit.findFirst).toHaveBeenCalledWith({where:{id:foreignId,organizationId,isActive:true}}); expect(dbMock.employeeAssignment.create).not.toHaveBeenCalled(); });
  it("menolak edit unit dan jabatan organisasi lain",async()=>{const unit=await import("@/app/api/units/[id]/route");const position=await import("@/app/api/positions/[id]/route");const request=(body:unknown)=>new Request("http://local",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});expect((await unit.PATCH(request({name:"Foreign unit"}),{params:Promise.resolve({id:foreignId})}))!.status).toBe(404);expect((await position.PATCH(request({name:"Foreign role"}),{params:Promise.resolve({id:foreignId})}))!.status).toBe(404)});
  it("menolak kenaikan role sendiri",async()=>{const {POST}=await import("@/app/api/users/[id]/roles/route");const response=await POST(new Request("http://local",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({roleId:foreignId})}),{params:Promise.resolve({id:"actor"})});expect(response!.status).toBe(409)});
  it("mengabaikan organization_id dari request",async()=>{const {employeeSchema}=await import("./validation");const parsed=employeeSchema.parse({employeeNumber:"S-02",fullName:"Synthetic User",gender:"MALE",startDate:"2026-01-01",internalStatus:"GTY",relationshipType:"PERMANENT",primaryUnitId:foreignId,positionId:foreignId,organizationId:foreignId});expect("organizationId" in parsed).toBe(false)});
  it("melindungi administrator aktif terakhir",async()=>{dbMock.user.findFirst.mockResolvedValueOnce({id:"admin"});dbMock.user.count.mockResolvedValueOnce(1);const {isLastActiveSuperAdmin}=await import("./administration");expect(await isLastActiveSuperAdmin(organizationId,"admin")).toBe(true)});
});
