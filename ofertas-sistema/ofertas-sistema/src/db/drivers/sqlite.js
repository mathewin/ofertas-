import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const normalize = (params = []) => (params || []).map((value) => {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
});

export function createSqliteDriver(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');

  return {
    dialect: 'sqlite',
    async exec(sql) {
      database.exec(sql);
    },
    async query(sql, params = []) {
      const statement = database.prepare(sql);
      return statement.all(...normalize(params));
    },
    async execute(sql, params = []) {
      const statement = database.prepare(sql);
      const result = statement.run(...normalize(params));
      return {
        changes: Number(result.changes ?? 0),
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      };
    },
    async close() {
      database.close();
    },
  };
}

export default createSqliteDriver;
