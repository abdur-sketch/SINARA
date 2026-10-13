import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { ComponentForm } from "@/components/compensation-forms";
export const dynamic = "force-dynamic";
const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });

export default async function Page() { const { user } = await requirePermission("compensation.component.read"); const rows = await db.payComponent.findMany({ where: { organizationId: user.organizationId }, orderBy: { code: "asc" } }); return <><div className="breadcrumb">Compensation / Pay components</div><h1 className="page-title">Komponen kompensasi</h1><p className="page-subtitle">Klasifikasi pajak, BPJS, lembur, dan THR tidak diterapkan otomatis pada fase ini.</p>{user.permissions.includes("compensation.component.manage") && <ComponentForm />}<section className="card" style={{ marginTop: 18 }}><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th><th>Metode</th><th>Default</th><th>Efektif</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.code}</td><td>{x.name}</td><td>{x.type}</td><td>{x.method}</td><td>{x.defaultValue ? idr.format(Number(x.defaultValue)) : "—"}</td><td>{x.effectiveDate.toLocaleDateString("id-ID")}</td></tr>)}</tbody></table></div></section></>; }
