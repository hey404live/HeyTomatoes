import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPool } from '../src/database.js';
import { initializeDatabase } from '../src/initialize-database.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

test('crea tablas faltantes, tolera arranques simultáneos y conserva datos', async () => {
  const schema = 'init_test_' + randomUUID().replaceAll('-', '');
  const pool = createPool({ options: `-c search_path=${schema}` });
  // Ejecuta las migraciones reales en un esquema aislado de las tablas públicas.
  const isolatedPool = {
    async connect() {
      const client = await pool.connect();
      return {
        query: sql => client.query(sql.replaceAll('public.', `"${schema}".`)),
        release: () => client.release(),
      };
    },
  };
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await Promise.all([initializeDatabase(isolatedPool), initializeDatabase(isolatedPool)]);
    const { rows: [movie] } = await pool.query(`INSERT INTO peliculas
      (imagen,nombre,sinopsis,anio_estreno,genero,duracion,director)
      VALUES ('https://example.com/poster.jpg','Prueba','Sinopsis',2024,'Drama',90,'Directora') RETURNING id`);
    await pool.query('INSERT INTO resenas(pelicula_id,calificacion,comentario) VALUES($1,5,$2)', [movie.id, 'Reseña']);
    await initializeDatabase(isolatedPool);
    assert.equal((await pool.query('SELECT id FROM peliculas')).rows[0].id, movie.id);
    assert.equal((await pool.query('SELECT comentario FROM resenas')).rows[0].comentario, 'Reseña');
    await pool.query('DROP TABLE resenas');
    await initializeDatabase(isolatedPool);
    assert.equal((await pool.query('SELECT id FROM peliculas')).rows[0].id, movie.id);
    assert.equal((await pool.query('SELECT * FROM resenas')).rowCount, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname=$1 AND indexname=$2', [schema, 'resenas_pelicula_fecha_idx'])).rows[0].count, 1);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
