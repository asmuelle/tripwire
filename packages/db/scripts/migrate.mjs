// Applies the checked-in SQL migrations in ./drizzle to DATABASE_URL, in order,
// tracking applied files in a _migrations table. Run via `just migrate`.
import console from 'node:console';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Start Postgres with `just db-up` and export it.');
  process.exit(1);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const run = async () => {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const [done] = await sql`SELECT 1 AS ok FROM _migrations WHERE name = ${file}`;
      if (done) {
        console.error(`skip ${file} (already applied)`);
        continue;
      }
      const body = await readFile(join(migrationsDir, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
      console.error(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
};

run().catch((error) => {
  console.error('migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
