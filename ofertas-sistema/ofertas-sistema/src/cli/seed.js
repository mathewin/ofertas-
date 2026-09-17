import { initDb, getDriver } from '../db/index.js';
import { runTracker } from '../tracker/engine.js';

await initDb();
const summary = await runTracker({ trigger: 'seed' });
console.log(`Seed concluido: ${summary.created} ofertas criadas, ${summary.updated} atualizadas.`);
await getDriver().close();
