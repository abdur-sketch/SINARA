import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await getServerSession(authOptions)) redirect("/dashboard");
  return <main className="login-page">
    <section className="login-hero">
      <div className="brand"><div className="brand-mark">SN</div><div><strong>SINUR HRM</strong><small>Yayasan Nurul Iman</small></div></div>
      <div><h1>Kelola SDM dengan lebih terarah.</h1><p>Fondasi data kepegawaian yang aman, tertata, dan siap mendukung pertumbuhan organisasi.</p></div>
      <small>People. Payroll. Performance.</small>
    </section>
    <section className="login-panel"><div className="login-box"><div className="brand-mark">SN</div><h2>Selamat datang</h2><p>Masuk menggunakan akun yang diberikan administrator.</p><LoginForm /></div></section>
  </main>;
}
