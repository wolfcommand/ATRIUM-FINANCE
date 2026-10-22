import path from "node:path";
import { createApp } from "./app.js";
import { openDb, setDb } from "./db/client.js";
import { seedDatabase } from "./db/seed.js";
import { startRelay } from "./modules/events/relay.js";
import { ensureFinanceEmployeeRefTable } from "./modules/events/financeEmployeeRef.js";

const PORT = Number(process.env.PORT) || 4000;
const dbPath = process.env.WOLF_DB_PATH ?? path.join(process.cwd(), "data", "wolf.sqlite");

setDb(openDb(dbPath));
seedDatabase();
ensureFinanceEmployeeRefTable();

const app = createApp();
startRelay(Number(process.env.WOLF_RELAY_INTERVAL_MS) || 500);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wolf API listening on http://0.0.0.0:${PORT}`);
});
