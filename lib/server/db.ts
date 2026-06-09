import { Pool, PoolClient, QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function getPool() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for app-managed auth.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false }
    });
  }

  return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return getPool().query<T>(sql, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
