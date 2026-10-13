import { cleanupTestDatabase, prepareTestDatabase } from "./test-database";

export async function setup() { await prepareTestDatabase(false); }
export async function teardown() { await cleanupTestDatabase(); }
