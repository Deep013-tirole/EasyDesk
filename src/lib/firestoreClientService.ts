import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseClient';
import bcrypt from 'bcryptjs';
import { Service, ServiceCategory, Blog, BlogCategory, Review, User, UserRole } from '../types';

/**
 * Timeout helper to prevent hanging promises on slow network or disconnected clients
 */
function withTimeout<T>(promise: Promise<T>, ms = 12000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

function isNetworkOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function handleFirestoreError(context: string, err: any) {
  const isOffline = isNetworkOffline();
  const isUnavailable = err?.code === 'unavailable' || err?.message?.includes('offline') || err?.message?.includes('network') || err?.message?.includes('Failed to fetch');
  if (!isOffline && !isUnavailable) {
    console.warn(`[FirestoreClient] ${context}:`, err);
  }
}

/**
 * Loads all services directly from Firestore
 */
export async function getClientServices(): Promise<Service[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'services');
    const snapshot = await withTimeout(getDocs(q), 12000, null);
    if (!snapshot || snapshot.empty) return [];
    
    const list: Service[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id } as Service);
    });
    return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } catch (err) {
    handleFirestoreError('Error fetching services', err);
    return [];
  }
}

/**
 * Loads all service categories directly from Firestore
 */
export async function getClientCategories(includeAll = false): Promise<ServiceCategory[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'categories');
    const snapshot = await withTimeout(getDocs(q), 12000, null);
    if (!snapshot || snapshot.empty) return [];

    const list: ServiceCategory[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id } as ServiceCategory);
    });
    
    const filtered = includeAll ? list : list.filter(c => c.status !== 'Inactive');
    return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    handleFirestoreError('Error fetching categories', err);
    return [];
  }
}

/**
 * Loads all blog categories directly from Firestore
 */
export async function getClientBlogCategories(includeAll = false): Promise<BlogCategory[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'blogCategories');
    const snapshot = await withTimeout(getDocs(q), 12000, null);
    if (!snapshot || snapshot.empty) return [];

    const list: BlogCategory[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id } as BlogCategory);
    });

    const filtered = includeAll ? list : list.filter(c => c.status !== 'Inactive');
    return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    handleFirestoreError('Error fetching blog categories', err);
    return [];
  }
}

/**
 * Loads all blogs directly from Firestore
 */
export async function getClientBlogs(): Promise<Blog[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'blogs');
    const snapshot = await withTimeout(getDocs(q), 12000, null);
    if (!snapshot || snapshot.empty) return [];

    const list: Blog[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id } as Blog);
    });
    return list.sort((a, b) => new Date(b.publishedAt || b.date || 0).getTime() - new Date(a.publishedAt || a.date || 0).getTime());
  } catch (err) {
    handleFirestoreError('Error fetching blogs', err);
    return [];
  }
}

/**
 * Loads all reviews directly from Firestore
 */
export async function getClientReviews(): Promise<Review[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'reviews');
    const snapshot = await withTimeout(getDocs(q), 12000, null);
    if (!snapshot || snapshot.empty) return [];

    const list: Review[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id } as Review);
    });
    return list.filter(r => r.status === 'Approved' || (r as any).status === undefined);
  } catch (err) {
    handleFirestoreError('Error fetching reviews', err);
    return [];
  }
}

/**
 * Loads all FAQs directly from Firestore
 */
export async function getClientFaqs(): Promise<any[]> {
  if (isNetworkOffline()) return [];
  try {
    const q = collection(db, 'faqs');
    const snapshot = await withTimeout(getDocs(q), 4000, null);
    if (!snapshot || snapshot.empty) return [];

    const list: any[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      delete data._updatedAt;
      list.push({ ...data, id: data.id || d.id });
    });
    return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    handleFirestoreError('Error fetching faqs', err);
    return [];
  }
}

/**
 * Loads a specific setting document directly from Firestore
 */
export async function getClientSetting<T = any>(settingKey: string): Promise<T | null> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    const docRef = doc(db, 'settings', settingKey);
    const snap = await withTimeout(getDoc(docRef), 4000, null);
    if (snap && snap.exists()) {
      const data = snap.data();
      delete data._updatedAt;
      return data as T;
    }
  } catch (err: any) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isUnavailable = err?.code === 'unavailable' || err?.message?.includes('offline') || err?.message?.includes('network');
    if (!isOffline && !isUnavailable) {
      console.warn(`[FirestoreClient] Error fetching setting ${settingKey}:`, err);
    }
  }
  return null;
}

/**
 * Loads Privacy & Security settings directly from Firestore with robust fallback
 */
export async function getClientPrivacySecurity(): Promise<any> {
  try {
    const direct1 = await getClientSetting('privacySecurity');
    if (direct1 && direct1.hero) return direct1;

    const direct2 = await getClientSetting('privacySecuritySettings');
    if (direct2 && direct2.hero) return direct2;
  } catch (err) {
    handleFirestoreError('Error loading Privacy & Security', err);
  }
  return null;
}

/**
 * Loads Payment Configuration directly from Firestore
 */
export async function getClientPaymentConfig(): Promise<any> {
  try {
    const pay1 = await getClientSetting('paymentConfig');
    if (pay1 && (pay1.upiId || pay1.bankName || pay1.accountNumber)) return pay1;

    const pay2 = await getClientSetting('paymentSettings');
    if (pay2 && (pay2.upiId || pay2.bankName || pay2.accountNumber)) return pay2;
  } catch (err) {
    handleFirestoreError('Error loading Payment Config', err);
  }
  return null;
}

/**
 * Loads Contact Settings directly from Firestore
 */
export async function getClientContactSettings(): Promise<any> {
  try {
    const contact = await getClientSetting('contactSettings');
    if (contact && (contact.phone || contact.email || contact.companyName)) return contact;
  } catch (err) {
    handleFirestoreError('Error loading Contact Settings', err);
  }
  return null;
}

/**
 * Loads About Us and Founder data directly from Firestore
 */
export async function getClientAboutUs(): Promise<{ aboutUs: any; founder: any }> {
  try {
    const [aboutUs, founder] = await Promise.all([
      getClientSetting('aboutUs'),
      getClientSetting('founder')
    ]);
    return { aboutUs, founder };
  } catch (err) {
    handleFirestoreError('Error loading About Us', err);
    return { aboutUs: null, founder: null };
  }
}

/**
 * Authenticates admin directly via server backend API to ensure credentials, hashes, and passwords never touch client-side Firestore queries
 */
export async function authenticateAdminDirect(loginId: string, rawPassword: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  try {
    const cleanId = (loginId || '').trim();
    const cleanPass = (rawPassword || '').trim();

    if (!cleanId) {
      return { success: false, error: 'Login ID / Email is required.' };
    }

    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'easydesk_secure_csrf_token_2026_val'
      },
      body: JSON.stringify({ email: cleanId, password: cleanPass })
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (res.ok && data && (data.accessToken || data.token)) {
      return {
        success: true,
        user: data.user,
        token: data.accessToken || data.token
      };
    }

    if (data && data.message) {
      return { success: false, error: data.message };
    }

    return { success: false, error: `Authentication failed (${res.status} ${res.statusText}).` };
  } catch (err: any) {
    console.error('[AdminAuth] Error calling authentication endpoint:', err);
    return { success: false, error: err?.message || 'Server connection error during authentication.' };
  }
}


/**
 * Saves a document directly to Firestore collection
 */
export async function saveClientFirestoreDoc(collectionName: string, docId: string, data: any): Promise<boolean> {
  try {
    const docRef = doc(db, collectionName, String(docId));
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, { ...cleanData, _updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error(`[FirestoreClient] Error saving to ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Deletes a document directly from Firestore collection
 */
export async function deleteClientFirestoreDoc(collectionName: string, docId: string): Promise<boolean> {
  try {
    const docRef = doc(db, collectionName, String(docId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`[FirestoreClient] Error deleting from ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Saves a setting document directly to Firestore 'settings' collection
 */
export async function saveClientFirestoreSetting(settingKey: string, data: any): Promise<boolean> {
  try {
    const docRef = doc(db, 'settings', settingKey);
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, { ...cleanData, _updatedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error(`[FirestoreClient] Error saving setting ${settingKey}:`, err);
    return false;
  }
}
