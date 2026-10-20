import { readFile } from 'node:fs/promises';
import { createPool } from '../src/database.js';
process.loadEnvFile(new URL('../../.env',import.meta.url));
let source;
try { source=await readFile(new URL('../data/peliculas.json',import.meta.url),'utf8'); }
catch(error){if(error.code==='ENOENT'){console.log('No existe data/peliculas.json; no hay datos que importar.');process.exit(0);}throw error;}
const movies=JSON.parse(source);
if(!Array.isArray(movies))throw new Error('El archivo JSON no contiene un arreglo.');
const pool=createPool();
const client=await pool.connect();
let addedMovies=0,addedReviews=0;
try {
  await client.query('BEGIN');
  for(const movie of movies){
    const values=[movie.id,movie.imagen,movie.nombre,movie.sinopsis,movie.anioEstreno,movie.genero,movie.duracion,movie.director];
    const inserted=await client.query('INSERT INTO peliculas(id,imagen,nombre,sinopsis,anio_estreno,genero,duracion,director) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',values);
    addedMovies+=inserted.rowCount;
    for(const review of movie.calificaciones||[]) {
      if(review.peliculaId!==movie.id)throw new Error('Una reseña no corresponde a su película.');
      const result=await client.query('INSERT INTO resenas(id,pelicula_id,calificacion,comentario,fecha_creacion) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[review.id,movie.id,review.calificacion,review.comentario,review.fechaCreacion]);
      addedReviews+=result.rowCount;
    }
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({peliculasImportadas:addedMovies,resenasImportadas:addedReviews}));
} catch(error){
  await client.query('ROLLBACK');
  console.error('Importación cancelada; no se guardaron cambios. Código:',error.code||'datos inválidos');
  process.exitCode=1;
} finally{client.release();await pool.end();}
