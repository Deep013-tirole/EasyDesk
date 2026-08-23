import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, setLogLevel } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('error');
} catch {}

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

export function getFirestoreDb() {
  if (firestoreInstance) return firestoreInstance;
  try {
    let config: any = defaultFirebaseConfig;
    if (!config || !config.apiKey) {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    }
    if (config && config.apiKey) {
      const firebaseConfig = {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      };
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const databaseId = config.firestoreDatabaseId || '(default)';
      firestoreInstance = getFirestore(app, databaseId);

      console.log(`[FIREBASE] Initialized Firestore with database ID: ${databaseId}`);
      return firestoreInstance;
    }
  } catch (err) {
    console.error('[FIREBASE] Error initializing Firestore:', err);
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
 * Saves a single document to its entity collection in Firestore.
 */
export async function saveFirestoreDoc(collectionName: string, docId: string, data: any): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  if (!docId) return;

  try {
    const docRef = doc(db, collectionName, String(docId));
    const cleanData = JSON.parse(JSON.stringify(data));
    await withTimeout(setDoc(docRef, { ...cleanData, _updatedAt: Date.now() }), 10000, null);
    console.log(`[FIREBASE] Saved doc to ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`[FIREBASE] Failed to save doc to ${collectionName}/${docId}:`, err);
  }
}

/**
 * Deletes a single document from an entity collection in Firestore.
 */
export async function deleteFirestoreDoc(collectionName: string, docId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  if (!docId) return;

  try {
    const docRef = doc(db, collectionName, String(docId));
    await withTimeout(deleteDoc(docRef), 10000, null);
    console.log(`[FIREBASE] Successfully deleted doc from ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`[FIREBASE] Failed to delete doc from ${collectionName}/${docId}:`, err);
  }
}

/**
 * Saves a settings object to the 'settings' collection in Firestore.
 */
export async function saveFirestoreSetting(settingKey: string, data: any): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    const docRef = doc(db, 'settings', settingKey);
    const cleanData = JSON.parse(JSON.stringify(data));
    await withTimeout(setDoc(docRef, { ...cleanData, _updatedAt: Date.now() }), 10000, null);
    console.log(`[FIREBASE] Saved setting to settings/${settingKey}`);
  } catch (err) {
    console.error(`[FIREBASE] Failed to save setting ${settingKey}:`, err);
  }
}

/**
 * Seeds all dbState collections and settings to document-per-entity structure in Firestore.
 */
export async function seedFirestoreFromInitialState(dbState: Record<string, any>): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  console.log('[FIREBASE] Writing document-per-entity structure to Firestore...');
  const promises: Promise<void>[] = [];

  // Write system initialization sentinel FIRST
  promises.push(saveFirestoreSetting('system_init', {
    isInitialized: true,
    initializedAt: new Date().toISOString(),
    version: '2.0.0'
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
    if (settingKey === 'system_init') continue; // Handled above
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
  console.log('[FIREBASE] Document-per-entity write completed successfully.');
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

export interface FirestoreLoadResult {
  state: Record<string, any>;
  isFreshDatabase: boolean;
  totalDocsLoaded: number;
}

/**
 * Loads entire state from Firestore document-per-entity structure in parallel.
 * Returns null if Firestore is completely offline or unreachable.
 */
export async function loadStateFromFirestore(): Promise<FirestoreLoadResult | null> {
  const db = getFirestoreDb();
  if (!db) {
    console.warn('[FIREBASE] Firestore unavailable');
    return null;
  }

  try {
    const stateFromDb: Record<string, any> = {};
    let totalDocsLoaded = 0;

    // 1. Check system_init sentinel
    let systemInitDoc: any = null;
    try {
      const initDocSnap = await withTimeout(getDoc(doc(db, 'settings', 'system_init')), 8000, null);
      if (initDocSnap && initDocSnap.exists()) {
        systemInitDoc = initDocSnap.data();
      }
    } catch (e) {
      console.warn('[FIREBASE] Error querying settings/system_init:', e);
    }

    // 2. Load all entity collections in parallel with 8s timeout
    const entityPromises = ENTITY_COLLECTIONS.map(async (collName) => {
      try {
        const queryPromise = getDocs(collection(db, collName));
        const querySnapshot = await withTimeout(queryPromise, 8000, null);
        if (querySnapshot) {
          const items: any[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            delete data._updatedAt;
            items.push(data);
          });
          return { collName, items, exists: !querySnapshot.empty, success: true };
        }
      } catch (e) {
        console.error(`[FIREBASE] Error querying collection ${collName}:`, e);
      }
      return { collName, items: [], exists: false, success: false };
    });

    const settingsPromise = (async () => {
      try {
        const queryPromise = getDocs(collection(db, 'settings'));
        const settingsSnapshot = await withTimeout(queryPromise, 8000, null);
        if (settingsSnapshot && !settingsSnapshot.empty) {
          const settingsMap: Record<string, any> = {};
          settingsSnapshot.forEach((docSnap) => {
            const key = docSnap.id;
            const data = docSnap.data();
            delete data._updatedAt;
            settingsMap[key] = data;
          });
          return { settingsMap, success: true };
        }
        return { settingsMap: {}, success: !!settingsSnapshot };
      } catch (e) {
        console.error('[FIREBASE] Error querying settings collection:', e);
        return { settingsMap: {}, success: false };
      }
    })();

    const [entityResults, settingsRes] = await Promise.all([
      Promise.all(entityPromises),
      settingsPromise,
    ]);

    for (const { collName, items, exists } of entityResults) {
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
        // Authoritative entity collection assignment - even if items is [] so empty collections persist!
        stateFromDb[collName] = items;
      }
      if (exists) {
        totalDocsLoaded += items.length;
      }
    }

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
    }

    // Determine if database has ever been initialized
    const isAlreadyInitialized = !!systemInitDoc || totalDocsLoaded > 0 || settingsCount > 0;

    if (!isAlreadyInitialized) {
      // Check legacy 'app_state' doc migration only if brand new
      console.log('[FIREBASE] No system_init sentinel found. Checking legacy app_state doc...');
      const legacyPromise = getDocs(collection(db, 'app_state'));
      const legacySnapshot = await withTimeout(legacyPromise, 8000, null);
      if (legacySnapshot && !legacySnapshot.empty) {
        const legacyState: Record<string, any> = {};
        legacySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && 'data' in data) {
            legacyState[docSnap.id] = data.data;
          }
        });

        if (Object.keys(legacyState).length > 0) {
          console.log('[FIREBASE] Migrating legacy app_state to document-per-entity structure...');
          await seedFirestoreFromInitialState(legacyState);
          return { state: legacyState, isFreshDatabase: false, totalDocsLoaded: Object.keys(legacyState).length };
        }
      }
      // Genuinely fresh, empty database
      return { state: {}, isFreshDatabase: true, totalDocsLoaded: 0 };
    }

    console.log(`[FIREBASE] Successfully loaded ${totalDocsLoaded} entity docs and ${settingsCount} settings from Cloud Firestore.`);
    return { state: stateFromDb, isFreshDatabase: false, totalDocsLoaded };
  } catch (err) {
    console.error('[FIREBASE] Failed to load state from Firestore:', err);
    return null;
  }
}

/**
 * Persists changes to Firestore for a specific entity or setting key.
 */
export async function persistFirestoreChange(
  dbState: Record<string, any>,
  collectionOrKey?: string,
  id?: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  if (!collectionOrKey) {
    // Save only active settings without blind collection overwrites
    for (const key of SETTING_KEYS) {
      if (dbState[key] !== undefined && key !== 'system_init') {
        await saveFirestoreSetting(key, dbState[key]);
      }
    }
    return;
  }

  // Check if it's a setting
  if ((SETTING_KEYS as readonly string[]).includes(collectionOrKey)) {
    if (collectionOrKey === 'paymentConfig' || collectionOrKey === 'paymentSettings') {
      const rawData = dbState.paymentConfig || dbState.settings?.paymentConfig || dbState.paymentSettings;
      const dataToSave = sanitizePaymentConfig(rawData);
      dbState.paymentConfig = dataToSave;
      dbState.paymentSettings = dataToSave;
      if (dbState.settings) dbState.settings.paymentConfig = dataToSave;
      await saveFirestoreSetting('paymentConfig', dataToSave);
      await saveFirestoreSetting('paymentSettings', dataToSave);
    } else if (collectionOrKey === 'privacySecurity' || collectionOrKey === 'privacySecuritySettings') {
      const dataToSave = dbState.privacySecuritySettings || dbState.privacySecurity;
      if (dataToSave) {
        dbState.privacySecuritySettings = dataToSave;
        dbState.privacySecurity = dataToSave;
        await saveFirestoreSetting('privacySecurity', dataToSave);
        await saveFirestoreSetting('privacySecuritySettings', dataToSave);
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
      // Collection-wide sync: prune deleted documents from Firestore
      const list = dbState[collectionOrKey];
      if (Array.isArray(list)) {
        try {
          const snapshot = await getDocs(collection(db, collectionOrKey));
          const currentMemoryIds = new Set(list.map((x: any) => String(x.id)));
          const deletePromises: Promise<void>[] = [];
          snapshot.forEach((d) => {
            if (!currentMemoryIds.has(d.id)) {
              deletePromises.push(deleteFirestoreDoc(collectionOrKey, d.id));
            }
          });
          if (deletePromises.length > 0) {
            await Promise.allSettled(deletePromises);
          }
        } catch (e) {
          console.warn(`[FIREBASE] Prune check failed for ${collectionOrKey}:`, e);
        }

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
