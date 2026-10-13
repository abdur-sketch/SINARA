# SINUR HRM — Phase 1

Standalone HR management foundation for Yayasan Nurul Iman. Phase 1 contains authentication, default-deny RBAC, organization/unit/position masters, employee master, cross-unit assignments, private employee documents, dashboard, and audit logs. It deliberately contains **no payroll processing** and no SINURMAN integration.

## Stack

- Next.js App Router + strict TypeScript + React
- Tailwind CSS 4 with a small reusable component layer
- PostgreSQL 16 + Prisma ORM
- Auth.js / NextAuth credentials sessions, bcrypt password hashing
- Zod + React Hook Form
- Vitest + Playwright

## Local development

Requirements: Node.js 20.9+ (Node 24 recommended), Docker, and npm.

1. Copy `.env.example` to `.env` and generate a random `NEXTAUTH_SECRET` using `openssl rand -base64 32`.
2. Put a development-only admin email and a unique 14+ character password in `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
3. Start the isolated database: `docker compose up -d postgres`.
4. Apply versioned migrations: `npm run db:migrate`.
5. Seed organization masters and the bootstrap administrator: `npm run db:seed`.
6. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` after seeding.
7. Start the app: `npm run dev`, then open `http://localhost:3000`.

Never reuse production credentials or point `DATABASE_URL` at SINURMAN. The included database uses a dedicated `sinur_hrm_dev` database and port 5434.

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
- Sessions use signed JWTs, HTTP-only SameSite cookies, an eight-hour maximum, and secure cookies in production.
- Password reset tokens are random, stored only as SHA-256 hashes, single use, and expire after 30 minutes. Development delivery is logged locally; connect an approved email provider before staging.
- Uploaded documents allow PDF/JPEG/PNG up to 5 MB, are written outside `public/`, and are downloaded only through an authenticated, organization-scoped route.
- Audit metadata redacts keys containing password, token, secret, or content.
- `organization_id` supports future isolation design but is not a claim of production-ready multi-tenancy.
- MFA is represented in the user model but enrollment/challenge is not yet implemented; privileged staging accounts must not be activated until that gap is closed.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

Database-backed tests and authenticated E2E flows require the Docker database, migration, and seeded development admin.

## Backup and recovery

For local development, create an encrypted logical backup with `pg_dump` before schema changes and restore into a newly created development database with `pg_restore`. Do not commit dumps. Before staging, define retention, encryption keys, access owners, restore drills, RPO/RTO, and an approved off-machine storage destination. Production deployment is not authorized in Phase 1.
