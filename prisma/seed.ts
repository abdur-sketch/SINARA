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
 const positions=[["Ketua Yayasan","KETUA"],["Kepala Unit","KEPALA_UNIT"],["Guru","GURU"],["Tenaga Kependidikan","TENDIK"],["Staf Administrasi","STAF_ADM"]];
 for(const [name,code] of positions)await db.position.upsert({where:{organizationId_code:{organizationId:org.id,code}},update:{name},create:{organizationId:org.id,name,code}});
 const permissionRows:Record<string,string>={};
 for(const key of PERMISSIONS){const p=await db.permission.upsert({where:{key},update:{},create:{key}});permissionRows[key]=p.id}
 for(const [name,keys] of Object.entries(ROLE_PERMISSIONS)){const role=await db.role.upsert({where:{organizationId_name:{organizationId:org.id,name}},update:{},create:{organizationId:org.id,name,isSystem:true}});await db.rolePermission.deleteMany({where:{roleId:role.id}});await db.rolePermission.createMany({data:keys.map(key=>({roleId:role.id,permissionId:permissionRows[key]})),skipDuplicates:true})}
 const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if(email&&password){if(password.length<14)throw new Error("BOOTSTRAP_ADMIN_PASSWORD minimal 14 karakter.");const role=await db.role.findUniqueOrThrow({where:{organizationId_name:{organizationId:org.id,name:"SUPER_ADMIN"}}});const passwordHash=await bcrypt.hash(password,12);const user=await db.user.upsert({where:{email},update:{name:"Administrator Development",passwordHash,organizationId:org.id,isActive:true},create:{email,name:"Administrator Development",passwordHash,organizationId:org.id}});await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:role.id}},update:{},create:{userId:user.id,roleId:role.id}});console.info(`Bootstrap admin development dibuat untuk ${email}. Hapus BOOTSTRAP_ADMIN_PASSWORD dari environment.`)}else console.info("Master data dibuat. Admin tidak dibuat karena bootstrap environment tidak lengkap.");
}
main().finally(()=>db.$disconnect());
