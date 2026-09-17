import { initDb, getDriver } from '../db/index.js';

const driver = await initDb();
console.log(`Banco de dados pronto (driver: ${driver.dialect}).`);
await driver.close();
