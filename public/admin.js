const accessForm = document.querySelector('#access-form');
const keyInput = document.querySelector('#admin-key');
const workspace = document.querySelector('#workspace');
const disconnectButton = document.querySelector('#disconnect');
const movieForm = document.querySelector('#movie-form');
const movieList = document.querySelector('#movie-list');
const accessMessage = document.querySelector('#access-message');
const formMessage = document.querySelector('#form-message');
const catalogMessage = document.querySelector('#catalog-message');
const saveButton = document.querySelector('#save-movie');
const cancelEditButton = document.querySelector('#cancel-edit');
let adminKey = sessionStorage.getItem('heytomatoes-admin-key') || '';
let editingMovieId = null;

function showMessage(element, message = '', kind = 'error') {
  element.textContent = message;
  element.classList.toggle('success', kind === 'success' && Boolean(message));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'x-admin-key': adminKey,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    disconnect('La clave no es válida. Revísala e inténtalo de nuevo.');
    throw new Error('La clave de administrador no es válida.');
  }
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la solicitud.');
  return body;
}

function disconnect(message = '') {
  adminKey = '';
  sessionStorage.removeItem('heytomatoes-admin-key');
  workspace.hidden = true;
  disconnectButton.hidden = true;
  keyInput.value = '';
  showMessage(accessMessage, message);
}

function setConnected() {
  workspace.hidden = false;
  disconnectButton.hidden = false;
  showMessage(accessMessage, 'Conexión segura establecida.', 'success');
}

function resetMovieForm() {
  editingMovieId = null;
  movieForm.reset();
  document.querySelector('#form-title').textContent = 'Agregar película';
  saveButton.innerHTML = 'Guardar película <span>→</span>';
  cancelEditButton.hidden = true;
  showMessage(formMessage);
}

function renderMovies(movies) {
  document.querySelector('#movie-count').textContent = movies.length;
  if (!movies.length) {
    movieList.innerHTML = '<div class="empty-state"><span>🎞</span><p>Aún no hay películas.<br>Agrega la primera con el formulario.</p></div>';
    return;
  }
  movieList.innerHTML = movies.map((movie) => `
    <article class="movie-row">
      <img class="poster-thumb" src="${escapeHtml(movie.imageUrl)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="movie-info"><h3>${escapeHtml(movie.title)}</h3><p>${escapeHtml(movie.description)}</p><span class="review-count">★ ${Number(movie.averageRating).toFixed(1)} · ${movie.reviewCount} reseñas</span></div>
      <div class="row-actions"><button class="row-button edit-button" type="button" data-edit="${escapeHtml(movie.id)}">Editar</button><button class="row-button delete-button" type="button" data-delete="${escapeHtml(movie.id)}" data-title="${escapeHtml(movie.title)}">Eliminar</button></div>
    </article>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function loadMovies() {
  showMessage(catalogMessage);
  try {
    renderMovies(await api('/api/admin/movies'));
  } catch (error) {
    showMessage(catalogMessage, error.message);
  }
}

accessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminKey = keyInput.value.trim();
  showMessage(accessMessage, 'Verificando acceso…');
  try {
    await api('/api/admin/movies');
    sessionStorage.setItem('heytomatoes-admin-key', adminKey);
    setConnected();
    await loadMovies();
  } catch (error) {
    showMessage(accessMessage, error.message);
  }
});

disconnectButton.addEventListener('click', () => disconnect('Sesión cerrada.'));
document.querySelector('#refresh').addEventListener('click', loadMovies);
cancelEditButton.addEventListener('click', resetMovieForm);

movieForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const movie = Object.fromEntries(new FormData(movieForm).entries());
  saveButton.disabled = true;
  showMessage(formMessage, editingMovieId ? 'Guardando cambios…' : 'Publicando película…');
  try {
    await api(editingMovieId ? `/api/admin/movies/${editingMovieId}` : '/api/admin/movies', {
      method: editingMovieId ? 'PATCH' : 'POST',
      body: JSON.stringify(movie),
    });
    const message = editingMovieId ? 'Los cambios se guardaron correctamente.' : 'La película se agregó al catálogo.';
    resetMovieForm();
    showMessage(formMessage, message, 'success');
    await loadMovies();
  } catch (error) {
    showMessage(formMessage, error.message);
  } finally {
    saveButton.disabled = false;
  }
});

movieList.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) {
    try {
      const movie = await api(`/api/admin/movies/${editButton.dataset.edit}`);
      editingMovieId = movie.id;
      movieForm.elements.title.value = movie.title;
      movieForm.elements.imageUrl.value = movie.imageUrl;
      movieForm.elements.description.value = movie.description;
      document.querySelector('#form-title').textContent = 'Editar película';
      saveButton.innerHTML = 'Guardar cambios <span>→</span>';
      cancelEditButton.hidden = false;
      showMessage(formMessage);
      document.querySelector('#title').focus();
    } catch (error) {
      showMessage(catalogMessage, error.message);
    }
  }
  if (deleteButton && window.confirm(`¿Eliminar “${deleteButton.dataset.title}”? También se borrarán sus reseñas.`)) {
    try {
      await api(`/api/admin/movies/${deleteButton.dataset.delete}`, { method: 'DELETE' });
      if (editingMovieId === deleteButton.dataset.delete) resetMovieForm();
      showMessage(catalogMessage, 'Película eliminada.', 'success');
      await loadMovies();
    } catch (error) {
      showMessage(catalogMessage, error.message);
    }
  }
});

if (adminKey) {
  keyInput.value = adminKey;
  api('/api/admin/movies').then(() => {
    setConnected();
    loadMovies();
  }).catch(() => {});
}
