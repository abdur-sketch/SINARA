# SINARA — Phase 3 Attendance, Leave & Compensation

Standalone HR management foundation for Yayasan Nurul Iman. Phase 3 adds server-time attendance, effective work schedules, holidays, correction approval, leave/permission workflows, scoped reporting, and employee self-service on top of the Phase 2 compensation architecture. It deliberately contains **no payroll processing**, no biometric tracking, no production deployment, and no SINURMAN integration.

## Stack

- Next.js App Router + strict TypeScript + React
- Tailwind CSS 4 with a small reusable component layer
- PostgreSQL 16 + Prisma ORM
- Auth.js / NextAuth credentials sessions, bcrypt password hashing
- Zod + React Hook Form
- Vitest + Playwright

## Local development

Requirements: Node.js 20.9+ (Node 24 recommended), PostgreSQL 16, and npm. Docker is optional.

1. Copy `.env.example` to `.env`; generate separate random values for `NEXTAUTH_SECRET` and `MFA_ENCRYPTION_KEY` using `openssl rand -base64 32`.
2. Put a development-only admin email and a unique 14+ character password in `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
3. Choose one local database path:
   - Existing PostgreSQL: create/use `sinur_hrm_dev` and set port `5432` in `.env`.
   - Docker Compose: run `docker compose up -d postgres` and keep port `5434` from `.env.example`.
4. Apply versioned migrations: `npm run db:migrate`.
5. Seed organization masters and the bootstrap administrator: `npm run db:seed`.
6. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` after seeding.
7. Start the app: `npm run dev`, then open `http://localhost:3000`.

Never reuse production credentials or point `DATABASE_URL` at SINURMAN. The included database uses a dedicated `sinur_hrm_dev` database; use port 5432 for an existing local PostgreSQL installation or port 5434 for the provided Docker Compose service.

## Attendance and leave

- Administrators link a login account to exactly one employee from **Pengguna** before employee self-service is used.
- Check-in and check-out use server time in `Asia/Jakarta`; clients cannot submit their own clock time.
- Schedules are effective-dated, can be organization-wide or unit-specific, and reject overlapping employee assignments.
- Attendance corrections and leave requests require a different reviewer; unit heads are restricted to their own unit.
- Approved leave creates daily attendance statuses but never changes compensation or payroll.
- Monthly CSV export follows the actor's organization/unit scope.
- The initial free workflow is web/PWA only. Location tracking, face recognition, fingerprint devices, and automatic payroll deductions are intentionally excluded.

## Authorization

Every protected page requires a server session. API handlers independently require explicit permissions and filter every record by `organizationId`; client navigation is not treated as an authorization boundary. Missing permissions are denied by default.

| Role | Phase 1 access |
| --- | --- |
| SUPER_ADMIN | All Phase 1 permissions |
| YAYASAN | Read organization, units, employees, positions, assignments, and audit |
| HR_ADMIN | Manage employee, document, unit, position, and assignment data; read audit |
| BENDAHARA | Read organization and employee structure only |
| KEPALA_UNIT | Read units, employees, positions, and assignments |
| PEGAWAI | Read own employee profile permission only |

## Security notes

- Passwords use bcrypt cost 12. Five failed attempts lock an account for 15 minutes.
- Privileged roles must enroll TOTP before receiving a session. Secrets use AES-256-GCM under a separate key; recovery codes are bcrypt hashes and single use. Sensitive administration requires MFA verified within ten minutes.
- Sessions use signed JWTs, HTTP-only SameSite cookies, an eight-hour maximum, and `sessionVersion` revocation after password, account, role, or MFA changes.
- Password reset tokens are random, stored only as SHA-256 hashes, single use, and expire after 30 minutes. Development delivery goes to an in-memory fake mailer and is never logged.
- Login, MFA, reset, and administration limits use PostgreSQL-backed buckets shared by all app instances.
- Uploaded documents allow PDF/JPEG/PNG up to 5 MB, validate magic bytes, are written outside `public/` with private permissions, and remain quarantined until authorized review. Only approved files can be downloaded.
- The service worker caches only the public offline page and icon. It never stores API, authentication, protected-page, or document responses.
- Audit metadata redacts keys containing password, token, secret, or content.
- Every administration and employee lookup remains scoped by `organization_id`; automated IDOR tests cover read, edit, archive, document, and assignment paths.

## MFA recovery

Self-service MFA removal requires the current password plus a current TOTP or unused recovery code at `POST /api/auth/mfa/reset`; it revokes all existing sessions. If an administrator is locked out, an operator with local database and encryption-key access can calculate `MFA_RECOVERY_AUTH` as HMAC-SHA256 of `reset-mfa:<email>` using `MFA_ENCRYPTION_KEY`, then run `npm run security:reset-mfa -- --email user@example.test`. The CLI audits the recovery, clears MFA material, and increments the session version. Never paste the authorization value into tickets or commit it.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

Vitest and Playwright automatically create unique temporary PostgreSQL schemas, migrate them, and remove them after the run. Test fixtures no longer enter the development schema. The test harness rejects non-local databases and any database name other than `sinur_hrm_dev`. No test uses production or SINURMAN data.

## Remaining staging gates

The fake mailer and quarantine scanner are deliberate development adapters. Before staging, connect an approved transactional mail provider and malware scanner/object store, exercise backup restoration, define secret rotation and monitoring, and repeat the security suite against an isolated staging database. Phase 1.5 does not authorize production deployment.

## Backup and recovery

Create a local logical backup with `npm run db:backup`. Dumps are written to ignored `backups/`. Verify the latest dump by restoring it into a temporary `sinur_hrm_restore_*` database with `npm run db:restore:verify`; the verification database is removed automatically. Set `LOCAL_POSTGRES_ADMIN_URL` when the operating-system PostgreSQL administrator is not available through the default local socket. Use `-- --file /path/to/file.dump --keep` only when an explicitly retained restore database is needed.

Before staging, add encrypted off-machine storage, retention, access owners, restore drills, and agreed RPO/RTO. Production deployment remains unauthorized in Phase 2.
