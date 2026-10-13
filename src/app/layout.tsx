import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = { title: "SINUR HRM", description: "People. Payroll. Performance." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><PwaRegister />{children}</body></html>;
}
