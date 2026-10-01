import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { pool } from './db';

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.get('/admin', (_req, res) => res.sendFile('admin.html', { root: 'public' }));

const movieInput = z.object({
  title: z.string().trim().min(1).max(200),
  imageUrl: z.string().url().max(2048),
  description: z.string().trim().min(1).max(10000),
});
const reviewInput = z.object({
  rating: z.number().int().min(0).max(5),
  description: z.string().trim().max(2000).default(''),
});

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return res.status(503).json({ error: 'Admin access is not configured.' });
  if (req.header('x-admin-key') !== configuredKey) return res.status(401).json({ error: 'Admin authentication required.' });
  next();
}

// Public catalog and ratings.
app.get('/api/movies', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.title, m.image_url AS "imageUrl", m.description,
             COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS "averageRating",
             COUNT(r.id)::int AS "reviewCount"
      FROM movies m LEFT JOIN reviews r ON r.movie_id = m.id
      GROUP BY m.id ORDER BY m.created_at DESC`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/movies/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.title, m.image_url AS "imageUrl", m.description,
             COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS "averageRating",
             COUNT(r.id)::int AS "reviewCount"
      FROM movies m LEFT JOIN reviews r ON r.movie_id = m.id
      WHERE m.id = $1 GROUP BY m.id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    const reviews = await pool.query('SELECT id, rating, description, created_at AS "createdAt" FROM reviews WHERE movie_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...result.rows[0], reviews: reviews.rows });
  } catch (error) { next(error); }
});

app.post('/api/movies/:id/reviews', async (req, res, next) => {
  const parsed = reviewInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid review.', details: parsed.error.flatten() });
  try {
    const result = await pool.query(
      'INSERT INTO reviews (movie_id, rating, description) VALUES ($1, $2, $3) RETURNING id, movie_id AS "movieId", rating, description, created_at AS "createdAt"',
      [req.params.id, parsed.data.rating, parsed.data.description]);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23503') return res.status(404).json({ error: 'Movie not found.' });
    next(error);
  }
});

// Admin-only movie management. The public catalog above is read-only.
app.get('/api/admin/movies', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT m.id, m.title, m.image_url AS "imageUrl", m.description,
      m.created_at AS "createdAt", m.updated_at AS "updatedAt",
      COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS "averageRating", COUNT(r.id)::int AS "reviewCount"
      FROM movies m LEFT JOIN reviews r ON r.movie_id = m.id GROUP BY m.id ORDER BY m.created_at DESC`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/admin/movies/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, title, image_url AS "imageUrl", description, created_at AS "createdAt", updated_at AS "updatedAt" FROM movies WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.post('/api/admin/movies', requireAdmin, async (req, res, next) => {
  const parsed = movieInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid movie.', details: parsed.error.flatten() });
  try {
    const { title, imageUrl, description } = parsed.data;
    const result = await pool.query('INSERT INTO movies (title, image_url, description) VALUES ($1, $2, $3) RETURNING id, title, image_url AS "imageUrl", description, created_at AS "createdAt"', [title, imageUrl, description]);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.patch('/api/admin/movies/:id', requireAdmin, async (req, res, next) => {
  const parsed = movieInput.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ error: 'Provide at least one valid movie field.', details: parsed.success ? undefined : parsed.error.flatten() });
  const fields = parsed.data;
  const values: unknown[] = [];
  const sets: string[] = [];
  for (const [key, column] of [['title', 'title'], ['imageUrl', 'image_url'], ['description', 'description']] as const) {
    if (fields[key] !== undefined) { values.push(fields[key]); sets.push(`${column} = $${values.length}`); }
  }
  values.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE movies SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING id, title, image_url AS "imageUrl", description, updated_at AS "updatedAt"`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/admin/movies/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM movies WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Movie not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`HeyTomatoes API listening on http://localhost:${port}`));
