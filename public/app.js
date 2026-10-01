const grid = document.querySelector('#movie-grid');
const statusBox = document.querySelector('#status');
const dialog = document.querySelector('#review-dialog');
let activeMovie;
let selectedRating = 5;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function loadMovies() {
  try {
    const response = await fetch('/api/movies');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
    const movies = await response.json();
    statusBox.textContent = movies.length ? '' : 'Todavía no hay películas en cartelera. Vuelve pronto.';
    grid.innerHTML = movies.map((movie) => `
      <article class="movie-card">
        <div class="movie-image"><img src="${escapeHtml(movie.imageUrl)}" alt="Póster de ${escapeHtml(movie.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;image-fallback&quot;>🎬</div>'"></div>
        <div class="movie-body"><div class="movie-meta"><span>Película</span><span class="rating">★ ${Number(movie.averageRating).toFixed(1)} · ${movie.reviewCount} reseñas</span></div>
          <h3>${escapeHtml(movie.title)}</h3><p>${escapeHtml(movie.description)}</p>
          <button class="review-button" data-review="${movie.id}" data-title="${escapeHtml(movie.title)}">Calificar película&nbsp; →</button></div>
      </article>`).join('');
  } catch (error) { statusBox.textContent = error.message; }
}

function openReview(movieId, title) {
  activeMovie = movieId;
  selectedRating = 5;
  document.querySelector('#dialog-content').innerHTML = `
    <h2 class="dialog-title">Tu opinión cuenta</h2><p class="dialog-subtitle">Comparte qué te pareció <b>${escapeHtml(title)}</b>.</p>
    <form class="review-form"><label>Tu calificación</label><div class="stars" role="radiogroup" aria-label="Calificación de 0 a 5 estrellas">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= selectedRating ? 'selected' : ''}" data-star="${n}" aria-label="${n} estrellas">★</button>`).join('')}<button type="button" data-star="0" aria-label="0 estrellas" title="0 estrellas" style="font-size:12px">0</button></div>
    <label for="review-description">Cuéntanos un poco más</label><textarea id="review-description" maxlength="2000" placeholder="¿Qué te hizo sentir esta película?"></textarea><div class="dialog-message" aria-live="polite"></div><button type="submit">Enviar reseña&nbsp; →</button></form>`;
  dialog.showModal();
}

document.addEventListener('click', (event) => {
  const reviewButton = event.target.closest('[data-review]');
  if (reviewButton) openReview(reviewButton.dataset.review, reviewButton.dataset.title);
  const starButton = event.target.closest('[data-star]');
  if (starButton) {
    selectedRating = Number(starButton.dataset.star);
    document.querySelectorAll('[data-star]').forEach((button) => button.classList.toggle('selected', Number(button.dataset.star) > 0 && Number(button.dataset.star) <= selectedRating));
  }
});

document.addEventListener('submit', async (event) => {
  if (!event.target.matches('.review-form')) return;
  event.preventDefault();
  const message = event.target.querySelector('.dialog-message');
  const submit = event.target.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const response = await fetch(`/api/movies/${activeMovie}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: selectedRating, description: event.target.querySelector('textarea').value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo enviar tu reseña.');
    dialog.close();
    await loadMovies();
  } catch (error) { message.textContent = error.message; submit.disabled = false; }
});

loadMovies();
