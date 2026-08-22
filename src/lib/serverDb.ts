import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

export function getFirestoreDb() {
  if (firestoreInstance) return firestoreInstance;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
] as const;

// Settings document keys stored inside the 'settings' Firestore collection
export const SETTING_KEYS = [
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

  console.log('[FIREBASE] Seeding Firestore with document-per-entity structure...');
  const promises: Promise<void>[] = [];

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
  console.log('[FIREBASE] Document-per-entity seeding completed successfully.');
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
}

/**
 * Loads entire state from Firestore document-per-entity structure in parallel.
 * Returns null if database is completely empty.
 */
export async function loadStateFromFirestore(): Promise<Record<string, any> | null> {
  const db = getFirestoreDb();
  if (!db) {
    console.warn('[FIREBASE] Firestore unavailable');
    return null;
  }

  try {
    const stateFromDb: Record<string, any> = {};
    let totalDocsLoaded = 0;

    // Load all entity collections in parallel with 8s timeout
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
          return { collName, items, exists: !querySnapshot.empty };
        }
      } catch (e) {
        console.error(`[FIREBASE] Error querying collection ${collName}:`, e);
      }
      return { collName, items: [], exists: false };
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
          return settingsMap;
        }
      } catch (e) {
        console.error('[FIREBASE] Error querying settings collection:', e);
      }
      return {};
    })();

    const [entityResults, settingsResult] = await Promise.all([
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
        // Authoritative entity collection assignment - even if items is [] so deletions persist!
        stateFromDb[collName] = items;
      }
      if (exists) {
        totalDocsLoaded += items.length;
      }
    }

    const settingsCount = Object.keys(settingsResult).length;
    for (const [key, val] of Object.entries(settingsResult)) {
      stateFromDb[key] = val;
      if (key === 'privacySecurity' || key === 'privacySecuritySettings') {
        const existing = stateFromDb['privacySecuritySettings'] || stateFromDb['privacySecurity'];
        if (!existing || (val && typeof val === 'object' && (!existing._updatedAt || (val._updatedAt && val._updatedAt >= existing._updatedAt)))) {
          stateFromDb['privacySecurity'] = val;
          stateFromDb['privacySecuritySettings'] = val;
        }
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

    // Check for legacy 'app_state' doc migration only if new collections and settings are completely empty
    if (totalDocsLoaded === 0 && settingsCount === 0) {
      console.log('[FIREBASE] Document-per-entity collections empty. Checking legacy app_state doc...');
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
          return legacyState;
        }
      }
      return {};
    }

    console.log(`[FIREBASE] Successfully loaded ${totalDocsLoaded} entity docs and ${settingsCount} settings from Cloud Firestore.`);
    return stateFromDb;
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
    // Save all settings and entities
    await seedFirestoreFromInitialState(dbState);
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
      // Collection-wide sync
      const list = dbState[collectionOrKey];
      if (Array.isArray(list)) {
        const promises = list.map((item: any) => {
          if (item && item.id) {
            return saveFirestoreDoc(collectionOrKey, String(item.id), item);
          }
          return Promise.resolve();
        });
        await Promise.allSettled(promises);
      }
    }
  }
}
