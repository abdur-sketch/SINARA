import Link from "next/link";
import { requireAnyPermission } from "@/lib/access";
import { actorUnitId, attendanceReaderPermissions, dateOnly, employeeScope, jakartaDate } from "@/lib/attendance";
import { db } from "@/lib/db";
import { ClockCard } from "@/components/attendance-forms";

export const dynamic = "force-dynamic";
export default async function AttendancePage() {
  const { user } = await requireAnyPermission(attendanceReaderPermissions); const todayKey = jakartaDate(); const today = dateOnly(todayKey); const unitId = await actorUnitId(user.id); const scope = employeeScope(user, unitId);
  const monthStart = dateOnly(`${todayKey.slice(0, 8)}01`);
  const [ownRecord, activeEmployees, grouped, monthRecords, pendingCorrections, pendingLeave, recent] = await Promise.all([
    user.employeeId ? db.attendanceRecord.findUnique({ where: { organizationId_employeeId_date: { organizationId: user.organizationId, employeeId: user.employeeId, date: today } } }) : null,
    db.employee.count({ where: { ...scope, isActive: true } }),
    db.attendanceRecord.groupBy({ by: ["status"], where: { organizationId: user.organizationId, date: today, employee: scope }, _count: true }),
    db.attendanceRecord.count({ where: { organizationId: user.organizationId, date: { gte: monthStart, lte: today }, employee: scope } }),
    user.permissions.includes("attendance.correction.review") ? db.attendanceCorrection.count({ where: { organizationId: user.organizationId, status: "PENDING", employee: scope } }) : 0,
    user.permissions.includes("leave.review") ? db.leaveRequest.count({ where: { organizationId: user.organizationId, status: "PENDING", employee: scope } }) : 0,
    db.attendanceRecord.findMany({ where: { organizationId: user.organizationId, employee: scope }, include: { employee: { select: { fullName: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 8 }),
  ]);
  const count = Object.fromEntries(grouped.map(row => [row.status, row._count])); const recorded = grouped.reduce((sum, row) => sum + row._count, 0);
  return <><div className="breadcrumb">Beranda / Absensi</div><div className="page-heading"><div><h1 className="page-title">Absensi pegawai</h1><p className="page-subtitle">Pencatatan kehadiran menggunakan waktu server. Belum memengaruhi payroll.</p></div><span className="badge badge-blue">ASIA/JAKARTA</span></div>
    <ClockCard state={{ linked: Boolean(user.employeeId), checkIn: ownRecord?.checkInAt?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }), checkOut: ownRecord?.checkOutAt?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) }}/>
    <div className="grid stats attendance-stats">{[["Pegawai dalam cakupan", activeEmployees], ["Tercatat hari ini", recorded], ["Hadir", (count.PRESENT??0)+(count.LATE??0)], ["Terlambat", count.LATE??0], ["Cuti/izin/sakit", (count.LEAVE??0)+(count.PERMISSION??0)+(count.SICK??0)], ["Catatan bulan ini", monthRecords]].map(([label,value])=><section className="card" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></section>)}</div>
    <section className="card module-links"><h2>Kelola absensi</h2><div className="toolbar-group"><Link className="btn btn-secondary" href="/attendance/records">Catatan kehadiran</Link><Link className="btn btn-secondary" href="/attendance/corrections">Koreksi <span className="badge badge-gray">{pendingCorrections}</span></Link><Link className="btn btn-secondary" href="/attendance/leave">Cuti & izin <span className="badge badge-gray">{pendingLeave}</span></Link>{user.permissions.includes("attendance.schedule.manage")&&<Link className="btn btn-secondary" href="/attendance/schedules">Jadwal & hari libur</Link>}{user.permissions.includes("attendance.report.export")&&<a className="btn btn-secondary" href={`/api/attendance/reports/export?start=${todayKey.slice(0,8)}01&end=${todayKey}`}>Ekspor bulan ini</a>}</div></section>
    <section className="card" style={{marginTop:18}}><h2>Aktivitas kehadiran terbaru</h2>{recent.length?<div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Pegawai</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Durasi</th></tr></thead><tbody>{recent.map(row=><tr key={row.id}><td>{row.date.toLocaleDateString("id-ID")}</td><td>{row.employee.fullName}</td><td><span className={`badge ${row.status==="PRESENT"?"badge-green":row.status==="LATE"?"badge-warning":"badge-gray"}`}>{row.status}</span></td><td>{formatTime(row.checkInAt)}</td><td>{formatTime(row.checkOutAt)}</td><td>{Math.floor(row.workMinutes/60)}j {row.workMinutes%60}m</td></tr>)}</tbody></table></div>:<div className="empty">Belum ada catatan kehadiran.</div>}</section></>;
}
function formatTime(value: Date | null) { return value?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) ?? "—"; }
