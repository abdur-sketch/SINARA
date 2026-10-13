import { prepareTestDatabase } from "./test-database";

async function main() { await prepareTestDatabase(false); }
main().catch(error => { console.error(error); process.exit(1); });
