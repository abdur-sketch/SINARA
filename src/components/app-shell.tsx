import Link from "next/link";
import { LayoutDashboard, UsersRound, Building2, Landmark, BriefcaseBusiness, UserCog, ShieldCheck, ScrollText, Settings, BadgeDollarSign, CalendarCheck } from "lucide-react";
import { requireSession } from "@/lib/access";
import { LogoutButton } from "@/components/logout-button";
import type { PermissionKey } from "@/lib/permissions";

const nav = [
  ["/dashboard","Dashboard",LayoutDashboard,[]], ["/employees","Pegawai",UsersRound,["employee.read","employee.self.read"]], ["/organization","Organisasi",Landmark,["organization.read"]],
  ["/units","Unit",Building2,["unit.read"]], ["/positions","Jabatan",BriefcaseBusiness,["position.read"]], ["/users","Pengguna",UserCog,["user.manage"]],
  ["/attendance","Absensi",CalendarCheck,["attendance.read.own","attendance.read.unit","attendance.read.all"]],
  ["/compensation","Compensation",BadgeDollarSign,["compensation.grade.read","compensation.policy.read","compensation.component.read","compensation.proposal.create","compensation.proposal.review","compensation.simulation.run"]],
  ["/roles","Role & Akses",ShieldCheck,["role.manage"]], ["/audit-logs","Audit Log",ScrollText,["audit.read"]], ["/settings","Pengaturan",Settings,[]]
] as const;
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const visibleNav=nav.filter(([, , ,permissions])=>permissions.length===0||permissions.some(permission=>session.user.permissions.includes(permission as PermissionKey)));
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">SN</div><div><strong>SINUR HRM</strong><small>People · Payroll · Performance</small></div></div><div className="nav-label">MENU UTAMA</div><nav>{visibleNav.map(([href,label,Icon])=><Link className="nav-link" href={href} key={href}><Icon size={18}/><span>{label}</span></Link>)}</nav><div style={{marginTop:20,borderTop:"1px solid #ffffff18",paddingTop:12}}><LogoutButton/></div></aside><div className="main"><header className="topbar"><input className="search" aria-label="Pencarian global" placeholder="Cari pegawai, unit, atau jabatan..."/><div className="person"><div className="avatar">{session.user.name?.slice(0,1).toUpperCase()||"U"}</div><div><strong>{session.user.name}</strong><small>{session.user.roles.join(", ")}</small></div></div></header><main className="content">{children}</main></div></div>;
}
