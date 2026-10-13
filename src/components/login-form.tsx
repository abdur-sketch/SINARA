"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [step,setStep]=useState<"password"|"mfa">("password");
  useEffect(() => setReady(true), []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const data = new FormData(e.currentTarget);
    if(step==="password"){
      const response=await fetch("/api/auth/preflight",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password")})});const body=await response.json();
      if(!response.ok){setBusy(false);setError(body.error??"Kredensial tidak valid.");return}
      if(body.action==="enroll"){router.push("/mfa/setup");return}
      if(body.action==="mfa"){setStep("mfa");setBusy(false);return}
      const result=await signIn("credentials",{proof:body.proof,redirect:false});setBusy(false);if(result?.error)setError("Autentikasi gagal.");else{router.push("/dashboard");router.refresh()}return;
    }
    const response=await fetch("/api/auth/mfa/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:data.get("code")})});const body=await response.json();if(!response.ok){setBusy(false);setError(body.error??"Kode MFA tidak valid.");return}const result=await signIn("credentials",{proof:body.proof,redirect:false});setBusy(false);if(result?.error)setError("Challenge MFA tidak dapat diselesaikan.");else{router.push("/dashboard");router.refresh()}
  }
  return <form onSubmit={submit} noValidate>
    {error && <div className="alert" role="alert">{error}</div>}
    {step==="password"?<><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div><div className="field"><label htmlFor="password">Kata sandi</label><input className="input" id="password" name="password" type="password" minLength={12} autoComplete="current-password" required /></div></>:<div className="field"><label htmlFor="code">Kode autentikator atau recovery</label><input className="input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus /></div>}
    <Button type="submit" disabled={busy || !ready}>{busy ? "Memverifikasi..." : step==="mfa"?"Verifikasi MFA":"Lanjutkan"}</Button>
  </form>;
}
