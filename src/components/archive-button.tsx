"use client";
import { useRouter } from "next/navigation";
export function ArchiveButton({id}:{id:string}){const router=useRouter();async function archive(){if(!confirm("Arsipkan pegawai ini? Data tetap tersimpan dan dapat diaudit."))return;const r=await fetch(`/api/employees/${id}`,{method:"DELETE"});if(r.ok){router.push("/employees");router.refresh()}else alert("Pegawai gagal diarsipkan.")}return <button className="btn btn-danger" onClick={archive}>Arsipkan</button>}
