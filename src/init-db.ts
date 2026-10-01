import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './db';

async function main() {
  const schema = await readFile(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema is ready.');
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
