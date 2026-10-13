import { EmployeeForm } from "@/components/employee-form";
import { requirePermission } from "@/lib/access";
export default async function NewEmployee(){await requirePermission("employee.create");return <><div className="breadcrumb">Pegawai / Tambah</div><h1 className="page-title">Tambah pegawai</h1><p className="page-subtitle">Masukkan identitas, status internal, dan hubungan kerja secara terpisah.</p><EmployeeForm/></>}
