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
  useEffect(() => setReady(true), []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const data = new FormData(e.currentTarget);
    const result = await signIn("credentials", { email: data.get("email"), password: data.get("password"), redirect: false });
    setBusy(false);
    if (result?.error) setError("Email atau kata sandi tidak valid. Akun dapat terkunci sementara setelah beberapa percobaan.");
    else { router.push("/dashboard"); router.refresh(); }
  }
  return <form onSubmit={submit} noValidate>
    {error && <div className="alert" role="alert">{error}</div>}
    <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div>
    <div className="field"><label htmlFor="password">Kata sandi</label><input className="input" id="password" name="password" type="password" minLength={12} autoComplete="current-password" required /></div>
    <Button type="submit" disabled={busy || !ready}>{busy ? "Memverifikasi..." : "Masuk ke SINUR HRM"}</Button>
  </form>;
}
