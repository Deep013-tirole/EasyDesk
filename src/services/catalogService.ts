import { ServiceCategory, BlogCategory, Service, Blog, Review } from '../types';
import { safeParseJsonResponse } from '../lib/apiClient';
import { 
  getClientServices, 
  getClientCategories, 
  getClientBlogCategories, 
  getClientBlogs, 
  getClientReviews 
} from '../lib/firestoreClientService';

export const CATALOG_CACHE_KEYS = {
  CATEGORIES: 'easydesk_cache_categories',
  CATEGORIES_ALL: 'easydesk_cache_categories_all',
  BLOG_CATEGORIES: 'easydesk_cache_blog_categories',
  BLOG_CATEGORIES_ALL: 'easydesk_cache_blog_categories_all',
  SERVICES: 'easydesk_cache_services',
  BLOGS: 'easydesk_cache_blogs',
  REVIEWS: 'easydesk_cache_reviews',
  LAST_UPDATED: 'easydesk_cache_last_updated'
};

/**
 * Reads cached data from localStorage safely.
 */
export function getCachedCatalog<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch (err) {
    console.warn(`[CatalogService] Error reading cache for ${key}:`, err);
    return fallback;
  }
}

/**
 * Saves data to localStorage cache safely.
 */
export function setCachedCatalog<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(CATALOG_CACHE_KEYS.LAST_UPDATED, new Date().toISOString());
  } catch (err) {
    console.warn(`[CatalogService] Error writing cache for ${key}:`, err);
  }
}

export interface FetchResult<T> {
  data: T;
  isCached: boolean;
  error?: string;
}

/**
 * Clears cached reviews from localStorage to force immediate refetch.
 */
export function invalidateReviewsCache(): void {
  try {
    localStorage.removeItem(CATALOG_CACHE_KEYS.REVIEWS);
  } catch (err) {
    console.warn('[CatalogService] Error clearing reviews cache:', err);
  }
}

/**
 * Clears all category caches (both active and all) to force immediate refetch across admin and client.
 */
export function invalidateCategoriesCache(): void {
  try {
    localStorage.removeItem(CATALOG_CACHE_KEYS.CATEGORIES);
    localStorage.removeItem(CATALOG_CACHE_KEYS.CATEGORIES_ALL);
    localStorage.removeItem(CATALOG_CACHE_KEYS.BLOG_CATEGORIES);
    localStorage.removeItem(CATALOG_CACHE_KEYS.BLOG_CATEGORIES_ALL);
  } catch (err) {
    console.warn('[CatalogService] Error clearing categories cache:', err);
  }
}

/**
 * Clears all catalog caches from localStorage.
 */
export function invalidateAllCatalogsCache(): void {
  try {
    localStorage.removeItem(CATALOG_CACHE_KEYS.CATEGORIES);
    localStorage.removeItem(CATALOG_CACHE_KEYS.CATEGORIES_ALL);
    localStorage.removeItem(CATALOG_CACHE_KEYS.BLOG_CATEGORIES);
    localStorage.removeItem(CATALOG_CACHE_KEYS.BLOG_CATEGORIES_ALL);
    localStorage.removeItem(CATALOG_CACHE_KEYS.SERVICES);
    localStorage.removeItem(CATALOG_CACHE_KEYS.BLOGS);
    localStorage.removeItem(CATALOG_CACHE_KEYS.REVIEWS);
    localStorage.removeItem(CATALOG_CACHE_KEYS.LAST_UPDATED);
  } catch (err) {
    console.warn('[CatalogService] Error clearing all catalog caches:', err);
  }
}

/**
 * Fetches data from a network endpoint with direct Firestore database fallback.
 */
export async function fetchWithCache<T>(
  endpoint: string,
  cacheKey: string,
  fallback: T,
  directFirestoreLoader?: () => Promise<T | null>
): Promise<FetchResult<T>> {
  try {
    const url = endpoint.includes('?') ? `${endpoint}&_t=${Date.now()}` : `${endpoint}?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (res.ok) {
      const data = await safeParseJsonResponse<T>(res);
      if (data !== null && data !== undefined) {
        setCachedCatalog(cacheKey, data);
        return { data, isCached: false };
      }
    }
  } catch (err: any) {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!isOffline) {
      console.warn(`[CatalogService] Network fetch failed for ${endpoint}. Checking Cloud Firestore directly.`, err?.message || err);
    }
  }

  // Authoritative Direct Firestore Fallback
  if (directFirestoreLoader && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      const firestoreData = await directFirestoreLoader();
      if (firestoreData !== null && firestoreData !== undefined) {
        setCachedCatalog(cacheKey, firestoreData);
        return { data: firestoreData, isCached: false };
      }
    } catch (fsErr: any) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!isOffline) {
        console.warn(`[CatalogService] Direct Firestore fetch failed for ${cacheKey}:`, fsErr?.message || fsErr);
      }
    }
  }

  const cachedData = getCachedCatalog<T>(cacheKey, fallback);
  return {
    data: cachedData,
    isCached: true
  };
}

export async function fetchCategoriesWithCache(fallback: ServiceCategory[] = [], includeAll = false): Promise<FetchResult<ServiceCategory[]>> {
  const endpoint = includeAll ? '/api/categories?all=true' : '/api/categories';
  const cacheKey = includeAll ? CATALOG_CACHE_KEYS.CATEGORIES_ALL : CATALOG_CACHE_KEYS.CATEGORIES;
  return fetchWithCache<ServiceCategory[]>(
    endpoint, 
    cacheKey, 
    fallback,
    () => getClientCategories(includeAll)
  );
}

export async function fetchBlogCategoriesWithCache(fallback: BlogCategory[] = [], includeAll = false): Promise<FetchResult<BlogCategory[]>> {
  const endpoint = includeAll ? '/api/blog-categories?all=true' : '/api/blog-categories';
  const cacheKey = includeAll ? CATALOG_CACHE_KEYS.BLOG_CATEGORIES_ALL : CATALOG_CACHE_KEYS.BLOG_CATEGORIES;
  return fetchWithCache<BlogCategory[]>(
    endpoint, 
    cacheKey, 
    fallback,
    () => getClientBlogCategories(includeAll)
  );
}

export async function fetchServicesWithCache(fallback: Service[] = []): Promise<FetchResult<Service[]>> {
  return fetchWithCache<Service[]>(
    '/api/services', 
    CATALOG_CACHE_KEYS.SERVICES, 
    fallback,
    () => getClientServices()
  );
}

export async function fetchBlogsWithCache(fallback: Blog[] = []): Promise<FetchResult<Blog[]>> {
  return fetchWithCache<Blog[]>(
    '/api/blogs', 
    CATALOG_CACHE_KEYS.BLOGS, 
    fallback,
    () => getClientBlogs()
  );
}

export async function fetchReviewsWithCache(fallback: Review[] = []): Promise<FetchResult<Review[]>> {
  return fetchWithCache<Review[]>(
    '/api/reviews', 
    CATALOG_CACHE_KEYS.REVIEWS, 
    fallback,
    () => getClientReviews()
  );
}

export interface AllCatalogs {
  categories: ServiceCategory[];
  blogCategories: BlogCategory[];
  services: Service[];
  blogs: Blog[];
  reviews: Review[];
}

export interface FetchAllCatalogsResult {
  catalogs: AllCatalogs;
  isCached: boolean;
  errors: string[];
}

export async function fetchAllCatalogsWithCache(): Promise<FetchAllCatalogsResult> {
  const cachedCat = getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, []);
  const cachedBlogCat = getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, []);
  const cachedServ = getCachedCatalog<Service[]>(CATALOG_CACHE_KEYS.SERVICES, []);
  const cachedBlog = getCachedCatalog<Blog[]>(CATALOG_CACHE_KEYS.BLOGS, []);
  const cachedRev = getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, []);

  const [catRes, blogCatRes, servRes, blogRes, revRes] = await Promise.allSettled([
    fetchCategoriesWithCache(cachedCat),
    fetchBlogCategoriesWithCache(cachedBlogCat),
    fetchServicesWithCache(cachedServ),
    fetchBlogsWithCache(cachedBlog),
    fetchReviewsWithCache(cachedRev)
  ]);

  const categories = catRes.status === 'fulfilled' ? catRes.value.data : cachedCat;
  const blogCategories = blogCatRes.status === 'fulfilled' ? blogCatRes.value.data : cachedBlogCat;
  const services = servRes.status === 'fulfilled' ? servRes.value.data : cachedServ;
  const blogs = blogRes.status === 'fulfilled' ? blogRes.value.data : cachedBlog;
  const reviews = revRes.status === 'fulfilled' ? revRes.value.data : cachedRev;

  const isCached =
    (catRes.status === 'fulfilled' && catRes.value.isCached) ||
    (blogCatRes.status === 'fulfilled' && blogCatRes.value.isCached) ||
    (servRes.status === 'fulfilled' && servRes.value.isCached) ||
    (blogRes.status === 'fulfilled' && blogRes.value.isCached) ||
    (revRes.status === 'fulfilled' && revRes.value.isCached) ||
    catRes.status === 'rejected' ||
    blogCatRes.status === 'rejected' ||
    servRes.status === 'rejected' ||
    blogRes.status === 'rejected' ||
    revRes.status === 'rejected';

  const errors: string[] = [];
  if (catRes.status === 'rejected') errors.push(`Categories: ${catRes.reason}`);
  if (blogCatRes.status === 'rejected') errors.push(`Blog Categories: ${blogCatRes.reason}`);
  if (servRes.status === 'rejected') errors.push(`Services: ${servRes.reason}`);
  if (blogRes.status === 'rejected') errors.push(`Blogs: ${blogRes.reason}`);
  if (revRes.status === 'rejected') errors.push(`Reviews: ${revRes.reason}`);

  return {
    catalogs: {
      categories,
      blogCategories,
      services,
      blogs,
      reviews
    },
    isCached,
    errors
  };
}

