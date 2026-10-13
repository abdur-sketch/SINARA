"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };
function useAction(endpoint: string) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(body: unknown) { setBusy(true); setMessage(""); const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); setBusy(false); setMessage(response.ok ? "Berhasil disimpan." : result.error ?? "Permintaan gagal."); if (response.ok) router.refresh(); return response.ok; }
  return { busy, message, submit };
}
const localIso = (value: FormDataEntryValue | null) => value ? `${value}:00+07:00` : null;
const Feedback = ({ message }: { message: string }) => message ? <p className={message.startsWith("Berhasil") ? "notice-success" : "alert"}>{message}</p> : null;

export function ClockCard({ state }: { state: { linked: boolean; checkIn?: string | null; checkOut?: string | null } }) {
  const action = useAction("/api/attendance/clock");
  if (!state.linked) return <section className="card"><h2>Absensi saya</h2><div className="empty">Akun ini belum terhubung ke data pegawai.</div></section>;
  const next = !state.checkIn ? "CHECK_IN" : !state.checkOut ? "CHECK_OUT" : null;
  return <section className="card attendance-clock"><div><span className="eyebrow">WAKTU SERVER · ASIA/JAKARTA</span><h2>{new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date())}</h2><p>{state.checkIn ? `Masuk ${state.checkIn}` : "Belum check-in"} · {state.checkOut ? `Pulang ${state.checkOut}` : "Belum check-out"}</p></div>{next ? <button className="btn btn-primary" disabled={action.busy} onClick={() => action.submit({ action: next })}>{action.busy ? "Memproses…" : next === "CHECK_IN" ? "Check-in sekarang" : "Check-out sekarang"}</button> : <span className="badge badge-green">Absensi hari ini lengkap</span>}<Feedback message={action.message}/></section>;
}

export function ScheduleForm({ units }: { units: Option[] }) {
  const action = useAction("/api/attendance/schedules");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ code: f.get("code"), name: f.get("name"), unitId: f.get("unitId") || null, workDays: f.getAll("workDays").map(Number), startTime: f.get("startTime"), endTime: f.get("endTime"), breakMinutes: Number(f.get("breakMinutes")), lateTolerance: Number(f.get("lateTolerance")) }); }}><h2>Tambah jadwal kerja</h2><div className="form-grid"><input className="input" name="code" placeholder="Kode jadwal" required/><input className="input" name="name" placeholder="Nama jadwal" required/><select className="select" name="unitId"><option value="">Semua unit/default</option>{units.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><div className="weekday-picker">{[[1,"Sen"],[2,"Sel"],[3,"Rab"],[4,"Kam"],[5,"Jum"],[6,"Sab"],[0,"Min"]].map(([value,label])=><label key={value}><input type="checkbox" name="workDays" value={value} defaultChecked={Number(value)>0&&Number(value)<6}/>{label}</label>)}</div><label>Jam masuk<input className="input" name="startTime" type="time" defaultValue="08:00" required/></label><label>Jam pulang<input className="input" name="endTime" type="time" defaultValue="16:00" required/></label><label>Istirahat (menit)<input className="input" name="breakMinutes" type="number" min="0" defaultValue="60" required/></label><label>Toleransi terlambat<input className="input" name="lateTolerance" type="number" min="0" defaultValue="10" required/></label></div><button className="btn btn-primary" disabled={action.busy}>Simpan jadwal</button><Feedback message={action.message}/></form>;
}

export function ScheduleAssignmentForm({ employees, schedules }: { employees: Option[]; schedules: Option[] }) {
  const action = useAction("/api/attendance/schedules/assignments");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ employeeId: f.get("employeeId"), scheduleId: f.get("scheduleId"), effectiveFrom: f.get("effectiveFrom"), effectiveTo: f.get("effectiveTo") || null }); }}><h2>Tetapkan jadwal pegawai</h2><div className="form-grid"><select className="select" name="employeeId" required><option value="">Pilih pegawai</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><select className="select" name="scheduleId" required><option value="">Pilih jadwal</option>{schedules.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><label>Mulai berlaku<input className="input" type="date" name="effectiveFrom" required/></label><label>Akhir (opsional)<input className="input" type="date" name="effectiveTo"/></label></div><button className="btn btn-primary" disabled={action.busy}>Tetapkan</button><Feedback message={action.message}/></form>;
}

export function HolidayForm() {
  const action = useAction("/api/attendance/holidays");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ date: f.get("date"), name: f.get("name"), isCollective: f.get("isCollective") === "on" }); }}><h2>Tambah hari libur</h2><div className="form-grid"><label>Tanggal<input className="input" name="date" type="date" required/></label><input className="input" name="name" placeholder="Nama hari libur" required/><label><input type="checkbox" name="isCollective"/> Cuti bersama</label></div><button className="btn btn-primary" disabled={action.busy}>Simpan hari libur</button><Feedback message={action.message}/></form>;
}

export function ManualRecordForm({ employees }: { employees: Option[] }) {
  const action = useAction("/api/attendance/records");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ employeeId: f.get("employeeId"), date: f.get("date"), checkIn: localIso(f.get("checkIn")), checkOut: localIso(f.get("checkOut")), status: f.get("status"), notes: f.get("notes") }); }}><h2>Catatan manual HR</h2><p className="page-subtitle">Semua perubahan dicatat di audit log.</p><div className="form-grid"><select className="select" name="employeeId" required><option value="">Pilih pegawai</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><input className="input" type="date" name="date" required/><label>Check-in<input className="input" type="datetime-local" name="checkIn"/></label><label>Check-out<input className="input" type="datetime-local" name="checkOut"/></label><select className="select" name="status">{["PRESENT","LATE","ABSENT","LEAVE","SICK","PERMISSION","OFFICIAL_DUTY","HOLIDAY"].map(x=><option key={x}>{x}</option>)}</select><input className="input" name="notes" placeholder="Catatan"/></div><button className="btn btn-primary" disabled={action.busy}>Simpan catatan</button><Feedback message={action.message}/></form>;
}

export function CorrectionForm({ employees, canManage }: { employees: Option[]; canManage: boolean }) {
  const action = useAction("/api/attendance/corrections");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ employeeId: canManage ? f.get("employeeId") : undefined, date: f.get("date"), proposedCheckIn: localIso(f.get("checkIn")), proposedCheckOut: localIso(f.get("checkOut")), reason: f.get("reason") }); }}><h2>Ajukan koreksi</h2><div className="form-grid">{canManage&&<select className="select" name="employeeId" required><option value="">Pilih pegawai</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>}<input className="input" type="date" name="date" required/><label>Usulan check-in<input className="input" type="datetime-local" name="checkIn"/></label><label>Usulan check-out<input className="input" type="datetime-local" name="checkOut"/></label><textarea className="textarea span-2" name="reason" placeholder="Alasan koreksi" required/></div><button className="btn btn-primary" disabled={action.busy}>Kirim koreksi</button><Feedback message={action.message}/></form>;
}

export function LeaveForm({ employees, leaveTypes, canManage }: { employees: Option[]; leaveTypes: (Option & { hint: string })[]; canManage: boolean }) {
  const action = useAction("/api/attendance/leave");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ employeeId: canManage ? f.get("employeeId") : undefined, leaveTypeId: f.get("leaveTypeId"), startDate: f.get("startDate"), endDate: f.get("endDate"), reason: f.get("reason"), attachmentRef: f.get("attachmentRef") || undefined }); }}><h2>Ajukan cuti / izin</h2><div className="form-grid">{canManage&&<select className="select" name="employeeId" required><option value="">Pilih pegawai</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>}<select className="select" name="leaveTypeId" required><option value="">Pilih jenis</option>{leaveTypes.map(x=><option value={x.id} key={x.id}>{x.name} · {x.hint}</option>)}</select><label>Mulai<input className="input" type="date" name="startDate" required/></label><label>Selesai<input className="input" type="date" name="endDate" required/></label><input className="input span-2" name="attachmentRef" placeholder="Referensi lampiran (wajib jika jenis mensyaratkan)"/><textarea className="textarea span-2" name="reason" placeholder="Alasan pengajuan" required/></div><button className="btn btn-primary" disabled={action.busy}>Kirim pengajuan</button><Feedback message={action.message}/></form>;
}

export function LeaveTypeForm() {
  const action = useAction("/api/attendance/leave-types");
  return <form className="card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); action.submit({ code: f.get("code"), name: f.get("name"), annualQuota: f.get("annualQuota") ? Number(f.get("annualQuota")) : null, requiresAttachment: f.get("requiresAttachment") === "on" }); }}><h2>Tambah jenis cuti/izin</h2><div className="form-grid"><input className="input" name="code" placeholder="Kode" required/><input className="input" name="name" placeholder="Nama jenis" required/><input className="input" name="annualQuota" type="number" min="1" max="366" placeholder="Kuota tahunan (opsional)"/><label><input name="requiresAttachment" type="checkbox"/> Wajib referensi lampiran</label></div><button className="btn btn-primary" disabled={action.busy}>Simpan jenis</button><Feedback message={action.message}/></form>;
}

export function ReviewActions({ endpoint }: { endpoint: string }) {
  const action = useAction(endpoint);
  return <div className="review-actions"><button className="btn btn-primary" disabled={action.busy} onClick={() => window.confirm("Setujui pengajuan ini?") && action.submit({ action: "APPROVE" })}>Setujui</button><button className="btn btn-danger" disabled={action.busy} onClick={() => window.confirm("Tolak pengajuan ini?") && action.submit({ action: "REJECT" })}>Tolak</button><Feedback message={action.message}/></div>;
}
