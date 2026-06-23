import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/altay';

  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema, casing: 'snake_case' });
}

export type Database = ReturnType<typeof createDb>;

let singleton: Database | undefined;

/** Ленивый общий клиент — удобно для серверной среды с одним подключением. */
export function getDb(): Database {
  if (!singleton) singleton = createDb();
  return singleton;
}
