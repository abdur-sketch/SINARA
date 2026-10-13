import { cleanupTestDatabase } from "../scripts/test-database";

export default async function globalTeardown() { await cleanupTestDatabase(); }
