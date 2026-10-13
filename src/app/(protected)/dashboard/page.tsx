import { db } from "@/lib/db";
import { requirePermission } from "@/lib/access";

export const dynamic = "force-dynamic";
export default async function DashboardPage(){
  const {user}=await requirePermission("employee.read");
  const org=user.organizationId;
  const [total,active,statuses,units,positions,contracts,audits]=await Promise.all([
    db.employee.count({where:{organizationId:org}}), db.employee.count({where:{organizationId:org,isActive:true}}),
    db.employee.groupBy({by:["internalStatus"],where:{organizationId:org,isActive:true},_count:true}),
    db.employee.groupBy({by:["primaryUnitId"],where:{organizationId:org,isActive:true},_count:true}),
    db.employeeAssignment.groupBy({by:["positionId"],where:{organizationId:org,effectiveTo:null},_count:true}),
    db.employmentContract.count({where:{organizationId:org,endDate:{gte:new Date(),lte:new Date(Date.now()+60*86400000)}}}),
    db.auditLog.findMany({where:{organizationId:org},orderBy:{createdAt:"desc"},take:5,include:{actor:{select:{name:true}}}})
  ]);
  const unitNames=await db.unit.findMany({where:{organizationId:org},select:{id:true,name:true}});
  const posNames=await db.position.findMany({where:{organizationId:org},select:{id:true,name:true}});
  const status=Object.fromEntries(statuses.map(s=>[s.internalStatus,s._count]));
  const maxUnit=Math.max(1,...units.map(x=>x._count));
  return <><div className="breadcrumb">Beranda / Dashboard</div><h1 className="page-title">Dashboard HRM</h1><p className="page-subtitle">Ringkasan data kepegawaian Yayasan Nurul Iman.</p>
    <div className="grid stats">
      {[['Total pegawai',total,'Database pegawai'],['Pegawai aktif',active,`${total-active} nonaktif`],['GTY',status.GTY??0,'Status internal'],['CGTY',status.CGTY??0,'Status internal'],['GTTY',status.GTTY??0,'Status internal'],['Tendik',status.TENDIK??0,'Status internal'],['Tenaga pesantren',status.TENAGA_PESANTREN??0,'Status internal'],['Kontrak ≤ 60 hari',contracts,'Perlu ditinjau']].map(([a,b,c])=><div className="card" key={a}><div className="stat-label">{a}</div><div className="stat-value">{b}</div><div className="stat-note">{c}</div></div>)}
    </div>
    <div className="grid two-col"><section className="card"><h2>Distribusi pegawai per unit</h2>{units.length?units.map(x=><div className="bar-row" key={x.primaryUnitId}><span>{unitNames.find(u=>u.id===x.primaryUnitId)?.name??"Unit"}</span><div className="bar"><span style={{width:`${x._count/maxUnit*100}%`}}/></div><strong>{x._count}</strong></div>):<div className="empty">Belum ada data pegawai.</div>}</section>
    <section className="card"><h2>Aktivitas administrasi terbaru</h2>{audits.length?audits.map(a=><div key={a.id} style={{padding:"11px 0",borderBottom:"1px solid #eef1f5"}}><strong style={{fontSize:13}}>{a.action.replaceAll("_"," ")}</strong><div style={{fontSize:12,color:"#64748b",marginTop:4}}>{a.actor?.name??"Sistem"} · {a.createdAt.toLocaleString("id-ID")}</div></div>):<div className="empty">Belum ada aktivitas.</div>}</section></div>
    <section className="card" style={{marginTop:18}}><h2>Distribusi jabatan</h2><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{positions.map(x=><span className="badge badge-blue" key={x.positionId}>{posNames.find(p=>p.id===x.positionId)?.name??"Jabatan"} · {x._count}</span>)}</div></section>
  </>;
}
