import { sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { cities } from './schema.js';
import { CITIES } from './data/cities.js';

async function main() {
  const db = createDb();

  console.log(`Seeding ${CITIES.length} cities…`);
  await db
    .insert(cities)
    .values(CITIES)
    .onConflictDoUpdate({
      target: cities.code,
      set: {
        name: sql`excluded.name`,
        country: sql`excluded.country`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
      },
    });

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
