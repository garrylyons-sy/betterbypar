import { Pool, PoolClient, QueryResultRow } from "pg";

const runtime=globalThis as typeof globalThis & {betterByParDatabasePool?:{connectionString:string;pool:Pool}};

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  const localDemo=process.env.LOCAL_DEMO==='1'&&process.env.NODE_ENV==='development';

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for app-managed auth.");
  }

  const cached=runtime.betterByParDatabasePool;
  if(cached?.connectionString===connectionString)return cached.pool;
  // Route bundles and Next development reloads share one bounded pool per process.
  // Supabase session pooling has a small client limit; serialize the PGlite demo.
  const pool=new Pool({
    connectionString,
    max:localDemo?1:4,
    connectionTimeoutMillis:10000,
    idleTimeoutMillis:10000,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : {rejectUnauthorized:false}
  });
  runtime.betterByParDatabasePool={connectionString,pool};
  if(cached)void cached.pool.end().catch(()=>{});
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
