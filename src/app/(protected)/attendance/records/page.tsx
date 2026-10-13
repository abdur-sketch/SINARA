import { requireAnyPermission } from "@/lib/access";
import { actorUnitId, attendanceReaderPermissions, dateOnly, employeeScope, jakartaDate } from "@/lib/attendance";
import { db } from "@/lib/db";
import { CorrectionForm, ManualRecordForm } from "@/components/attendance-forms";

export const dynamic = "force-dynamic";
export default async function RecordsPage() {
  const { user } = await requireAnyPermission(attendanceReaderPermissions); const unitId = await actorUnitId(user.id); const scope = employeeScope(user, unitId); const today = jakartaDate(); const start = `${today.slice(0, 8)}01`;
  const [records, employees] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { organizationId: user.organizationId, date: { gte: dateOnly(start), lte: dateOnly(today) }, employee: scope },
      include: { employee: { include: { primaryUnit: { select: { name: true } } } } },
      orderBy: [{ date: "desc" }, { employee: { fullName: "asc" } }],
    }),
    db.employee.findMany({ where: { ...scope, isActive: true }, select: { id: true, employeeNumber: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const options = employees.map(row => ({ id: row.id, name: `${row.employeeNumber} · ${row.fullName}` })); const canManage = user.permissions.includes("attendance.manage");
  return <><div className="breadcrumb">Absensi / Catatan</div><h1 className="page-title">Catatan kehadiran</h1><p className="page-subtitle">Periode bulan berjalan. Waktu ditampilkan dalam Asia/Jakarta.</p>{canManage&&<ManualRecordForm employees={options}/>} {user.permissions.includes("attendance.correction.create")&&<div style={{marginTop:18}}><CorrectionForm employees={options} canManage={canManage}/></div>}
    <section className="card" style={{marginTop:18}}><h2>Rekap bulan berjalan</h2>{records.length?<div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Pegawai</th><th>Unit</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Terlambat</th><th>Durasi</th><th>Sumber</th></tr></thead><tbody>{records.map(row=><tr key={row.id}><td>{row.date.toLocaleDateString("id-ID")}</td><td>{row.employee.fullName}</td><td>{row.employee.primaryUnit.name}</td><td><span className={`badge ${row.status==="PRESENT"?"badge-green":row.status==="LATE"?"badge-warning":"badge-gray"}`}>{row.status}</span></td><td>{time(row.checkInAt)}</td><td>{time(row.checkOutAt)}</td><td>{row.lateMinutes} menit</td><td>{Math.floor(row.workMinutes/60)}j {row.workMinutes%60}m</td><td>{row.source}</td></tr>)}</tbody></table></div>:<div className="empty">Belum ada catatan pada bulan ini.</div>}</section></>;
}
function time(value: Date|null){return value?.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"})??"—"}
