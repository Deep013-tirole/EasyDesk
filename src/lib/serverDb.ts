import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setLogLevel } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('error');
} catch {}

export interface FirebaseAppletConfig {
  projectId: string;
  appId?: string;
  apiKey: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  [key: string]: any;
}

export function getFirebaseConfig(): FirebaseAppletConfig {
  let config: any = defaultFirebaseConfig;
  if (!config || !config.apiKey || !config.projectId) {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch {}
  }
  return {
    projectId: config?.projectId || 'khaki-fact-snzsc',
    apiKey: config?.apiKey || '',
    authDomain: config?.authDomain || '',
    firestoreDatabaseId: config?.firestoreDatabaseId || '(default)',
    storageBucket: config?.storageBucket || '',
    messagingSenderId: config?.messagingSenderId || '',
    appId: config?.appId || ''
  };
}

export function getFirestoreRestBaseUrl(): string {
  const config = getFirebaseConfig();
  const dbId = config.firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents`;
}

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

export function getFirestoreDb() {
  if (firestoreInstance) return firestoreInstance;
  try {
    const config = getFirebaseConfig();
    if (config && config.apiKey) {
      const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
      const databaseId = config.firestoreDatabaseId || '(default)';
      firestoreInstance = getFirestore(app, databaseId);
      return firestoreInstance;
    }
  } catch (err) {
    console.error('[FIREBASE] Error initializing Firestore SDK:', err);
  }
  return null;
}

// Entity collection names stored as individual documents in Firestore
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
  'masterData',
  'coupons',
  'contactMessages',
  'scamReports',
  'dataDeletionRequests',
  'team',
] as const;

// Settings document keys stored inside the 'settings' Firestore collection
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
 * Decodes Firestore REST API typed values to standard JavaScript objects
 */
export function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = decodeFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

/**
 * Decodes a Firestore document REST response into a standard JavaScript object
 */
export function decodeFirestoreDocument(doc: any): Record<string, any> {
  if (!doc || !doc.fields) return {};
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    data[k] = decodeFirestoreValue(v);
  }
  return data;
}

/**
 * Encodes a standard JavaScript value into Firestore REST API typed structure
 */
export function encodeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Encodes a JavaScript object into a Firestore document structure
 */
export function encodeFirestoreDocument(obj: Record<string, any>): { fields: Record<string, any> } {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return { fields };
}

/**
 * Saves a single document to its entity collection in Firestore via direct REST API with fetch.
 */
export async function saveFirestoreDoc(collectionName: string, docId: string, data: any): Promise<void> {
  if (!docId || !data) return;
  const config = getFirebaseConfig();
  if (!config.apiKey) return;

  const baseUrl = getFirestoreRestBaseUrl();
  const url = `${baseUrl}/${collectionName}/${encodeURIComponent(String(docId))}?key=${config.apiKey}`;
  const cleanData = JSON.parse(JSON.stringify(data));
  cleanData._updatedAt = Date.now();

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encodeFirestoreDocument(cleanData))
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[FIREBASE REST] Error saving ${collectionName}/${docId}: HTTP ${res.status} - ${errText}`);
    } else {
      console.log(`[FIREBASE REST] Saved doc to ${collectionName}/${docId}`);
    }
  } catch (err) {
    console.error(`[FIREBASE REST] Network error saving doc to ${collectionName}/${docId}:`, err);
  }
}

/**
 * Deletes a single document from an entity collection in Firestore via direct REST API with fetch.
 */
export async function deleteFirestoreDoc(collectionName: string, docId: string): Promise<void> {
  if (!docId) return;
  const config = getFirebaseConfig();
  if (!config.apiKey) return;

  const baseUrl = getFirestoreRestBaseUrl();
  const url = `${baseUrl}/${collectionName}/${encodeURIComponent(String(docId))}?key=${config.apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE'
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text().catch(() => '');
      console.error(`[FIREBASE REST] Error deleting ${collectionName}/${docId}: HTTP ${res.status} - ${errText}`);
    } else {
      console.log(`[FIREBASE REST] Successfully deleted doc from ${collectionName}/${docId}`);
    }
  } catch (err) {
    console.error(`[FIREBASE REST] Network error deleting doc from ${collectionName}/${docId}:`, err);
  }
}

/**
 * Saves a settings object to the 'settings' collection in Firestore via direct REST API with fetch.
 */
export async function saveFirestoreSetting(settingKey: string, data: any): Promise<void> {
  if (!settingKey || !data) return;
  const config = getFirebaseConfig();
  if (!config.apiKey) return;

  const baseUrl = getFirestoreRestBaseUrl();
  const url = `${baseUrl}/settings/${encodeURIComponent(settingKey)}?key=${config.apiKey}`;
  const cleanData = JSON.parse(JSON.stringify(data));
  cleanData._updatedAt = Date.now();

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encodeFirestoreDocument(cleanData))
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[FIREBASE REST] Error saving setting ${settingKey}: HTTP ${res.status} - ${errText}`);
    } else {
      console.log(`[FIREBASE REST] Saved setting to settings/${settingKey}`);
    }
  } catch (err) {
    console.error(`[FIREBASE REST] Network error saving setting ${settingKey}:`, err);
  }
}

/**
 * Seeds all dbState collections and settings to document-per-entity structure in Firestore.
 */
export async function seedFirestoreFromInitialState(dbState: Record<string, any>): Promise<void> {
  console.log('[FIREBASE REST] Writing document-per-entity structure to Firestore...');
  const promises: Promise<void>[] = [];

  // Write system initialization sentinel FIRST
  promises.push(saveFirestoreSetting('system_init', {
    isInitialized: true,
    initializedAt: new Date().toISOString(),
    version: '2.1.0'
  }));

  // Seed entity collections
  for (const collName of ENTITY_COLLECTIONS) {
    const val = dbState[collName];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && item.id) {
          promises.push(saveFirestoreDoc(collName, String(item.id), item));
        }
      }
    } else if (val && typeof val === 'object') {
      if (collName === 'masterData') {
        promises.push(saveFirestoreDoc(collName, 'data', val));
      } else {
        for (const [k, item] of Object.entries(val)) {
          if (item && typeof item === 'object') {
            promises.push(saveFirestoreDoc(collName, String(k), item));
          }
        }
      }
    }
  }

  // Seed settings
  for (const settingKey of SETTING_KEYS) {
    if (settingKey === 'system_init') continue;
    if (settingKey === 'privacySecurity' || settingKey === 'privacySecuritySettings') {
      const privData = dbState.privacySecuritySettings || dbState.privacySecurity;
      if (privData !== undefined) {
        promises.push(saveFirestoreSetting(settingKey, privData));
      }
    } else if (settingKey === 'paymentConfig' || settingKey === 'paymentSettings') {
      const payData = dbState.paymentConfig || dbState.settings?.paymentConfig || dbState.paymentSettings;
      if (payData !== undefined) {
        promises.push(saveFirestoreSetting(settingKey, payData));
      }
    } else if (dbState[settingKey] !== undefined) {
      promises.push(saveFirestoreSetting(settingKey, dbState[settingKey]));
    }
  }

  await Promise.allSettled(promises);
  console.log('[FIREBASE REST] Document-per-entity seed completed.');
}

export interface FirestoreLoadResult {
  state: Record<string, any>;
  isFreshDatabase: boolean;
  totalDocsLoaded: number;
}

/**
 * Loads entire state from Firestore document-per-entity structure via direct parallel REST queries.
 */
export async function loadStateFromFirestore(): Promise<FirestoreLoadResult | null> {
  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    console.warn('[FIREBASE REST] Missing Firebase API Key or Project ID in configuration');
    return null;
  }

  const baseUrl = getFirestoreRestBaseUrl();
  const queryUrl = `${baseUrl}:runQuery?key=${config.apiKey}`;

  try {
    const stateFromDb: Record<string, any> = {};
    let totalDocsLoaded = 0;

    // 1. Query settings collection
    const settingsPromise = (async () => {
      try {
        const res = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'settings' }]
            }
          })
        });
        if (!res.ok) {
          console.warn(`[FIREBASE REST] settings runQuery returned HTTP ${res.status}`);
          return { settingsMap: {}, success: false };
        }
        const data = await res.json();
        const settingsMap: Record<string, any> = {};
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.document && item.document.name) {
              const docId = item.document.name.split('/').pop() || '';
              const docData = decodeFirestoreDocument(item.document);
              delete docData._updatedAt;
              settingsMap[docId] = docData;
            }
          }
        }
        return { settingsMap, success: true };
      } catch (e) {
        console.error('[FIREBASE REST] Error querying settings:', e);
        return { settingsMap: {}, success: false };
      }
    })();

    // 2. Query all entity collections in parallel
    const entityPromises = ENTITY_COLLECTIONS.map(async (collName) => {
      try {
        const res = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: collName }]
            }
          })
        });
        if (!res.ok) {
          console.warn(`[FIREBASE REST] ${collName} runQuery returned HTTP ${res.status}`);
          return { collName, items: [], exists: false, success: false };
        }
        const data = await res.json();
        const items: any[] = [];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.document && item.document.name) {
              const docData = decodeFirestoreDocument(item.document);
              delete docData._updatedAt;
              items.push(docData);
            }
          }
        }
        return { collName, items, exists: items.length > 0, success: true };
      } catch (e) {
        console.error(`[FIREBASE REST] Error querying collection ${collName}:`, e);
        return { collName, items: [], exists: false, success: false };
      }
    });

    const [settingsRes, entityResults] = await Promise.all([
      settingsPromise,
      Promise.all(entityPromises)
    ]);

    // Process entity results
    for (const { collName, items, exists, success } of entityResults) {
      if (!success) {
        console.warn(`[FIREBASE REST] Skipping collection ${collName} due to fetch error to preserve memory state.`);
        continue;
      }
      if (collName === 'masterData') {
        const masterDoc = items.find((d: any) => d.id === 'data' || d.departments || d.designations) || items[0];
        if (masterDoc) {
          const cleanMaster = { ...masterDoc };
          delete cleanMaster.id;
          stateFromDb[collName] = cleanMaster;
        }
      } else if (['employeeKYC', 'employeePayroll', 'employeeAccounts'].includes(collName)) {
        const map: Record<string, any> = {};
        for (const item of items) {
          const key = item.employeeId || item.id;
          if (key) map[key] = item;
        }
        stateFromDb[collName] = map;
      } else {
        stateFromDb[collName] = items;
      }
      if (exists) {
        totalDocsLoaded += items.length;
      }
    }

    // Process settings results
    const settingsResult = settingsRes.settingsMap || {};
    const settingsCount = Object.keys(settingsResult).length;
    for (const [key, val] of Object.entries(settingsResult)) {
      stateFromDb[key] = val;
      if (key === 'privacySecurity' || key === 'privacySecuritySettings') {
        stateFromDb['privacySecurity'] = val;
        stateFromDb['privacySecuritySettings'] = val;
      }
      if (key === 'paymentSettings' || key === 'paymentConfig') {
        const flatPayment = sanitizePaymentConfig(val);
        if (!stateFromDb['settings']) stateFromDb['settings'] = {};
        stateFromDb['settings'].paymentConfig = flatPayment;
        stateFromDb['paymentConfig'] = flatPayment;
        stateFromDb['paymentSettings'] = flatPayment;
      }
      if (key === 'contactSettings') {
        stateFromDb['contactSettings'] = val;
      }
      if (key === 'aboutUs') {
        stateFromDb['aboutUs'] = val;
      }
      if (key === 'founder') {
        stateFromDb['founder'] = val;
      }
      if (key === 'companyProfile') {
        stateFromDb['companyProfile'] = val;
      }
    }

    const systemInitDoc = settingsResult['system_init'];
    const isAlreadyInitialized = !!systemInitDoc || totalDocsLoaded > 0 || settingsCount > 0;

    if (!isAlreadyInitialized) {
      console.log('[FIREBASE REST] Fresh database detected. Ready for initial seeding.');
      return { state: {}, isFreshDatabase: true, totalDocsLoaded: 0 };
    }

    console.log(`[FIREBASE REST] Successfully loaded ${totalDocsLoaded} entity docs and ${settingsCount} settings from Cloud Firestore.`);
    return { state: stateFromDb, isFreshDatabase: false, totalDocsLoaded };
  } catch (err) {
    console.error('[FIREBASE REST] Failed to load state from Firestore:', err);
    return null;
  }
}

/**
 * Persists changes to Firestore for a specific entity or setting key via direct REST calls.
 */
export async function persistFirestoreChange(
  dbState: Record<string, any>,
  collectionOrKey?: string,
  id?: string
): Promise<void> {
  if (!collectionOrKey) {
    // Flush all active settings
    const promises: Promise<any>[] = [];
    for (const key of SETTING_KEYS) {
      if (dbState[key] !== undefined && key !== 'system_init') {
        if (key === 'paymentConfig' || key === 'paymentSettings') {
          const flatPayment = sanitizePaymentConfig(dbState.paymentConfig || dbState.settings?.paymentConfig || dbState.paymentSettings);
          promises.push(saveFirestoreSetting('paymentConfig', flatPayment));
          promises.push(saveFirestoreSetting('paymentSettings', flatPayment));
        } else {
          promises.push(saveFirestoreSetting(key, dbState[key]));
        }
      }
    }
    await Promise.allSettled(promises);
    return;
  }

  // Check if it's a setting
  if ((SETTING_KEYS as readonly string[]).includes(collectionOrKey) || collectionOrKey === 'settings') {
    if (collectionOrKey === 'paymentConfig' || collectionOrKey === 'paymentSettings' || collectionOrKey === 'settings') {
      const rawData = dbState.paymentConfig || dbState.settings?.paymentConfig || dbState.paymentSettings;
      const dataToSave = sanitizePaymentConfig(rawData);
      dbState.paymentConfig = dataToSave;
      dbState.paymentSettings = dataToSave;
      if (dbState.settings) dbState.settings.paymentConfig = dataToSave;
      await Promise.allSettled([
        saveFirestoreSetting('paymentConfig', dataToSave),
        saveFirestoreSetting('paymentSettings', dataToSave),
        saveFirestoreSetting('settings', dbState.settings || {})
      ]);
    } else if (collectionOrKey === 'privacySecurity' || collectionOrKey === 'privacySecuritySettings') {
      const dataToSave = dbState.privacySecuritySettings || dbState.privacySecurity;
      if (dataToSave) {
        dbState.privacySecuritySettings = dataToSave;
        dbState.privacySecurity = dataToSave;
        await Promise.allSettled([
          saveFirestoreSetting('privacySecurity', dataToSave),
          saveFirestoreSetting('privacySecuritySettings', dataToSave)
        ]);
      }
    } else if (collectionOrKey === 'aboutUs') {
      if (dbState.aboutUs) {
        await saveFirestoreSetting('aboutUs', dbState.aboutUs);
      }
    } else if (collectionOrKey === 'founder') {
      if (dbState.founder) {
        await saveFirestoreSetting('founder', dbState.founder);
      }
    } else if (collectionOrKey === 'contactSettings') {
      if (dbState.contactSettings) {
        await saveFirestoreSetting('contactSettings', dbState.contactSettings);
      }
    } else if (collectionOrKey === 'companyProfile') {
      if (dbState.companyProfile) {
        await saveFirestoreSetting('companyProfile', dbState.companyProfile);
      }
    } else if (dbState[collectionOrKey] !== undefined) {
      await saveFirestoreSetting(collectionOrKey, dbState[collectionOrKey]);
    }
    return;
  }

  // Check if it's an entity collection
  if ((ENTITY_COLLECTIONS as readonly string[]).includes(collectionOrKey)) {
    if (collectionOrKey === 'masterData') {
      if (dbState.masterData) {
        await saveFirestoreDoc('masterData', 'data', dbState.masterData);
      }
      return;
    }

    if (['employeeKYC', 'employeePayroll', 'employeeAccounts'].includes(collectionOrKey)) {
      const map = dbState[collectionOrKey];
      if (id && map) {
        const item = map[id];
        if (item) {
          await saveFirestoreDoc(collectionOrKey, String(id), item);
        } else {
          await deleteFirestoreDoc(collectionOrKey, String(id));
        }
      } else if (map && typeof map === 'object') {
        const promises = Object.entries(map).map(([k, item]) => {
          if (item && typeof item === 'object') {
            return saveFirestoreDoc(collectionOrKey, String(k), item);
          }
          return Promise.resolve();
        });
        await Promise.allSettled(promises);
      }
      return;
    }

    if (id) {
      const list = dbState[collectionOrKey];
      if (Array.isArray(list)) {
        const item = list.find((x: any) => String(x.id) === String(id));
        if (item) {
          await saveFirestoreDoc(collectionOrKey, String(id), item);
        } else {
          await deleteFirestoreDoc(collectionOrKey, String(id));
        }
      }
    } else {
      // Collection-wide sync
      const list = dbState[collectionOrKey];
      if (Array.isArray(list)) {
        const savePromises = list.map((item: any) => {
          if (item && item.id) {
            return saveFirestoreDoc(collectionOrKey, String(item.id), item);
          }
          return Promise.resolve();
        });
        await Promise.allSettled(savePromises);
      }
    }
  }
}
