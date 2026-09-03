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

export const OBJECT_COLLECTIONS = new Set([
  'employeeAccounts',
  'employeeKYC',
  'employeePayroll'
]);

export const ENTITY_COLLECTIONS = [
  'services',
  'categories',
  'blogCategories',
  'blogs',
  'customers',
  'admins',
  'roles',
  'permissions',
  'employees',
  'employeeKYC',
  'employeePayroll',
  'employeeAccounts',
  'employeeDocuments',
  'orders',
  'tickets',
  'reviews',
  'faqs',
  'banners',
  'calendarEvents',
  'pages',
  'media',
  'notifications',
  'users',
  'auditLogs',
  'coupons',
  'contactMessages',
  'scamReports',
  'dataDeletionRequests',
  'team',
  'systemBackups'
] as const;

export const SETTING_KEYS = [
  'system_init',
  'aboutUs',
  'founder',
  'companyProfile',
  'contactSettings',
  'paymentConfig',
  'paymentSettings',
  'privacySecuritySettings',
  'privacySecurity',
  'settings',
  'maintenanceMode',
  'masterData',
  'chatConfig'
] as const;

/**
 * Sanitizes and fills default values for payment configuration.
 */
export function sanitizePaymentConfig(raw?: any): any {
  const fallback = {
    upiId: 'easydesk@ybl',
    upiName: 'EasyDesk Digital Services',
    qrCodeUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300',
    bankAccountName: 'EasyDesk Solutions Pvt Ltd',
    bankName: 'HDFC Bank',
    bankAccountNumber: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Nariman Point, Mumbai',
    acceptUpi: true,
    acceptNetBanking: true,
    acceptQrCode: true,
    convenienceFeePercentage: 0,
    updatedAt: new Date().toISOString()
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  return {
    upiId: (raw.upiId && String(raw.upiId).trim()) || fallback.upiId,
    upiName: (raw.upiName && String(raw.upiName).trim()) || fallback.upiName,
    qrCodeUrl: (raw.qrCodeUrl && String(raw.qrCodeUrl).trim()) || fallback.qrCodeUrl,
    bankAccountName: (raw.bankAccountName && String(raw.bankAccountName).trim()) || fallback.bankAccountName,
    bankName: (raw.bankName && String(raw.bankName).trim()) || fallback.bankName,
    bankAccountNumber: (raw.bankAccountNumber && String(raw.bankAccountNumber).trim()) || fallback.bankAccountNumber,
    bankIfsc: (raw.bankIfsc && String(raw.bankIfsc).trim()) || fallback.bankIfsc,
    bankBranch: (raw.bankBranch && String(raw.bankBranch).trim()) || fallback.bankBranch,
    acceptUpi: raw.acceptUpi !== undefined ? Boolean(raw.acceptUpi) : fallback.acceptUpi,
    acceptNetBanking: raw.acceptNetBanking !== undefined ? Boolean(raw.acceptNetBanking) : fallback.acceptNetBanking,
    acceptQrCode: raw.acceptQrCode !== undefined ? Boolean(raw.acceptQrCode) : fallback.acceptQrCode,
    convenienceFeePercentage: typeof raw.convenienceFeePercentage === 'number' ? raw.convenienceFeePercentage : fallback.convenienceFeePercentage,
    updatedAt: raw.updatedAt || fallback.updatedAt
  };
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

    // 4. File / Media Registry for Firebase Storage & R2 Object Store
    `CREATE TABLE IF NOT EXISTS r2_files (
      key TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      folder TEXT DEFAULT 'media',
      metadata TEXT,
      created_at INTEGER NOT NULL
    );`,

    // 5. Media & Upload Metadata Registry
    `CREATE TABLE IF NOT EXISTS media_files (
      file_id TEXT PRIMARY KEY,
      storage_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      access_level TEXT DEFAULT 'public',
      owner_id TEXT,
      download_url TEXT NOT NULL,
      folder TEXT DEFAULT 'media',
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(storage_path);`,
    `CREATE INDEX IF NOT EXISTS idx_media_files_owner ON media_files(owner_id);`
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
        if (OBJECT_COLLECTIONS.has(row.collection)) {
          if (!state[row.collection] || Array.isArray(state[row.collection])) {
            state[row.collection] = {};
          }
          state[row.collection][row.id] = parsed;
        } else {
          if (!state[row.collection] || !Array.isArray(state[row.collection])) {
            state[row.collection] = [];
          }
          state[row.collection].push(parsed);
        }
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
export interface D1WriteResult {
  success: boolean;
  changes: number;
  error?: string;
}

export async function saveEntityToD1(
  collectionName: string, 
  docId: string, 
  data: any, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId || data === undefined) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

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

    const runRes = await stmt.bind(collectionName, String(docId), jsonStr, now, now).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 WRITE ERROR] saveEntityToD1 failed for ${collectionName}/${docId}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    return { success: true, changes: Math.max(1, changes) };
  } catch (err: any) {
    console.error(`[D1] Error saving entity ${collectionName}/${docId}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Deletes a single entity document from Cloudflare D1.
 */
export async function deleteEntityFromD1(
  collectionName: string, 
  docId: string, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

  try {
    await initD1Schema(db);
    const stmt = db.prepare('DELETE FROM entities WHERE collection = ? AND id = ?');
    const runRes = await stmt.bind(collectionName, String(docId)).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 DELETE ERROR] deleteEntityFromD1 failed for ${collectionName}/${docId}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    return { success: true, changes };
  } catch (err: any) {
    console.error(`[D1] Error deleting entity ${collectionName}/${docId}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Saves a system setting directly into Cloudflare D1.
 */
export async function saveSettingToD1(
  key: string, 
  data: any, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !key || data === undefined) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

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

    const runRes = await stmt.bind(key, jsonStr, now).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 WRITE ERROR] saveSettingToD1 failed for ${key}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    return { success: true, changes: Math.max(1, changes) };
  } catch (err: any) {
    console.error(`[D1] Error saving setting ${key}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Synchronizes an entire collection to D1, upserting active items and deleting purged items.
 */
export async function syncCollectionToD1(
  collectionName: string, 
  currentItems: any[], 
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const validIds = new Set<string>();

    const stmts: any[] = [];
    for (const item of (currentItems || [])) {
      if (!item || (!item.id && !item.code)) continue;
      const docId = String(item.id || item.code);
      validIds.add(docId);
      const stmt = db.prepare(`
        INSERT INTO entities (collection, id, data, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(collection, id) DO UPDATE SET 
          data = excluded.data, 
          updated_at = excluded.updated_at
      `);
      stmts.push(stmt.bind(collectionName, docId, JSON.stringify(item), now, now));
    }

    // Execute saves in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      const batch = stmts.slice(i, i + BATCH_SIZE);
      if (typeof db.batch === 'function') {
        await db.batch(batch);
      } else {
        for (const s of batch) await s.run();
      }
    }

    // Delete any entities in D1 that no longer exist in currentItems
    const existingRes = await db.prepare('SELECT id FROM entities WHERE collection = ?').bind(collectionName).all();
    const existingRows = (existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : []);
    const deleteStmts: any[] = [];
    for (const row of existingRows) {
      if (row && row.id && !validIds.has(String(row.id))) {
        deleteStmts.push(db.prepare('DELETE FROM entities WHERE collection = ? AND id = ?').bind(collectionName, String(row.id)));
      }
    }

    if (deleteStmts.length > 0) {
      for (let i = 0; i < deleteStmts.length; i += BATCH_SIZE) {
        const delBatch = deleteStmts.slice(i, i + BATCH_SIZE);
        if (typeof db.batch === 'function') {
          await db.batch(delBatch);
        } else {
          for (const s of delBatch) await s.run();
        }
      }
    }

    return true;
  } catch (err) {
    console.error(`[D1] Error syncing collection ${collectionName}:`, err);
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
      if (OBJECT_COLLECTIONS.has(key)) continue;
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

    // 2. Collections (Arrays and Dictionary Objects)
    for (const [collName, items] of Object.entries(initialState)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item || (!item.id && !item.code)) continue;
          const docId = String(item.id || item.code);
          const stmt = db.prepare(`
            INSERT INTO entities (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
          `);
          statements.push(stmt.bind(collName, docId, JSON.stringify(item), now, now));
        }
      } else if (items && typeof items === 'object' && OBJECT_COLLECTIONS.has(collName)) {
        for (const [docId, item] of Object.entries(items)) {
          if (!item) continue;
          const stmt = db.prepare(`
            INSERT INTO entities (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
          `);
          statements.push(stmt.bind(collName, String(docId), JSON.stringify(item), now, now));
        }
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

/**
 * Saves media file metadata directly to Cloudflare D1 media_files table.
 * All structured file metadata persists strictly in D1.
 */
export async function saveMediaFileMetadataToD1(
  meta: {
    fileId: string;
    storagePath: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
    accessLevel?: 'public' | 'restricted' | 'private';
    ownerId?: string;
    folder?: string;
    metadata?: Record<string, any>;
  },
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !meta.fileId || !meta.storagePath) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO media_files (
        file_id, storage_path, filename, mime_type, size_bytes, 
        access_level, owner_id, download_url, folder, metadata, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        storage_path = excluded.storage_path,
        filename = excluded.filename,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        access_level = excluded.access_level,
        owner_id = excluded.owner_id,
        download_url = excluded.download_url,
        folder = excluded.folder,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    await stmt.bind(
      meta.fileId,
      meta.storagePath,
      meta.filename,
      meta.mimeType,
      meta.sizeBytes || 0,
      meta.accessLevel || 'public',
      meta.ownerId || null,
      meta.downloadUrl,
      meta.folder || 'media',
      meta.metadata ? JSON.stringify(meta.metadata) : null,
      now,
      now
    ).run();

    return true;
  } catch (err) {
    console.error('[D1] Error saving media file metadata:', err);
    return false;
  }
}

/**
 * Deletes media file metadata from Cloudflare D1.
 */
export async function deleteMediaFileMetadataFromD1(
  fileId: string,
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !fileId) return false;

  try {
    await initD1Schema(db);
    await db.prepare('DELETE FROM media_files WHERE file_id = ?').bind(fileId).run();
    return true;
  } catch (err) {
    console.error('[D1] Error deleting media file metadata:', err);
    return false;
  }
}

