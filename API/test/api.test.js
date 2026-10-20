import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../test-support/database.js';

const adminToken = 'test-only-admin-token';
const movie = { imagen: 'https://example.com/poster.jpg', nombre: 'Interstellar', sinopsis: 'Un viaje entre las estrellas.', anioEstreno: 2014, genero: 'Ciencia ficción', duracion: 169, director: 'Christopher Nolan' };
const body = data => ({ headers: { 'Content-Type': 'application/json', Origin: 'null' }, body: JSON.stringify(data) });
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

test('CRUD, validación, concurrencia y persistencia de películas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heytomatoes-test-'));
  const dataFile = join(directory, 'peliculas.json');
  let server = await createApi({ dataFile, adminToken });
  try {
    await listen(server);
    let base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options = {}) => fetch(base + path, { ...options, headers: { Authorization: `Bearer ${adminToken}`, ...options.headers } });
    const preflight = await request('/peliculas', {
      method: 'OPTIONS',
      headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');
    assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.ok(preflight.headers.get('access-control-allow-methods').split(', ').includes(method));
    }
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']) {
      const response = await request('/peliculas', { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }
    const localRead = await request('/peliculas', { headers: { Origin: 'null' } });
    assert.equal(localRead.status, 200);
    assert.equal(localRead.headers.get('access-control-allow-origin'), 'null');
    assert.equal(localRead.headers.get('vary'), 'Origin');
    const localError = await request('/desconocida', { headers: { Origin: 'null' } });
    assert.equal(localError.status, 404);
    assert.equal(localError.headers.get('access-control-allow-origin'), 'null');
    const denied = await request('/peliculas', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(movie) });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal(await (await request('/')).text(), 'Hola mundo');
    assert.deepEqual(await (await request('/peliculas')).json(), []);
    for (const invalid of [{}, { ...movie, duracion: -1 }, { ...movie, nombre: ' ' }, { ...movie, imagen: 'javascript:alert(1)' }, { ...movie, anioEstreno: '2014' }, { ...movie, id: 'externo' }]) {
      assert.equal((await request('/peliculas', { method: 'POST', ...body(invalid) })).status, 400);
    }
    assert.equal((await request('/peliculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await request('/peliculas', { method: 'POST', body: '{}' })).status, 415);
    const created = await request('/peliculas', { method: 'POST', ...body(movie) });
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.ok(item.id);
    assert.equal(item.nombre, movie.nombre);
    const patched = await request(`/peliculas/${item.id}`, { method: 'PATCH', ...body({ nombre: 'Nuevo nombre' }) });
    assert.equal(patched.status, 200);
    assert.deepEqual(await patched.json(), { ...movie, id: item.id, nombre: 'Nuevo nombre' });
    assert.equal((await request(`/peliculas/${item.id}`, { method: 'PUT', ...body({ nombre: 'Incompleta' }) })).status, 400);
    assert.equal((await request(`/peliculas/${item.id}`, { method: 'PUT', ...body({ ...movie, duracion: 170 }) })).status, 200);
    const concurrent = await Promise.all(Array.from({ length: 4 }, (_, i) => request('/peliculas', { method: 'POST', ...body({ ...movie, nombre: `Película ${i}` }) })));
    assert.ok(concurrent.every(response => response.status === 201));
    await close(server);
    server = await createApi({ dataFile, adminToken });
    await listen(server);
    base = `http://127.0.0.1:${server.address().port}`;
    const persisted = await (await request('/peliculas')).json();
    assert.equal(persisted.length, 5);
    assert.equal(persisted.find(m => m.id === item.id).duracion, 170);
    const deleted = await request(`/peliculas/${item.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');
    assert.equal((await request(`/peliculas/${item.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await request('/peliculas/no-existe', { method: 'PATCH', ...body({ nombre: 'Nada' }) })).status, 404);
    assert.equal((await request('/peliculas', { method: 'DELETE' })).status, 405);
    assert.equal((await request('/desconocida')).status, 404);
    await close(server);
    server = await createApi({ dataFile, adminToken });
    await listen(server);
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await request('/peliculas')).json()).length, 4);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('calificaciones: límites, aislamiento, persistencia y conservación al editar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heytomatoes-ratings-'));
  const dataFile = join(directory, 'peliculas.json');
  let server = await createApi({ dataFile, adminToken });
  try {
    await listen(server);
    let base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options = {}) => fetch(base + path, { ...options, headers: { Authorization: `Bearer ${adminToken}`, ...options.headers } });
    const first = await (await request('/peliculas', { method: 'POST', ...body(movie) })).json();
    const second = await (await request('/peliculas', { method: 'POST', ...body(movie) })).json();
    const path = `/peliculas/${first.id}/calificaciones`;
    const averagePath = `/peliculas/${first.id}/promedio`;
    assert.deepEqual(await (await request(averagePath)).json(), { peliculaId: first.id, promedio: null, totalCalificaciones: 0 });
    assert.equal((await request('/peliculas/no-existe/promedio')).status, 404);
    const wrongMethod = await request(averagePath, { method: 'POST', ...body({}) });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('allow'), 'GET');
    assert.deepEqual(await (await request(path)).json(), []);
    for (const invalid of [null, [], {}, { calificacion: -1, comentario: 'No' }, { calificacion: 6, comentario: 'Sí' }, { calificacion: '5', comentario: 'Sí' }, { calificacion: 5, comentario: ' ' }, { calificacion: 5 }, { calificacion: 5, comentario: 'a'.repeat(1201) }, { calificacion: 5, comentario: 'Bien', id: 'ajeno' }]) {
      assert.equal((await request(path, { method: 'POST', ...body(invalid) })).status, 400);
    }
    const ratings = await Promise.all([0, 4.5, 5].map(calificacion => request(path, { method: 'POST', ...body({ calificacion, comentario: '  Una opinión de prueba.  ' }) })));
    for (const response of ratings) {
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('access-control-allow-origin'), 'null');
      const rating = await response.json();
      assert.equal(rating.peliculaId, first.id);
      assert.equal(rating.comentario, 'Una opinión de prueba.');
      assert.ok(rating.id);
      assert.ok(!Number.isNaN(Date.parse(rating.fechaCreacion)));
    }
    const list = await (await request(path)).json();
    assert.equal(list.length, 3);
    const averageResponse = await request(averagePath, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(averageResponse.status, 200);
    assert.equal(averageResponse.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.deepEqual(await averageResponse.json(), { peliculaId: first.id, promedio: 3.17, totalCalificaciones: 3 });
    const secondPath = `/peliculas/${second.id}/calificaciones`;
    assert.equal((await request(secondPath, { method: 'POST', ...body({ calificacion: 0, comentario: 'No me gustó.' }) })).status, 201);
    assert.deepEqual(await (await request(`/peliculas/${second.id}/promedio`)).json(), { peliculaId: second.id, promedio: 0, totalCalificaciones: 1 });
    assert.equal(new Set(list.map(r => r.id)).size, 3);
    assert.deepEqual(list.map(r => r.calificacion).sort((a, b) => a-b), [0, 4.5, 5]);
    assert.equal((await (await request(`/peliculas/${second.id}/calificaciones`)).json()).length, 1);
    assert.equal((await request('/peliculas/no-existe/calificaciones')).status, 404);
    assert.equal((await request('/peliculas/no-existe/calificaciones', { method: 'POST', ...body({ calificacion: 5, comentario: 'Bien' }) })).status, 404);
    assert.equal((await request(path, { method: 'DELETE' })).status, 405);
    assert.equal((await request(path, { method: 'POST', body: '{}' })).status, 415);
    const preflight = await request(path, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');
    const updated = await request(`/peliculas/${first.id}`, { method: 'PUT', ...body({ ...movie, nombre: 'Título actualizado' }) });
    assert.equal(updated.status, 200);
    assert.equal('calificaciones' in await updated.json(), false);
    assert.equal((await request(`/peliculas/${first.id}`, { method: 'PATCH', ...body({ duracion: 170 }) })).status, 200);
    await close(server);
    server = await createApi({ dataFile, adminToken });
    await listen(server);
    base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await (await request(path)).json(), list);
    assert.deepEqual(await (await request(averagePath)).json(), { peliculaId: first.id, promedio: 3.17, totalCalificaciones: 3 });
    assert.equal((await request(`/peliculas/${first.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await request(path)).status, 404);
    assert.equal((await request(averagePath)).status, 404);
    assert.equal((await (await request(`/peliculas/${second.id}/calificaciones`)).json()).length, 1);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('administración exige token en todas las operaciones y mantiene público el catálogo', async () => {
  await assert.rejects(createApi({ adminToken: '' }), /Configura ADMIN_TOKEN/);
  const directory = await mkdtemp(join(tmpdir(), 'heytomatoes-auth-'));
  const server = await createApi({ dataFile: join(directory, 'peliculas.json'), adminToken });
  try {
    await listen(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, options) => fetch(base + path, options);
    const authenticated = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const created = await request('/peliculas', { method: 'POST', headers: authenticated, body: JSON.stringify(movie) });
    const item = await created.json();
    for (const authorization of [undefined, 'Bearer incorrecto', 'Basic abc', `Bearer ${adminToken} extra`]) {
      for (const [method, path] of [['GET', '/admin/sesion'], ['GET', '/admin/peliculas'], ['POST', '/peliculas'], ['PUT', `/peliculas/${item.id}`], ['PATCH', `/peliculas/${item.id}`], ['DELETE', `/peliculas/${item.id}`]]) {
        const response = await request(path, { method, headers: { ...(authorization ? { Authorization: authorization } : {}), 'Content-Type': 'application/json' }, ...(['POST','PUT','PATCH'].includes(method) ? { body: JSON.stringify(movie) } : {}) });
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.equal(response.headers.get('www-authenticate'), 'Bearer');
        assert.equal(response.headers.get('cache-control'), 'no-store');
      }
    }
    const login = await request('/admin/sesion', { headers: authenticated });
    assert.deepEqual(await login.json(), { autenticado: true });
    const listing = await request('/admin/peliculas', { headers: authenticated });
    assert.equal(listing.status, 200);
    assert.equal((await listing.json()).length, 1);
    assert.equal((await request(`/peliculas/${item.id}`, { method: 'PATCH', headers: authenticated, body: JSON.stringify({ nombre: 'Editada' }) })).status, 200);
    const publicList = await request('/peliculas');
    assert.equal(publicList.status, 200);
    const publicMovies = await publicList.json();
    assert.equal(publicMovies.length, 1);
    assert.equal(publicMovies[0].nombre, 'Editada');
    assert.equal((await request(`/peliculas/${item.id}/calificaciones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calificacion: 5, comentario: 'Pública' }) })).status, 201);
    assert.equal((await request(`/peliculas/${item.id}/promedio`)).status, 200);
    const preflight = await request('/admin/peliculas', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    assert.equal(preflight.status, 204);
    assert.ok(preflight.headers.get('access-control-allow-headers').includes('Authorization'));
    assert.equal((await request(`/peliculas/${item.id}`, { method: 'DELETE', headers: authenticated })).status, 204);
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});
