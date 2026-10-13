"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { employeeSchema, type EmployeeInput } from "@/lib/validation";

type Option={id:string;name:string};
export function EmployeeForm({employee}:{employee?:Partial<EmployeeInput>&{id:string}}){
 const router=useRouter(); const [options,setOptions]=useState<{units:Option[];positions:Option[]}>({units:[],positions:[]}); const [serverError,setServerError]=useState("");
 const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<EmployeeInput>({resolver:zodResolver(employeeSchema),defaultValues:employee??{gender:"MALE",internalStatus:"GTY",relationshipType:"PERMANENT",startDate:new Date().toISOString().slice(0,10)}});
 useEffect(()=>{fetch("/api/master-options").then(r=>r.json()).then(setOptions).catch(()=>setServerError("Gagal memuat pilihan master."))},[]);
 async function submit(data:EmployeeInput){setServerError("");const res=await fetch(employee?`/api/employees/${employee.id}`:"/api/employees",{method:employee?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const body=await res.json();if(!res.ok){setServerError(body.error??"Data gagal disimpan.");return}router.push(`/employees/${body.id}`);router.refresh()}
 const field=(name:keyof EmployeeInput,label:string,type="text")=><div className="field"><label>{label}</label><input className="input" type={type} {...register(name)}/>{errors[name]&&<small>{errors[name]?.message}</small>}</div>;
 return <form className="card" onSubmit={handleSubmit(submit)}>{serverError&&<div className="alert">{serverError}</div>}<div className="form-grid">
   {field("employeeNumber","Nomor induk pegawai")}{field("fullName","Nama lengkap")}
   <div className="field"><label>Jenis kelamin</label><select className="select" {...register("gender")}><option value="MALE">Laki-laki</option><option value="FEMALE">Perempuan</option></select></div>
   {field("birthDate","Tanggal lahir","date")}{field("email","Email","email")}{field("phone","Nomor telepon","tel")}
   <div className="field span-2"><label>Alamat</label><textarea className="textarea" rows={3} {...register("address")}/></div>
   {field("lastEducation","Pendidikan terakhir")}{field("competencies","Kompetensi")}{field("startDate","Tanggal mulai bekerja","date")}
   <div className="field"><label>Status internal</label><select className="select" {...register("internalStatus")}>{["GTY","CGTY","GTTY","TENDIK","TENAGA_PESANTREN"].map(x=><option key={x}>{x}</option>)}</select></div>
   <div className="field"><label>Hubungan kerja</label><select className="select" {...register("relationshipType")}><option value="PERMANENT">Tetap</option><option value="FIXED_TERM">Waktu tertentu</option><option value="PART_TIME">Paruh waktu</option><option value="FREELANCE">Lepas</option><option value="OTHER">Lainnya</option></select></div>
   {field("contractEndDate","Tanggal akhir kontrak","date")}
   <div className="field"><label>Unit utama</label><select className="select" {...register("primaryUnitId")}><option value="">Pilih unit</option>{options.units.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{errors.primaryUnitId&&<small>{errors.primaryUnitId.message}</small>}</div>
   <div className="field"><label>Jabatan</label><select className="select" {...register("positionId")}><option value="">Pilih jabatan</option>{options.positions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{errors.positionId&&<small>{errors.positionId.message}</small>}</div>
   <div className="span-2" style={{display:"flex",justifyContent:"flex-end",gap:10}}><button type="button" className="btn btn-secondary" onClick={()=>router.back()}>Batal</button><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting?"Menyimpan...":employee?"Simpan perubahan":"Tambah pegawai"}</button></div>
 </div></form>
}
