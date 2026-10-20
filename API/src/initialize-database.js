import { readFile } from 'node:fs/promises';

export async function initializeDatabase(pool) {
  const client = await pool.connect();
  try {
    for (const file of ['001_create_peliculas.sql', '002_create_resenas.sql']) {
      const sql = await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8');
      await client.query(sql);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
