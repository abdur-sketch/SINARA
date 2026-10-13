import Link from "next/link";
export default function Forbidden(){return <main style={{minHeight:"100vh",display:"grid",placeItems:"center"}}><div className="card" style={{textAlign:"center"}}><h1>Akses ditolak</h1><p>Anda tidak memiliki izin untuk membuka halaman ini.</p><Link className="btn btn-primary" href="/dashboard">Kembali ke dashboard</Link></div></main>}
