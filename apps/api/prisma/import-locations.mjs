import { readFileSync } from 'node:fs';
import pg from 'pg';

const file = process.argv[2];

if (!file || !process.env.DATABASE_URL) {
  console.error(
    'Usage: DATABASE_URL=... node prisma/import-locations.mjs <file.json>',
  );
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, 'utf8'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query('BEGIN');

  for (const city of payload.cities ?? []) {
    const cityRow = await client.query(
      `INSERT INTO cities (id, name, code)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (name) DO UPDATE SET code = COALESCE(EXCLUDED.code, cities.code)
       RETURNING id`,
      [city.name, city.code ?? null],
    );
    const cityId = cityRow.rows[0].id;

    for (const district of city.districts ?? []) {
      const districtRow = await client.query(
        `INSERT INTO districts (id, "cityId", name)
         VALUES (gen_random_uuid(), $1, $2)
         ON CONFLICT ("cityId", name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cityId, district.name],
      );
      const districtId = districtRow.rows[0].id;

      for (const name of district.neighborhoods ?? []) {
        await client.query(
          `INSERT INTO neighborhoods (id, "districtId", name)
           VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT ("districtId", name) DO NOTHING`,
          [districtId, name],
        );
      }
    }
  }

  await client.query('COMMIT');
  console.log('locations imported');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
