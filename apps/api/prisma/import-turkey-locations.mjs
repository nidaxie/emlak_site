// Source: TurkiyeAPI 2025 static datasets (provinces, districts, neighborhoods).
// Import is idempotent and does not delete existing location rows.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, 'data', 'turkey');
const provinces = JSON.parse(readFileSync(join(dataDir, 'provinces.json'), 'utf8'));
const districts = JSON.parse(readFileSync(join(dataDir, 'districts.json'), 'utf8'));
const neighborhoods = JSON.parse(readFileSync(join(dataDir, 'neighborhoods.json'), 'utf8'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query('BEGIN');
  const cityIds = new Map();

  for (const province of provinces) {
    const code = String(province.id).padStart(2, '0');
    const city = await client.query(
      `INSERT INTO cities (id, name, code)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
       RETURNING id`,
      [province.name, code],
    );
    cityIds.set(province.id, city.rows[0].id);
  }

  const districtIds = new Map();
  for (const district of districts) {
    const cityId = cityIds.get(district.provinceId);
    if (!cityId) continue;
    const row = await client.query(
      `INSERT INTO districts (id, "cityId", name)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT ("cityId", name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [cityId, district.name],
    );
    districtIds.set(district.id, row.rows[0].id);
  }

  const seen = new Set();
  const batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const districtId = batch.map((item) => item.districtId);
    const name = batch.map((item) => item.name);
    await client.query(
      `INSERT INTO neighborhoods (id, "districtId", name)
       SELECT gen_random_uuid(), item.district_id, item.name
       FROM unnest($1::uuid[], $2::text[]) AS item(district_id, name)
       ON CONFLICT ("districtId", name) DO NOTHING`,
      [districtId, name],
    );
    batch.length = 0;
  };

  for (const neighborhood of neighborhoods) {
    const districtId = districtIds.get(neighborhood.districtId);
    if (!districtId) continue;
    const key = `${districtId}\u0000${neighborhood.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push({ districtId, name: neighborhood.name });
    if (batch.length === 500) await flush();
  }
  await flush();
  await client.query('COMMIT');

  const counts = await client.query(
    `SELECT
       (SELECT count(*) FROM cities WHERE code ~ '^(0[1-9]|[1-7][0-9]|8[01])$') AS cities,
       (SELECT count(*) FROM districts) AS districts,
       (SELECT count(*) FROM neighborhoods) AS neighborhoods`,
  );
  console.log(counts.rows[0]);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
