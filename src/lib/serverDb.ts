/**
 * Server Database Layer for EasyDesk
 * Uses Cloudflare D1 (SQL) for structured data and Cloudflare R2 for object storage.
 * Completely replaces Firestore to eliminate all read/write quotas.
 */
import fs from 'fs';
import path from 'path';
import {
  setCloudflareEnv,
  getCloudflareEnv,
  getD1Database,
  getR2Storage,
  initD1Schema,
  loadStateFromD1,
  saveEntityToD1,
  deleteEntityFromD1,
  saveSettingToD1,
  loadEntityFromD1,
  seedD1FromState,
  putR2File,
  getR2File,
  deleteR2File,
  CloudflareEnv
} from './d1Storage';

export {
  setCloudflareEnv,
  getCloudflareEnv,
  getD1Database,
  getR2Storage,
  initD1Schema,
  loadStateFromD1,
  saveEntityToD1,
  deleteEntityFromD1,
  saveSettingToD1,
  loadEntityFromD1,
  seedD1FromState,
  putR2File,
  getR2File,
  deleteR2File
};

export type { CloudflareEnv };

// Entity collection names stored as individual documents in D1
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
] as const;

// Settings document keys stored inside the D1 'system_settings' table
export const SETTING_KEYS = [
  'system_init',
  'aboutUs',
  'founder',
  'companyProfile',
  'contactSettings',
  'generalSettings',
  'privacySecurity',
  'privacySecuritySettings',
  'paymentSettings',
  'paymentConfig',
  'settings',
  'adminProfileSettings',
  'masterData',
  'seoSettings'
] as const;

/**
 * Normalizes and flattens payment configuration objects to prevent recursive nesting.
 */
export function sanitizePaymentConfig(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  let cur = { ...raw };
  // Recursively unwrap nested wrappers if present
  while (cur.paymentSettings && typeof cur.paymentSettings === 'object' && Object.keys(cur.paymentSettings).length > 0) {
    const inner = cur.paymentSettings;
    delete cur.paymentSettings;
    cur = { ...cur, ...inner };
  }
  while (cur.paymentConfig && typeof cur.paymentConfig === 'object' && Object.keys(cur.paymentConfig).length > 0) {
    const inner = cur.paymentConfig;
    delete cur.paymentConfig;
    cur = { ...cur, ...inner };
  }
  return {
    upiId: cur.upiId || 'easydesk@sbi',
    upiName: cur.upiName || 'EasyDesk Digital Services',
    qrCodeUrl: cur.qrCodeUrl || '',
    bankName: cur.bankName || 'State Bank of India',
    accountName: cur.accountName || cur.bankAccountName || 'EasyDesk Digital Services Pvt Ltd',
    bankAccountName: cur.bankAccountName || cur.accountName || 'EasyDesk Digital Services Pvt Ltd',
    accountNumber: cur.accountNumber || '40918273645',
    ifsc: cur.ifsc || cur.ifscCode || 'SBIN0001234',
    ifscCode: cur.ifscCode || cur.ifsc || 'SBIN0001234',
    branch: cur.branch || 'Sector 62 Noida',
    paymentInstructions: cur.paymentInstructions || 'Transfer the exact order fee via UPI App (GPay, PhonePe, Paytm, BHIM) or Bank Transfer (IMPS/NEFT). Copy the 12-digit UTR/Transaction ID, upload payment screenshot, and submit proof for instant order verification.'
  };
}

/**
 * Compatibility wrapper: loads a single document from D1.
 */
export async function loadFirestoreDoc(collectionName: string, docId: string): Promise<Record<string, any> | null> {
  return loadEntityFromD1(collectionName, docId);
}

/**
 * Compatibility wrapper: saves a single document to D1.
 */
export async function saveFirestoreDoc(collectionName: string, docId: string, data: any): Promise<void> {
  await saveEntityToD1(collectionName, docId, data);
}

/**
 * Compatibility wrapper: deletes a single document from D1.
 */
export async function deleteFirestoreDoc(collectionName: string, docId: string): Promise<void> {
  await deleteEntityFromD1(collectionName, docId);
}

/**
 * Compatibility wrapper: saves a setting to D1.
 */
export async function saveFirestoreSetting(settingKey: string, data: any): Promise<void> {
  await saveSettingToD1(settingKey, data);
}

/**
 * Compatibility wrapper: loads entire state from Cloudflare D1.
 */
export async function loadStateFromFirestore(): Promise<{
  state: Record<string, any>;
  isFreshDatabase: boolean;
  totalDocsLoaded: number;
} | null> {
  // 1. Try loading from Cloudflare D1
  const d1Res = await loadStateFromD1();
  if (d1Res) {
    return d1Res;
  }

  // 2. Fallback to local db_store.json if running in standalone local Node environment without D1
  try {
    const dbFile = path.join(process.cwd(), 'db_store.json');
    if (fs.existsSync(dbFile)) {
      const content = fs.readFileSync(dbFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          state: parsed,
          isFreshDatabase: false,
          totalDocsLoaded: Object.keys(parsed).length
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Compatibility wrapper: seeds D1 with initial state.
 */
export async function seedFirestoreFromInitialState(initialState: Record<string, any>): Promise<void> {
  await seedD1FromState(initialState);
}

/**
 * Compatibility wrapper: persists targeted changes to Cloudflare D1.
 */
export async function persistFirestoreChange(
  state: Record<string, any>,
  collectionOrKey?: string,
  id?: string
): Promise<void> {
  if (!collectionOrKey) {
    // Persist all settings and collections
    for (const key of SETTING_KEYS) {
      if (state[key] !== undefined) {
        await saveSettingToD1(key, state[key]);
      }
    }
    for (const coll of ENTITY_COLLECTIONS) {
      if (Array.isArray(state[coll])) {
        for (const item of state[coll]) {
          if (item && item.id) {
            await saveEntityToD1(coll, String(item.id), item);
          }
        }
      }
    }
    return;
  }

  // If it's a setting key
  if (SETTING_KEYS.includes(collectionOrKey as any)) {
    if (state[collectionOrKey] !== undefined) {
      await saveSettingToD1(collectionOrKey, state[collectionOrKey]);
    }
    return;
  }

  // If it's an entity collection with a specific item ID
  if (ENTITY_COLLECTIONS.includes(collectionOrKey as any)) {
    const list = state[collectionOrKey];
    if (Array.isArray(list)) {
      if (id) {
        const item = list.find((x: any) => x && String(x.id) === String(id));
        if (item) {
          await saveEntityToD1(collectionOrKey, String(id), item);
        } else {
          // If deleted from array
          await deleteEntityFromD1(collectionOrKey, String(id));
        }
      } else {
        // Persist all items in collection
        for (const item of list) {
          if (item && item.id) {
            await saveEntityToD1(collectionOrKey, String(item.id), item);
          }
        }
      }
    }
  }
}

// Dummy export for backward compatibility
export function getFirestoreDb() {
  return null;
}
