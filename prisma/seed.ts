import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/permissions";

const db=new PrismaClient();
async function main(){
 const org=await db.organization.upsert({where:{code:"YNI"},update:{name:"Yayasan Nurul Iman"},create:{name:"Yayasan Nurul Iman",code:"YNI"}});
 const units=[
  ["TK IT Nurul Iman","TKIT","EDUCATION"],["SDQu Nurul Iman","SDQU","EDUCATION"],["SMP IT Nurul Iman","SMPIT","EDUCATION"],
  ["SMK Nurul Iman","SMK","EDUCATION"],["Pesantren Nurul Iman","PESANTREN","BOARDING"],["Administrasi Yayasan","ADM","CENTRAL_ADMIN"]
 ];
 for(const [name,code,type] of units)await db.unit.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name,type},create:{organizationId:org.id,name,code,type}});
 const adminUnit=await db.unit.findUniqueOrThrow({where:{organizationId_code:{organizationId:org.id,code:"ADM"}}});
 await db.workSchedule.upsert({where:{organizationId_code:{organizationId:org.id,code:"REGULER"}},update:{name:"Jam kerja reguler",unitId:null,workDays:[1,2,3,4,5],startMinute:480,endMinute:960,breakMinutes:60,lateTolerance:10,isActive:true},create:{organizationId:org.id,code:"REGULER",name:"Jam kerja reguler",workDays:[1,2,3,4,5],startMinute:480,endMinute:960,breakMinutes:60,lateTolerance:10}});
 await db.workSchedule.upsert({where:{organizationId_code:{organizationId:org.id,code:"ADM"}},update:{name:"Administrasi Yayasan",unitId:adminUnit.id,workDays:[1,2,3,4,5],startMinute:480,endMinute:960,breakMinutes:60,lateTolerance:10,isActive:true},create:{organizationId:org.id,unitId:adminUnit.id,code:"ADM",name:"Administrasi Yayasan",workDays:[1,2,3,4,5],startMinute:480,endMinute:960,breakMinutes:60,lateTolerance:10}});
 for(const [code,name,annualQuota,requiresAttachment] of [["TAHUNAN","Cuti tahunan",12,false],["SAKIT","Sakit",null,true],["IZIN","Izin",null,false],["DINAS","Dinas luar",null,false]] as const)await db.leaveType.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name,annualQuota,requiresAttachment,isActive:true},create:{organizationId:org.id,code,name,annualQuota,requiresAttachment}});
 const positions=[["Ketua Yayasan","KETUA"],["Kepala Unit","KEPALA_UNIT"],["Guru","GURU"],["Tenaga Kependidikan","TENDIK"],["Staf Administrasi","STAF_ADM"]];
 for(const [name,code] of positions)await db.position.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name},create:{organizationId:org.id,name,code}});
 const permissionRows:Record<string,string>={};
 for(const key of PERMISSIONS){const p=await db.permission.upsert({where:{key},update:{},create:{key}});permissionRows[key]=p.id}
 for(const [name,keys] of Object.entries(ROLE_PERMISSIONS)){const role=await db.role.upsert({where:{organizationId_name:{organizationId:org.id,name}},update:{},create:{organizationId:org.id,name,isSystem:true}});await db.rolePermission.deleteMany({where:{roleId:role.id}});await db.rolePermission.createMany({data:keys.map(key=>({roleId:role.id,permissionId:permissionRows[key]})),skipDuplicates:true})}
 const factors=[["responsibility","Tanggung jawab",30],["competency","Kompetensi",25],["complexity","Kompleksitas",20],["impact","Dampak pekerjaan",15],["independence","Kemandirian",10]] as const;
 for(const [key,name,weight] of factors)await db.compensationFactor.upsert({where:{organizationId_key:{organizationId:org.id,key}},update:{name,weight,isActive:true},create:{organizationId:org.id,key,name,weight}});
 const grades=[["I",1,1,1.66],["II",2,1.67,2.33],["III",3,2.34,3],["IV",4,3.01,3.67],["V",5,3.68,4.33],["VI",6,4.34,5]] as const;
 for(const [code,level,minimumScore,maximumScore] of grades)await db.jobGrade.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name:`Golongan ${code}`,level,minimumScore,maximumScore,isActive:true},create:{organizationId:org.id,code,name:`Golongan ${code}`,level,minimumScore,maximumScore}});
 const components=[["GAJI_POKOK","Gaji pokok","BASE_SALARY"],["TUNJ_TETAP","Tunjangan tetap","FIXED_ALLOWANCE"],["TUNJ_TIDAK_TETAP","Tunjangan tidak tetap","VARIABLE_ALLOWANCE"],["TUNJ_JABATAN","Tunjangan jabatan","POSITION_ALLOWANCE"],["TUNJ_TUGAS","Tunjangan tugas tambahan","ADDITIONAL_DUTY"],["INSENTIF_HADIR","Insentif kehadiran","ATTENDANCE_INCENTIVE"],["INSENTIF_KINERJA","Insentif kinerja","PERFORMANCE_INCENTIVE"],["HONOR_SATUAN","Honor satuan/jam","UNIT_OR_HOURLY_HONORARIUM"],["KOREKSI","Komponen koreksi","CORRECTION"]] as const;
 for(const [code,name,type] of components)await db.payComponent.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name,type,isActive:true},create:{organizationId:org.id,code,name,type,method:"MANUAL",effectiveDate:new Date("2026-01-01"),legalNotes:"Klasifikasi pajak, BPJS, lembur, dan THR belum ditetapkan otomatis."}});
 const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if(email&&password){if(password.length<14)throw new Error("BOOTSTRAP_ADMIN_PASSWORD minimal 14 karakter.");const role=await db.role.findUniqueOrThrow({where:{organizationId_name:{organizationId:org.id,name:"SUPER_ADMIN"}}});const passwordHash=await bcrypt.hash(password,12);const user=await db.user.upsert({where:{email},update:{name:"Administrator Development",passwordHash,organizationId:org.id,isActive:true},create:{email,name:"Administrator Development",passwordHash,organizationId:org.id}});await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:role.id}},update:{},create:{userId:user.id,roleId:role.id}});console.info(`Bootstrap admin development dibuat untuk ${email}. Hapus BOOTSTRAP_ADMIN_PASSWORD dari environment.`)}else console.info("Master data dibuat. Admin tidak dibuat karena bootstrap environment tidak lengkap.");
}
main().finally(()=>db.$disconnect());
