import { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPool } from '../src/database.js';
import { createApi as realCreateApi } from '../src/app.js';
process.loadEnvFile(new URL('../../.env', import.meta.url));
const databases = new Map();
after(async()=>{
  for(const {pool,schema} of databases.values()) {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
export async function createApi({ dataFile, adminToken } = {}) {
  if(!adminToken)return realCreateApi({adminToken});
  const key=String(dataFile);
  if(!databases.has(key)) {
    const schema='test_'+randomUUID().replaceAll('-','');
    const pool=createPool({options:`-c search_path=${schema}`});
    await pool.query(`CREATE SCHEMA "${schema}"`);
    databases.set(key,{pool,schema});
    for(const file of ['001_create_peliculas.sql','002_create_resenas.sql']) {
      const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      await pool.query(sql.replaceAll('public.',`"${schema}".`));
    }
  }
  return realCreateApi({pool:databases.get(key).pool,adminToken});
}
