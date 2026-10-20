const API_URL = (import.meta.env?.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

let adminToken = ''
export function clearAdminToken() { adminToken = '' }
function invalidateAdmin(response) {
  if (response.status === 401) {
    clearAdminToken()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('admin-session-expired'))
  }
}
export async function loginAdmin(token) {
  const response = await fetch(`${API_URL}/admin/sesion`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) {
    clearAdminToken()
    throw new Error(response.status === 401 ? 'El token no es válido.' : 'No se pudo verificar el acceso.')
  }
  adminToken = token
}

export async function listMovies(signal, admin = false) {
  const response = await fetch(`${API_URL}/${admin ? 'admin/peliculas' : 'peliculas'}`, { signal, ...(admin ? { headers: { Authorization: `Bearer ${adminToken}` }, cache: 'no-store' } : {}) })
  if (admin) invalidateAdmin(response)
  if (!response.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${response.status}).`)
  const movies = await response.json()
  if (!Array.isArray(movies)) throw new Error('La API devolvió un catálogo inválido.')
  return Promise.all(movies.map(async movie => {
    let score = null, votes = 0, ratingError = false
    try {
      const result = await fetch(`${API_URL}/peliculas/${encodeURIComponent(movie.id)}/promedio`, { signal })
      if (!result.ok) throw new Error("No se pudo cargar el promedio.")
      const data = await result.json()
      if (!Number.isInteger(data.totalCalificaciones) || data.totalCalificaciones < 0 ||
          (data.totalCalificaciones === 0 ? data.promedio !== null : typeof data.promedio !== "number" || !Number.isFinite(data.promedio) || data.promedio < 0 || data.promedio > 5)) {
        throw new Error("Promedio inválido.")
      }
      score = data.promedio
      votes = data.totalCalificaciones
    } catch (error) {
      if (signal?.aborted) throw error
      ratingError = true
    }
    return { ...mapMovie(movie), score, votes, ratingError }

  }))
}

async function reviewRequest(movieId, options) {
  let response
  try {
    response = await fetch(`${API_URL}/peliculas/${encodeURIComponent(movieId)}/calificaciones`, options)
  } catch (error) {
    if (options?.signal?.aborted) throw error
    throw new Error('No pudimos conectar con el servidor. Comprueba tu conexión y la API.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `No se pudo completar la petición (HTTP ${response.status}).`)
  }
  return response.json()
}

export async function listReviews(movieId, signal) {
  const reviews = await reviewRequest(movieId, { signal })
  if (!Array.isArray(reviews)) throw new Error('La API devolvió una lista de reseñas inválida.')
  return reviews
}

export function createReview(movieId, { rating, text }) {
  return reviewRequest(movieId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calificacion: rating, comentario: text.trim() }),
  })
}

export function mapMovie(movie) {
  return {
    id: movie.id, title: movie.nombre, image: movie.imagen,
    synopsis: movie.sinopsis, year: movie.anioEstreno, genre: movie.genero,
    durationMinutes: movie.duracion,
    duration: `${Math.floor(movie.duracion / 60)} h ${movie.duracion % 60} min`,
    director: movie.director, score: null, votes: 0, ratingError: false,
  }
}

async function mutateMovie(method, movieId, data) {
  let response
  try {
    response = await fetch(`${API_URL}/peliculas${movieId ? `/${encodeURIComponent(movieId)}` : ''}`, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
  } catch {
    throw new Error('No pudimos conectar con el servidor. Comprueba la API e inténtalo de nuevo.')
  }
  invalidateAdmin(response)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `No se pudo guardar el cambio (HTTP ${response.status}).`)
  }
  return response.status === 204 ? null : mapMovie(await response.json())
}
export const createMovie = data => mutateMovie('POST', null, data)
export const updateMovie = (id, data) => mutateMovie('PUT', id, data)
export const deleteMovie = id => mutateMovie('DELETE', id)
