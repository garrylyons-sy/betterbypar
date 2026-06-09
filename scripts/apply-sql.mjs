import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error("Usage: pnpm db:apply <path-to-sql-file>");
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const resolvedSqlFile = path.resolve(process.cwd(), sqlFile);
const sql = fs.readFileSync(resolvedSqlFile, "utf8");
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false }
});

try {
  await pool.query(sql);
  console.log(`Applied ${sqlFile}`);
} finally {
  await pool.end();
}
