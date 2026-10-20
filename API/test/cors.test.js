import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/app.js';

const cloudOrigin = 'https://heytomatoes-07u5oet.apps.unbroker.cloud';
const pool = { query: async () => ({ rows: [] }) };

test('CORS permite el cliente desplegado y dominios configurados, manteniendo autenticación y rechazo de otros orígenes', async () => {
  const server = await createApi({ pool, adminToken: 'test-token', corsOrigins: ' https://custom.example.com/, https://second.example.com ' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const origin of [cloudOrigin, 'https://custom.example.com', 'https://second.example.com']) {
      const response = await fetch(base + '/peliculas', { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('vary'), 'Origin');
      assert.deepEqual(await response.json(), []);
      const preflight = await fetch(base + '/peliculas', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
      assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
    }
    for (const origin of ['https://unknown.example.com', cloudOrigin + '.evil.example', 'http://heytomatoes-07u5oet.apps.unbroker.cloud']) {
      const response = await fetch(base + '/peliculas', { headers: { Origin: origin } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    const unauthorized = await fetch(base + '/admin/peliculas', { headers: { Origin: cloudOrigin } });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('access-control-allow-origin'), cloudOrigin);
    assert.equal((await fetch(base + '/peliculas')).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('CORS rechaza configuraciones con comodines, rutas y credenciales', async () => {
  for (const corsOrigins of ['*', 'https://example.com/path', 'https://user:password@example.com', 'file:///tmp', 'https://example.com?x=1']) {
    await assert.rejects(createApi({ pool, adminToken: 'test-token', corsOrigins }), /CORS_ORIGINS/);
  }
});
