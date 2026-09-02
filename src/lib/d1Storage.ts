/**
 * Cloudflare D1 Database & Cloudflare R2 Storage Adapter for EasyDesk
 * Provides edge SQL persistence and S3-compatible object storage with zero quota limits.
 */
import fs from 'fs';
import path from 'path';

export interface CloudflareEnv {
  DB?: any;
  STORAGE?: any;
  ASSETS?: any;
  [key: string]: any;
}

let activeEnv: CloudflareEnv | null = null;
let isD1SchemaInitialized = false;

export function setCloudflareEnv(env: CloudflareEnv) {
  activeEnv = env;
}

export function getCloudflareEnv(): CloudflareEnv | null {
  return activeEnv;
}

export function getD1Database(env?: CloudflareEnv): any | null {
  return env?.DB || activeEnv?.DB || (globalThis as any)?.CLOUDFLARE_ENV?.DB || null;
}

export function getR2Storage(env?: CloudflareEnv): any | null {
  return env?.STORAGE || activeEnv?.STORAGE || (globalThis as any)?.CLOUDFLARE_ENV?.STORAGE || null;
}

/**
 * Ensures D1 tables and indexes exist.
 */
export async function initD1Schema(dbInstance?: any): Promise<void> {
  const db = dbInstance || getD1Database();
  if (!db || isD1SchemaInitialized) return;

  const schemaStatements = [
    // 1. System Settings Store (Key-Value)
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );`,

    // 2. Universal Durable Entity Store
    `CREATE TABLE IF NOT EXISTS entities (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (collection, id)
    );`,

    // 3. Performance Indexes
    `CREATE INDEX IF NOT EXISTS idx_entities_collection ON entities(collection);`,
    `CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);`,

    // 4. File / Media Registry for R2 Storage
    `CREATE TABLE IF NOT EXISTS r2_files (
      key TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      folder TEXT DEFAULT 'media',
      metadata TEXT,
      created_at INTEGER NOT NULL
    );`
  ];

  try {
    if (typeof db.batch === 'function') {
      const prepares = schemaStatements.map(sql => db.prepare(sql));
      await db.batch(prepares);
    } else if (typeof db.exec === 'function') {
      for (const sql of schemaStatements) {
        await db.exec(sql);
      }
    } else if (typeof db.prepare === 'function') {
      for (const sql of schemaStatements) {
        await db.prepare(sql).run();
      }
    }
    isD1SchemaInitialized = true;
    console.log('[D1] Schema tables and performance indexes verified successfully.');
  } catch (err) {
    console.error('[D1] Schema initialization error:', err);
  }
}

/**
 * Loads all system settings and entities from Cloudflare D1.
 */
export async function loadStateFromD1(dbInstance?: any): Promise<{
  state: Record<string, any>;
  isFreshDatabase: boolean;
  totalDocsLoaded: number;
} | null> {
  const db = dbInstance || getD1Database();
  if (!db) return null;

  try {
    await initD1Schema(db);

    const state: Record<string, any> = {};
    let totalDocsLoaded = 0;

    // 1. Load System Settings
    const settingsRes = await db.prepare('SELECT key, data FROM system_settings').all();
    const settingsRows = (settingsRes && settingsRes.results) ? settingsRes.results : (Array.isArray(settingsRes) ? settingsRes : []);
    let hasSystemInit = false;

    for (const row of settingsRows) {
      if (!row || !row.key || !row.data) continue;
      try {
        const parsed = JSON.parse(row.data);
        state[row.key] = parsed;
        if (row.key === 'system_init') hasSystemInit = true;
        totalDocsLoaded++;
      } catch {}
    }

    // 2. Load Entities
    const entitiesRes = await db.prepare('SELECT collection, id, data FROM entities').all();
    const entityRows = (entitiesRes && entitiesRes.results) ? entitiesRes.results : (Array.isArray(entitiesRes) ? entitiesRes : []);

    for (const row of entityRows) {
      if (!row || !row.collection || !row.id || !row.data) continue;
      try {
        const parsed = JSON.parse(row.data);
        if (!state[row.collection]) state[row.collection] = [];
        state[row.collection].push(parsed);
        totalDocsLoaded++;
      } catch {}
    }

    const isFreshDatabase = !hasSystemInit && totalDocsLoaded === 0;

    return {
      state,
      isFreshDatabase,
      totalDocsLoaded
    };
  } catch (err) {
    console.error('[D1] Error loading state from D1:', err);
    return null;
  }
}

/**
 * Saves a single entity document directly into Cloudflare D1.
 */
export async function saveEntityToD1(
  collectionName: string, 
  docId: string, 
  data: any, 
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId || !data) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const jsonStr = JSON.stringify(data);

    const stmt = db.prepare(`
      INSERT INTO entities (collection, id, data, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?) 
      ON CONFLICT(collection, id) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
    `);

    await stmt.bind(collectionName, String(docId), jsonStr, now, now).run();
    return true;
  } catch (err) {
    console.error(`[D1] Error saving entity ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Deletes a single entity document from Cloudflare D1.
 */
export async function deleteEntityFromD1(
  collectionName: string, 
  docId: string, 
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId) return false;

  try {
    await initD1Schema(db);
    const stmt = db.prepare('DELETE FROM entities WHERE collection = ? AND id = ?');
    await stmt.bind(collectionName, String(docId)).run();
    return true;
  } catch (err) {
    console.error(`[D1] Error deleting entity ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Saves a system setting directly into Cloudflare D1.
 */
export async function saveSettingToD1(
  key: string, 
  data: any, 
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !key || data === undefined) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const jsonStr = JSON.stringify(data);

    const stmt = db.prepare(`
      INSERT INTO system_settings (key, data, updated_at) 
      VALUES (?, ?, ?) 
      ON CONFLICT(key) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
    `);

    await stmt.bind(key, jsonStr, now).run();
    return true;
  } catch (err) {
    console.error(`[D1] Error saving setting ${key}:`, err);
    return false;
  }
}

/**
 * Loads a single document from Cloudflare D1.
 */
export async function loadEntityFromD1(
  collectionName: string, 
  docId: string, 
  dbInstance?: any
): Promise<Record<string, any> | null> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId) return null;

  try {
    await initD1Schema(db);
    const stmt = db.prepare('SELECT data FROM entities WHERE collection = ? AND id = ?');
    const res = await stmt.bind(collectionName, String(docId)).first();
    if (res && res.data) {
      return JSON.parse(res.data);
    }
    return null;
  } catch (err) {
    console.error(`[D1] Error querying entity ${collectionName}/${docId}:`, err);
    return null;
  }
}

/**
 * Seeds Cloudflare D1 with initial baseline state.
 */
export async function seedD1FromState(initialState: Record<string, any>, dbInstance?: any): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !initialState) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const statements: any[] = [];

    // 1. Settings
    for (const [key, val] of Object.entries(initialState)) {
      if (Array.isArray(val)) continue;
      if (val && typeof val === 'object') {
        const stmt = db.prepare(`
          INSERT INTO system_settings (key, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        `);
        statements.push(stmt.bind(key, JSON.stringify(val), now));
      }
    }

    // Set system_init sentinel
    const initStmt = db.prepare(`
      INSERT INTO system_settings (key, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    statements.push(initStmt.bind('system_init', JSON.stringify({ initializedAt: new Date().toISOString(), version: 'd1_v1' }), now));

    // 2. Collections
    for (const [collName, items] of Object.entries(initialState)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || !item.id) continue;
        const stmt = db.prepare(`
          INSERT INTO entities (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        `);
        statements.push(stmt.bind(collName, String(item.id), JSON.stringify(item), now, now));
      }
    }

    // Execute in batches of 50 to stay within D1 statement batch boundaries
    const BATCH_SIZE = 50;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      if (typeof db.batch === 'function') {
        await db.batch(batch);
      } else {
        for (const s of batch) await s.run();
      }
    }

    console.log(`[D1] Successfully seeded D1 database with ${statements.length} records.`);
    return true;
  } catch (err) {
    console.error('[D1] Error seeding D1 database:', err);
    return false;
  }
}

/**
 * Uploads an object into Cloudflare R2 bucket.
 */
export async function putR2File(
  key: string, 
  data: Buffer | Uint8Array | ArrayBuffer | string, 
  contentType: string, 
  metadata?: Record<string, string>,
  env?: CloudflareEnv
): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.put === 'function') {
    try {
      await r2.put(cleanKey, data, {
        httpMetadata: {
          contentType: contentType || 'application/octet-stream',
          cacheControl: 'public, max-age=31536000, immutable'
        },
        customMetadata: metadata || {}
      });
      console.log(`[R2] Successfully stored object: ${cleanKey}`);
      return true;
    } catch (err) {
      console.error(`[R2] Error putting object ${cleanKey}:`, err);
    }
  }

  // Fallback: Store locally if filesystem is accessible
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    const dir = path.dirname(localPath);
    if (fs.mkdirSync && fs.writeFileSync) {
      fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      fs.writeFileSync(localPath, buf);
      return true;
    }
  } catch {}

  return false;
}

/**
 * Retrieves an object from Cloudflare R2 bucket.
 */
export async function getR2File(
  key: string, 
  env?: CloudflareEnv
): Promise<{
  body: any;
  contentType: string;
  size: number;
  etag?: string;
} | null> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.get === 'function') {
    try {
      const obj = await r2.get(cleanKey);
      if (obj) {
        return {
          body: obj.body,
          contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
          size: obj.size || 0,
          etag: obj.httpEtag || obj.etag
        };
      }
    } catch (err) {
      console.error(`[R2] Error getting object ${cleanKey}:`, err);
    }
  }

  // Fallback: Check local filesystem
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    if (fs.existsSync && fs.existsSync(localPath) && fs.readFileSync) {
      const buf = fs.readFileSync(localPath);
      const ext = path.extname(cleanKey).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.pdf') contentType = 'application/pdf';

      return {
        body: buf,
        contentType,
        size: buf.length
      };
    }
  } catch {}

  return null;
}

/**
 * Deletes an object from Cloudflare R2 bucket.
 */
export async function deleteR2File(key: string, env?: CloudflareEnv): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.delete === 'function') {
    try {
      await r2.delete(cleanKey);
      console.log(`[R2] Deleted object: ${cleanKey}`);
      return true;
    } catch (err) {
      console.error(`[R2] Error deleting object ${cleanKey}:`, err);
    }
  }

  // Fallback: local delete
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    if (fs.existsSync && fs.existsSync(localPath) && fs.unlinkSync) {
      fs.unlinkSync(localPath);
      return true;
    }
  } catch {}

  return false;
}
