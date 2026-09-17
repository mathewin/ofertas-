import { initDb, getDriver } from '../db/index.js';
import { runTracker } from '../tracker/engine.js';

await initDb();
const summary = await runTracker({ trigger: 'cli' });
console.log(JSON.stringify(summary, null, 2));
await getDriver().close();
