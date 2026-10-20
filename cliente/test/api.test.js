import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listMovies } from '../src/api.js'

test('carga promedios reales, cero, películas sin votos y errores independientes', async () => {
  const original = globalThis.fetch
  const movies = ['decimal', 'zero', 'empty', 'error'].map(id => ({ id, nombre: id, duracion: 90 }))
  try {
    globalThis.fetch = async url => {
      if (url.endsWith('/peliculas')) return Response.json(movies)
      if (url.includes('/decimal/')) return Response.json({ promedio: 4.25, totalCalificaciones: 4 })
      if (url.includes('/zero/')) return Response.json({ promedio: 0, totalCalificaciones: 1 })
      if (url.includes('/empty/')) return Response.json({ promedio: null, totalCalificaciones: 0 })
      return new Response('', { status: 500 })
    }
    const result = await listMovies()
    assert.deepEqual(result.map(({ score, votes, ratingError }) => ({ score, votes, ratingError })), [
      { score: 4.25, votes: 4, ratingError: false },
      { score: 0, votes: 1, ratingError: false },
      { score: null, votes: 0, ratingError: false },
      { score: null, votes: 0, ratingError: true },
    ])
    globalThis.fetch = async () => new Response('', { status: 503 })
    await assert.rejects(listMovies(), /HTTP 503/)
  } finally { globalThis.fetch = original }
})

test('publica y lee reseñas contra la API real y actualiza promedio, incluido cero', async () => {
  const { createApi } = await import('../../API/test-support/database.js')
  const { createReview, listReviews, createMovie, updateMovie, deleteMovie, loginAdmin, clearAdminToken } = await import('../src/api.js')
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'heytomatoes-client-'))
  const testToken = 'test-only-client-admin-token'
  const server = await createApi({ dataFile: join(directory, 'peliculas.json'), adminToken: testToken })
  const original = globalThis.fetch
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    globalThis.fetch = (url, options={}) => original(`${base}${new URL(url).pathname}`, { ...options, headers: { ...options.headers, Origin: 'http://localhost:5173' } })
    const movie = await (await original(`${base}/peliculas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({ nombre: 'Prueba temporal', imagen: 'https://example.com/poster.jpg', sinopsis: 'Prueba.', anioEstreno: 2024, genero: 'Drama', duracion: 90, director: 'Prueba' }),
    })).json()
    assert.deepEqual(await listReviews(movie.id), [])
    const first = await createReview(movie.id, { rating: 0, text: '  No me gustó.  ' })
    assert.equal(first.calificacion, 0)
    assert.equal(first.comentario, 'No me gustó.')
    await createReview(movie.id, { rating: 5, text: 'Me encantó.' })
    const reviews = await listReviews(movie.id)
    assert.equal(reviews.length, 2)
    assert.equal(reviews[0].id, first.id)
    const [updated] = await listMovies()
    assert.equal(updated.score, 2.5)
    assert.equal(updated.votes, 2)
    await assert.rejects(createReview(movie.id, { rating: 6, text: 'Inválida' }), /entre 0 y 5/)
    await assert.rejects(createReview(movie.id, { rating: 5, text: '  ' }), /no vacío/)
    await assert.rejects(listReviews('no-existe'), /Película no encontrada/)
    assert.equal((await listReviews(movie.id)).length, 2)
    await assert.rejects(loginAdmin('wrong-token'), /token no es válido/)
    await loginAdmin(testToken)
    const data = { nombre: 'Nueva desde panel', imagen: 'https://example.com/nueva.jpg', sinopsis: 'Una historia.', anioEstreno: 2025, genero: 'Fantasía', duracion: 125, director: 'Directora' }
    assert.equal((await listMovies(undefined,true)).length, 1)
    const created = await createMovie(data)
    assert.equal(created.title, data.nombre)
    assert.equal(created.durationMinutes, 125)
    assert.equal(created.duration, '2 h 5 min')
    assert.equal((await listMovies()).length, 2)
    const edited = await updateMovie(movie.id, data)
    assert.equal(edited.title, data.nombre)
    assert.equal((await listReviews(movie.id)).length, 2)
    assert.equal((await listMovies()).find(item=>item.id===movie.id).score, 2.5)
    await assert.rejects(updateMovie(movie.id, { ...data, duracion: -1 }), /duracion/)
    assert.equal((await listMovies()).find(item=>item.id===movie.id).durationMinutes, 125)
    assert.equal(await deleteMovie(movie.id), null)
    assert.equal((await listMovies()).length, 1)
    await assert.rejects(listReviews(movie.id), /Película no encontrada/)
    await assert.rejects(deleteMovie(movie.id), /Película no encontrada/)
    clearAdminToken()
    await assert.rejects(createMovie(data), /Token de administración/)
    await assert.rejects(listMovies(undefined,true), /HTTP 401/)

  } finally {
    globalThis.fetch = original
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
