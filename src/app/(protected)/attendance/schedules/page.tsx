import { requireAnyPermission } from "@/lib/access";
import { attendanceReaderPermissions, minuteToTime } from "@/lib/attendance";
import { db } from "@/lib/db";
import { HolidayForm, ScheduleAssignmentForm, ScheduleForm } from "@/components/attendance-forms";

export const dynamic = "force-dynamic";
export default async function SchedulesPage() {
  const { user } = await requireAnyPermission([...attendanceReaderPermissions, "attendance.schedule.manage"]); const canManage = user.permissions.includes("attendance.schedule.manage");
  const [schedules, holidays, units, employees] = await Promise.all([
    db.workSchedule.findMany({ where: { organizationId: user.organizationId }, include: { unit: true, _count: { select: { assignments: true } } }, orderBy: { code: "asc" } }),
    db.holiday.findMany({ where: { organizationId: user.organizationId, date: { gte: new Date() } }, orderBy: { date: "asc" }, take: 30 }),
    db.unit.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { organizationId: user.organizationId, isActive: true }, select: { id: true, fullName: true, employeeNumber: true }, orderBy: { fullName: "asc" } }),
  ]);
  const employeeOptions = employees.map(row => ({ id: row.id, name: `${row.employeeNumber} · ${row.fullName}` })); const scheduleOptions = schedules.filter(row => row.isActive).map(row => ({ id: row.id, name: `${row.code} · ${row.name}` }));
  return <><div className="breadcrumb">Absensi / Jadwal</div><h1 className="page-title">Jadwal kerja & hari libur</h1><p className="page-subtitle">Jadwal menggunakan hari 0–6 dan zona waktu Asia/Jakarta.</p>{canManage&&<div className="grid two-col"><ScheduleForm units={units}/><ScheduleAssignmentForm employees={employeeOptions} schedules={scheduleOptions}/><HolidayForm/></div>}
    <section className="card" style={{marginTop:18}}><h2>Daftar jadwal</h2><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Jadwal</th><th>Unit</th><th>Hari kerja</th><th>Jam</th><th>Penugasan</th></tr></thead><tbody>{schedules.map(row=><tr key={row.id}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.unit?.name??"Default organisasi"}</td><td>{row.workDays.map(day=>["Min","Sen","Sel","Rab","Kam","Jum","Sab"][day]).join(", ")}</td><td>{minuteToTime(row.startMinute)}–{minuteToTime(row.endMinute)} · toleransi {row.lateTolerance}m</td><td>{row._count.assignments}</td></tr>)}</tbody></table></div></section>
    <section className="card" style={{marginTop:18}}><h2>Hari libur mendatang</h2>{holidays.length?<div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Nama</th><th>Jenis</th></tr></thead><tbody>{holidays.map(row=><tr key={row.id}><td>{row.date.toLocaleDateString("id-ID")}</td><td>{row.name}</td><td>{row.isCollective?"Cuti bersama":"Hari libur"}</td></tr>)}</tbody></table></div>:<div className="empty">Belum ada hari libur mendatang.</div>}</section></>;
}
