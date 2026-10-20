import { createPool } from './database.js';
import { createApi } from './app.js';
import { initializeDatabase } from './initialize-database.js';

try { process.loadEnvFile(new URL('../../.env', import.meta.url)); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const port = Number(process.env.PORT || 3000);
const pool = createPool();
await initializeDatabase(pool);
await pool.query('SELECT id FROM peliculas LIMIT 0');
await pool.query('SELECT id FROM resenas LIMIT 0');
const server = await createApi({ pool });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
server.listen(port, '0.0.0.0', () => {
  console.log(`API disponible en http://127.0.0.1:${port}`);
});
