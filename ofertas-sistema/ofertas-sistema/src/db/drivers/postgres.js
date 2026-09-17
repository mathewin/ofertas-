import pg from 'pg';

const { Pool } = pg;

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const normalize = (params = []) => (params || []).map((value) => {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
});

export function createPostgresDriver(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada para DB_DRIVER=postgres');
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    max: 5,
  });

  return {
    dialect: 'postgres',
    async exec(sql) {
      await pool.query(sql);
    },
    async query(sql, params = []) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalize(params));
      return result.rows;
    },
    async execute(sql, params = []) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalize(params));
      return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows?.[0]?.id ?? 0 };
    },
    async close() {
      await pool.end();
    },
  };
}

export default createPostgresDriver;
