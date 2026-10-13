# Security policy for Phase 1

This repository must not contain production credentials, real employee data, database dumps, reset tokens, or uploaded documents. Report suspected exposure privately to the project owner and rotate affected development secrets.

Before staging: implement and verify MFA challenge/enrollment for privileged roles, connect an approved reset-token delivery channel, add distributed rate limiting, malware scanning for uploads, encrypted object storage, and a tested backup/restore runbook. Run authenticated horizontal-privilege and database constraint integration tests against an isolated test database.

Production deployment and access to SINURMAN are explicitly out of scope and unauthorized.
