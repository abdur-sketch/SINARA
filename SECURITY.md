# Security policy for Phase 1.5

This repository must not contain production credentials, real employee data, database dumps, reset tokens, or uploaded documents. Report suspected exposure privately to the project owner and rotate affected development secrets.

Implemented locally: mandatory privileged-role TOTP, one-time recovery codes, encrypted MFA secrets, session revocation, account/MFA lockout, PostgreSQL-backed shared rate limiting, default-deny RBAC administration protections, cross-organization IDOR tests, reset-token replay protection, file signature validation, private quarantine, and safe PWA caching.

Before staging: replace the fake mailer, connect an approved malware scanning service and encrypted object storage, establish key rotation and monitoring, and complete a tested backup/restore runbook. Repeat authenticated horizontal-privilege and database constraint integration tests against an isolated staging database.

Production deployment and access to SINURMAN are explicitly out of scope and unauthorized.
