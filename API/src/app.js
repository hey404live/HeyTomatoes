import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRepository } from './database.js';

const fields = ['imagen', 'nombre', 'sinopsis', 'anioEstreno', 'genero', 'duracion', 'director'];
const textFields = { imagen: 2048, nombre: 200, sinopsis: 10000, genero: 100, director: 200 };
const fail = (status, message) => Object.assign(new Error(message), { status });

function validate(data, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail(400, 'El cuerpo debe ser un objeto JSON.');
  const keys = Object.keys(data);
  if (!keys.length || keys.some(key => !fields.includes(key))) throw fail(400, 'Envía campos válidos de la película; el id se genera automáticamente.');
  if (!partial && fields.some(key => !(key in data))) throw fail(400, `Campos obligatorios: ${fields.join(', ')}.`);
  const result = {};
  for (const key of keys) {
    const value = data[key];
    if (key in textFields) {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > textFields[key]) throw fail(400, `${key} debe ser texto no vacío de hasta ${textFields[key]} caracteres.`);
      result[key] = value.trim();
    } else {
      if (!Number.isInteger(value) || (key === 'anioEstreno' ? value < 1888 || value > 2100 : value < 1 || value > 10000)) throw fail(400, key === 'anioEstreno' ? 'anioEstreno debe ser un entero entre 1888 y 2100.' : 'duracion debe ser un entero entre 1 y 10000 minutos.');
      result[key] = value;
    }
  }
  if ('imagen' in result) {
    let url;
    try { url = new URL(result.imagen); } catch { throw fail(400, 'imagen debe ser una URL http o https válida.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw fail(400, 'imagen debe ser una URL http o https válida.');
  }
  return result;
}

function validateRating(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => !['calificacion', 'comentario'].includes(key))) {
    throw fail(400, 'Envía un objeto JSON con calificacion y comentario.');
  }
  if (typeof data.calificacion !== 'number' || !Number.isFinite(data.calificacion) || data.calificacion < 0 || data.calificacion > 5) {
    throw fail(400, 'calificacion debe ser un número entre 0 y 5.');
  }
  if (typeof data.comentario !== 'string' || !data.comentario.trim() || data.comentario.trim().length > 1200) {
    throw fail(400, 'comentario debe ser texto no vacío de hasta 1200 caracteres.');
  }
  return { calificacion: data.calificacion, comentario: data.comentario.trim() };
}

async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw fail(415, 'Usa Content-Type: application/json.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw fail(413, 'El cuerpo supera el límite de 64 KB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fail(400, 'El cuerpo no contiene JSON válido.'); }
}

export async function createApi({ pool, adminToken = process.env.ADMIN_TOKEN, corsOrigins = process.env.CORS_ORIGINS || '' } = {}) {
  if (typeof adminToken !== 'string' || !adminToken.trim()) throw new Error('Configura ADMIN_TOKEN antes de iniciar la API.');
  const tokenHash = createHash('sha256').update(adminToken).digest();
  const authorized = header => {
    const match = typeof header === 'string' && header.match(/^Bearer ([^\s]+)$/i);
    return !!match && timingSafeEqual(tokenHash, createHash('sha256').update(match[1]).digest());
  };
  if (!pool) throw new Error('Configura la conexión PostgreSQL.');
  const repository = createRepository(pool);
  const allowedOrigins = new Set([
    'null', 'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:4173', 'http://127.0.0.1:4173',
    'https://heytomatoes-07u5oet.apps.unbroker.cloud',
  ]);
  for (const value of corsOrigins.split(',').map(value => value.trim()).filter(Boolean)) {
    let url;
    try { url = new URL(value); } catch { throw new Error('CORS_ORIGINS debe contener orígenes HTTP/HTTPS separados por comas.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS_ORIGINS debe contener orígenes HTTP/HTTPS sin rutas ni credenciales.');
    }
    allowedOrigins.add(url.origin);
  }

  return createServer(async (req, res) => {
    const json = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
      res.end(JSON.stringify(body));
    };
    // Los archivos file:// se presentan al servidor con Origin: null.
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      json(403, { error: 'Origen no permitido.' });
      return;
    }
    if (allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.method === 'OPTIONS' && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const adminRoute = pathname === '/admin/sesion' || pathname === '/admin/peliculas';
      const movieMutation = (pathname === '/peliculas' && req.method === 'POST') ||
        (/^\/peliculas\/[^/]+$/.test(pathname) && ['PUT', 'PATCH', 'DELETE'].includes(req.method));
      if (adminRoute || movieMutation) {
        res.setHeader('Cache-Control', 'no-store');
        if (!authorized(req.headers.authorization)) {
          json(401, { error: 'Token de administración inválido o ausente.' }, { 'WWW-Authenticate': 'Bearer' });
          return;
        }
      }
      if (adminRoute) {
        if (req.method !== 'GET') { json(405, { error: 'Método no permitido.' }, { Allow: 'GET' }); return; }
        json(200, pathname === '/admin/sesion' ? { autenticado: true } : await repository.list());
        return;
      }
      if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Hola mundo');
        return;
      }
      if (pathname === '/peliculas') {
        if (req.method === 'GET') { json(200, await repository.list()); return; }
        if (req.method === 'POST') {
          const data = validate(await readBody(req));
          const movie = await repository.create(data);
          json(201, movie);
          return;
        }
        json(405, { error: 'Método no permitido.' }, { Allow: 'GET, POST' });
        return;
      }
      const averageMatch = pathname.match(/^\/peliculas\/([^/]+)\/promedio$/);
      if (averageMatch) {
        if (req.method !== 'GET') {
          json(405, { error: 'Método no permitido.' }, { Allow: 'GET' });
          return;
        }
        const peliculaId = averageMatch[1];
        json(200, await repository.average(peliculaId));
        return;
      }
      const ratingMatch = pathname.match(/^\/peliculas\/([^/]+)\/calificaciones$/);
      if (ratingMatch) {
        if (!['GET', 'POST'].includes(req.method)) {
          json(405, { error: 'Método no permitido.' }, { Allow: 'GET, POST' });
          return;
        }
        const peliculaId = ratingMatch[1];
        await repository.exists(peliculaId);
        if (req.method === 'GET') {
          json(200, await repository.reviews(peliculaId));
          return;
        }
        const data = validateRating(await readBody(req));
        json(201, await repository.addReview(peliculaId, data));
        return;
      }
      const match = pathname.match(/^\/peliculas\/([^/]+)$/);
      if (match) {
        if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          json(405, { error: 'Método no permitido.' }, { Allow: 'PUT, PATCH, DELETE' });
          return;
        }
        const id = match[1];
        const data = req.method === 'DELETE' ? null : validate(await readBody(req), req.method === 'PATCH');
        const result = req.method === 'DELETE' ? await repository.delete(id) : await repository.update(id, data);
        if (req.method === 'DELETE') { res.writeHead(204); res.end(); }
        else json(200, result);
        return;
      }
      json(404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      if (!error.status) console.error('Error de almacenamiento:', error.code || 'desconocido');
      if (!res.headersSent && !res.destroyed) json(error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación.' });
    }
  });
}
