import pg from 'pg';
export function createPool(options = {}) {
  const pool = new pg.Pool({ connectionTimeoutMillis: 5000, ...options });
  pool.on('error', () => console.error('Se perdió una conexión inactiva con PostgreSQL.'));
  return pool;
}
const columns = { imagen:'imagen', nombre:'nombre', sinopsis:'sinopsis', anioEstreno:'anio_estreno', genero:'genero', duracion:'duracion', director:'director' };
const movieFields = 'id, imagen, nombre, sinopsis, anio_estreno AS "anioEstreno", genero, duracion, director';
const reviewFields = 'id, pelicula_id AS "peliculaId", calificacion::float8 AS calificacion, comentario, fecha_creacion AS "fechaCreacion"';
const missing = () => Object.assign(new Error('Película no encontrada.'), { status:404 });
export function createRepository(pool) {
  return {
    async list() { return (await pool.query(`SELECT ${movieFields} FROM peliculas ORDER BY nombre, id`)).rows; },
    async exists(id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw missing();
      if (!(await pool.query('SELECT 1 FROM peliculas WHERE id=$1',[id])).rowCount) throw missing();
    },
    async create(data) {
      const keys=Object.keys(columns);
      return (await pool.query(`INSERT INTO peliculas (${keys.map(k=>columns[k]).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING ${movieFields}`, keys.map(k=>data[k]))).rows[0];
    },
    async update(id,data) {
      await this.exists(id);
      const keys=Object.keys(data);
      const result=await pool.query(`UPDATE peliculas SET ${keys.map((k,i)=>`${columns[k]}=$${i+2}`).join(',')} WHERE id=$1 RETURNING ${movieFields}`, [id,...keys.map(k=>data[k])]);
      if(!result.rowCount)throw missing();
      return result.rows[0];
    },
    async delete(id) {
      await this.exists(id);
      if(!(await pool.query('DELETE FROM peliculas WHERE id=$1',[id])).rowCount)throw missing();
    },
    async reviews(id) {
      await this.exists(id);
      return (await pool.query(`SELECT ${reviewFields} FROM resenas WHERE pelicula_id=$1 ORDER BY fecha_creacion,id`,[id])).rows;
    },
    async addReview(id,data) {
      await this.exists(id);
      try { return (await pool.query(`INSERT INTO resenas(pelicula_id,calificacion,comentario) VALUES ($1,$2,$3) RETURNING ${reviewFields}`, [id,data.calificacion,data.comentario])).rows[0]; }
      catch(error){if(error.code==='23503')throw missing();throw error;}
    },
    async average(id) {
      await this.exists(id);
      const result=await pool.query('SELECT round(avg(calificacion),2)::float8 AS promedio, count(*)::integer AS "totalCalificaciones" FROM resenas WHERE pelicula_id=$1',[id]);
      return { peliculaId:id,...result.rows[0] };
    }
  };
}
