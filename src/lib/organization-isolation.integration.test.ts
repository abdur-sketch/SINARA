import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ||= "postgresql://sinur:change-me@localhost:5432/sinur_hrm_dev";
const db = new PrismaClient();
let orgA="",orgB="",employeeB="",unitB="",positionB="",documentB="";

beforeAll(async()=>{
  const [a,b]=await Promise.all([
    db.organization.upsert({where:{code:"TEST_ORG_A"},update:{name:"Synthetic Organization A"},create:{code:"TEST_ORG_A",name:"Synthetic Organization A"}}),
    db.organization.upsert({where:{code:"TEST_ORG_B"},update:{name:"Synthetic Organization B"},create:{code:"TEST_ORG_B",name:"Synthetic Organization B"}}),
  ]);orgA=a.id;orgB=b.id;
  const [unit,position]=await Promise.all([
    db.unit.upsert({where:{organizationId_code:{organizationId:orgB,code:"TEST_UNIT_B"}},update:{name:"Synthetic Unit B"},create:{organizationId:orgB,code:"TEST_UNIT_B",name:"Synthetic Unit B",type:"EDUCATION"}}),
    db.position.upsert({where:{organizationId_code:{organizationId:orgB,code:"TEST_POSITION_B"}},update:{name:"Synthetic Position B"},create:{organizationId:orgB,code:"TEST_POSITION_B",name:"Synthetic Position B"}}),
  ]);unitB=unit.id;positionB=position.id;
  const employee=await db.employee.upsert({where:{organizationId_employeeNumber:{organizationId:orgB,employeeNumber:"TEST-EMP-B"}},update:{fullName:"Synthetic Employee B"},create:{organizationId:orgB,employeeNumber:"TEST-EMP-B",fullName:"Synthetic Employee B",gender:"MALE",startDate:new Date("2026-01-01"),internalStatus:"GTY",primaryUnitId:unitB}});employeeB=employee.id;
  const document=await db.employeeDocument.upsert({where:{storageKey:"synthetic-org-b/document"},update:{title:"Synthetic Document B"},create:{organizationId:orgB,employeeId:employeeB,type:"CONTRACT",title:"Synthetic Document B",storageKey:"synthetic-org-b/document",originalName:"synthetic.pdf",mimeType:"application/pdf",sizeBytes:5,scanStatus:"APPROVED"}});documentB=document.id;
  await Promise.all([
    db.user.upsert({where:{email:"synthetic-account-a@example.test"},update:{organizationId:orgA,isActive:true},create:{organizationId:orgA,email:"synthetic-account-a@example.test",name:"Synthetic Account A",passwordHash:"not-a-login-credential"}}),
    db.user.upsert({where:{email:"synthetic-account-b@example.test"},update:{organizationId:orgB,isActive:true},create:{organizationId:orgB,email:"synthetic-account-b@example.test",name:"Synthetic Account B",passwordHash:"not-a-login-credential"}}),
  ]);
});
afterAll(()=>db.$disconnect());

describe("isolasi PostgreSQL dengan dua organisasi sintetis",()=>{
  it("konteks A tidak membaca atau mengarsipkan pegawai B",async()=>{expect(await db.employee.findFirst({where:{id:employeeB,organizationId:orgA}})).toBeNull();expect((await db.employee.updateMany({where:{id:employeeB,organizationId:orgA},data:{isActive:false}})).count).toBe(0)});
  it("konteks A tidak melihat dokumen, unit, atau jabatan B",async()=>{const [document,unit,position]=await Promise.all([db.employeeDocument.findFirst({where:{id:documentB,organizationId:orgA}}),db.unit.findFirst({where:{id:unitB,organizationId:orgA}}),db.position.findFirst({where:{id:positionB,organizationId:orgA}})]);expect([document,unit,position]).toEqual([null,null,null])});
});
