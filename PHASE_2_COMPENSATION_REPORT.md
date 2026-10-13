# SINARA PHASE 2 — COMPENSATION ARCHITECTURE REPORT

Tanggal verifikasi: 13 Oktober 2026 (Asia/Jakarta)  
Lingkungan: local development only  
Status production: tidak disentuh

## 1. Baseline Git

- Branch awal dan akhir: `main`.
- Baseline Phase 1.5 diamankan dalam checkpoint lokal `4873138` (`feat: complete SINARA phase 1.5 security hardening`).
- Sebelum checkpoint, remote `origin/main` berada pada `78c94cd`; tidak ada push saat checkpoint dibuat.
- Tidak ada reset, clean, checkout destruktif, deploy, atau akses database production.

## 2. Perubahan schema

Ditambahkan enum status/skenario/metode kompensasi serta model `CompensationFactor`, `JobGrade`, `JobEvaluation`, `SalaryPolicy`, `SalaryScale`, `PayComponent`, `CompensationProposal`, `CompensationProposalItem`, `CompensationCostAllocation`, `CompensationSimulation`, dan `CompensationApproval`.

Nominal memakai `Decimal(18,2)`. Relasi memakai foreign key, constraint versi/kode/idempotency, indeks organisasi dan tanggal efektif, serta audit/approval history. Migrasi versioned: `20261013000300_phase_2_compensation_architecture`.

## 3. Fitur yang diterapkan

- Dashboard Compensation dan sembilan halaman modul.
- Job grading dengan faktor/bobot yang dapat dikonfigurasi, skala 1–5, skor berbobot, saran grade, reviewer, status, dan approval.
- Salary grade dinamis; seed I–VI hanya data awal dan tidak dikunci di kode.
- Salary policy versioned dengan status DRAFT, IN_REVIEW, APPROVED, ACTIVE, SUPERSEDED, ARCHIVED; scale minimum/midpoint/maximum IDR; sumber minimum wage terkonfigurasi.
- Master sembilan jenis pay component tanpa asumsi otomatis pajak/BPJS/lembur/THR.
- Proposal kompensasi efektif yang tidak mengubah kontrak atau payroll.
- Multi-unit allocation 100%, termasuk rekonsiliasi pembulatan agar biaya tidak terduplikasi.
- Simulator BASELINE, CONSERVATIVE, GROWTH, CUSTOM dengan baseline delta, employer cost, unit cost, range warning, minimum-configuration warning, dan ekspor CSV.
- Approval history dan compensation audit log.

## 4. Validasi job grading

- Bobot awal 30/25/20/15/10 dan total wajib 100%.
- Nilai faktor dibatasi 1–5.
- Perhitungan menggunakan Decimal dan dibulatkan dua desimal.
- Contoh sintetis menghasilkan skor `3.50`.
- Grade jabatan terpisah dari status internal GTY/CGTY/GTTY.

## 5. Validasi salary policy

- `minimum <= midpoint <= maximum` dan nominal non-negatif.
- Kombinasi organisasi, nama, dan versi unik.
- Aktivasi menolak periode ACTIVE yang tumpang tindih untuk scope sama.
- Pembuat tidak boleh menyetujui atau mengaktifkan kebijakan sendiri.
- Ketentuan minimum hanya konfigurasi dengan nominal, sumber, dan tanggal verifikasi; tidak ada angka hukum hardcoded.

## 6. Validasi pay component

- Kode unik per organisasi, jenis/metode terkontrol, nilai default opsional Decimal, effective date, status aktif, dan legal notes.
- Seed menyediakan seluruh jenis yang diminta menggunakan data sintetis.
- Tidak ada formula hukum otomatis.

## 7. Hasil simulator sintetis

Skenario GROWTH: 3 pegawai, pokok `1,200.10`, tunjangan `100.00`, kenaikan 10%, employer cost 5%, satu periode.

- Total pokok: `3,960.33`.
- Total tunjangan: `300.00`.
- Total kompensasi: `4,260.33`.
- Estimasi employer cost: `4,473.35`.
- Alokasi 70/30 direkonsiliasi ke `3,131.35` dan `1,342.00`, total tepat `4,473.35`.
- Simulasi menyimpan asumsi/hasil baru dan tidak mengubah proposal atau kompensasi aktif.

## 8. Verifikasi RBAC

Ditambahkan 12 permission `compensation.*`. Enforcement dilakukan server-side melalui permission aktual pada database, bukan pemeriksaan nama role di endpoint. Aksi mutasi sensitif memerlukan recent MFA. HR dapat mengelola tetapi tidak mendapat permission approval policy; Yayasan mendapat approval; Pegawai tetap default-deny. Separation of duties juga diperiksa pada entity creator/proposer.

## 9. Isolasi organisasi

Seluruh query baca/tulis utama membawa `organizationId` dari sesi. Referensi employee, grade, policy, component, unit, proposal, simulation, dan ekspor divalidasi dalam organisasi aktor. Integration test dua organisasi membuktikan policy organisasi B tidak dapat dibaca dalam konteks A.

## 10. Hasil migrasi

- `prisma validate`: PASS.
- Development database `sinur_hrm_dev`: 3 migrasi ditemukan dan schema up to date.
- Seed development: PASS; faktor, grade contoh, pay components, permission, dan role mapping terpasang.
- Shadow database tidak tersedia bagi role development, sehingga SQL migrasi dibuat dengan `prisma migrate diff` terhadap database development lalu diaplikasikan memakai `prisma migrate deploy`; tidak ada reset atau kehilangan data.

## 11. Hasil pengujian

- TypeScript: PASS.
- ESLint: PASS.
- Unit + integration: 11 file, 50 test PASS.
- Desktop E2E: 9 test PASS.
- Mobile E2E: 9 test PASS.
- Regression autentikasi, MFA, employee CRUD, assignment, dokumen privat, audit, manifest, dan service worker tetap PASS.
- Production build Next.js: PASS; seluruh route Compensation terkompilasi.

Acceptance test mencakup calculation, scale validation, version uniqueness, period overlap, approval authorization, organization isolation, unauthorized access, monetary precision, duplicate request, allocation, no mutation, dan audit logging.

## 12. Build dan dependency audit

- `next build`: PASS.
- `npm audit --audit-level=high`: PASS, 0 vulnerability.

## 13. Risiko yang diketahui

- Ini masih arsitektur kebijakan/simulasi, bukan payroll engine.
- Ketentuan hukum, pajak, BPJS, lembur, THR, dan angka upah minimum wajib diverifikasi pemilik kebijakan sebelum fase payroll.
- UI proposal dan simulator menyediakan alur awal; editing massal, import, dan analitik per-pegawai lebih rinci dapat dikembangkan pada fase berikutnya.
- Pengujian memakai data development sintetis dan meninggalkan fixture audit/simulasi yang jelas berlabel sintetis.

## 14. Kesiapan Phase 3

Fondasi grade, policy version, component, proposal, allocation, simulator, approval, RBAC, dan audit siap menjadi input Phase 3 setelah aturan hukum/formula resmi disetujui. Payroll production tetap NO-GO.

## 15. Konfirmasi production

Tidak ada deployment, pembayaran, pemrosesan payroll, penggunaan data gaji nyata, perubahan SINURMAN, atau akses database production selama Phase 2.

## Status

**PASS — Phase 2 acceptance criteria terverifikasi pada local development.**
