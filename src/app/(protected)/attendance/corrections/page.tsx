import { requireAnyPermission } from "@/lib/access";
import { actorUnitId, attendanceReaderPermissions, employeeScope } from "@/lib/attendance";
import { db } from "@/lib/db";
import { ReviewActions } from "@/components/attendance-forms";

export const dynamic = "force-dynamic";
export default async function CorrectionsPage() {
  const { user } = await requireAnyPermission(attendanceReaderPermissions); const unitId = await actorUnitId(user.id); const scope = employeeScope(user, unitId); const canReview = user.permissions.includes("attendance.correction.review");
  const rows = await db.attendanceCorrection.findMany({ where: { organizationId: user.organizationId, employee: scope }, include: { employee: { include: { primaryUnit: { select: { name: true } } } }, requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <><div className="breadcrumb">Absensi / Koreksi</div><h1 className="page-title">Koreksi absensi</h1><p className="page-subtitle">Jejak waktu asli dipertahankan melalui pengajuan dan audit log.</p><section className="card">{rows.length?<div className="table-wrap"><table><thead><tr><th>Pegawai</th><th>Tanggal</th><th>Usulan waktu</th><th>Alasan</th><th>Status</th><th>Keputusan</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.employee.fullName}</strong><br/>{row.employee.primaryUnit.name}</td><td>{row.date.toLocaleDateString("id-ID")}</td><td>{time(row.proposedCheckInAt)} – {time(row.proposedCheckOutAt)}</td><td className="cell-wrap">{row.reason}<br/><small>oleh {row.requestedBy.name}</small></td><td><span className={`badge ${row.status==="APPROVED"?"badge-green":row.status==="PENDING"?"badge-warning":"badge-gray"}`}>{row.status}</span></td><td>{canReview&&row.status==="PENDING"&&row.requestedById!==user.id?<ReviewActions endpoint={`/api/attendance/corrections/${row.id}/review`}/>:row.reviewedBy?.name??"—"}</td></tr>)}</tbody></table></div>:<div className="empty">Belum ada pengajuan koreksi.</div>}</section></>;
}
function time(value: Date|null){return value?.toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Jakarta"})??"—"}
