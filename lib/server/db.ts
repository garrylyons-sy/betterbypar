import { Pool, PoolClient, QueryResultRow } from "pg";

let pool: Pool | null = null;
const localRuntime=globalThis as typeof globalThis & {betterByParDemoPool?:Pool};

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  const localDemo=process.env.LOCAL_DEMO==='1'&&process.env.NODE_ENV==='development';

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for app-managed auth.");
  }

  if(localDemo&&localRuntime.betterByParDemoPool)return localRuntime.betterByParDemoPool;
  if (!pool) {
    pool = new Pool({
      connectionString,
      // PGlite multiplexes a single PostgreSQL session. Serialize queries and
      // retain the pool across Next development reloads to avoid protocol races.
      ...(localDemo?{max:1}:{}),
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false }
    });
    if(localDemo)localRuntime.betterByParDemoPool=pool;
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
