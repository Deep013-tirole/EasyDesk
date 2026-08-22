import { useState, useEffect, useCallback } from 'react';
import { ServiceCategory, BlogCategory, Service, Blog, Review } from '../types';
import {
  CATALOG_CACHE_KEYS,
  getCachedCatalog,
  setCachedCatalog,
  fetchAllCatalogsWithCache,
  fetchReviewsWithCache,
  invalidateReviewsCache,
  AllCatalogs
} from '../services/catalogService';

export interface UseCatalogReturn {
  categories: ServiceCategory[];
  blogCategories: BlogCategory[];
  services: Service[];
  blogs: Blog[];
  reviews: Review[];
  loading: boolean;
  isUsingCache: boolean;
  error: string | null;
  refetchAll: () => Promise<AllCatalogs>;
  refetchReviews: () => Promise<Review[]>;
  updateCategories: (cats: ServiceCategory[]) => void;
  updateBlogCategories: (blogCats: BlogCategory[]) => void;
  updateServices: (servs: Service[]) => void;
  updateBlogs: (blogs: Blog[]) => void;
  updateReviews: (revs: Review[]) => void;
  setCategories: (cats: ServiceCategory[]) => void;
  setBlogCategories: (blogCats: BlogCategory[]) => void;
  setServices: (servs: Service[]) => void;
  setBlogs: (blogs: Blog[]) => void;
  setReviews: (revs: Review[]) => void;
}

export function useCatalog(): UseCatalogReturn {
  // Initialize state synchronously from localStorage cache if available
  const [categories, setCategoriesState] = useState<ServiceCategory[]>(() =>
    getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, [])
  );
  const [blogCategories, setBlogCategoriesState] = useState<BlogCategory[]>(() =>
    getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, [])
  );
  const [services, setServicesState] = useState<Service[]>(() =>
    getCachedCatalog<Service[]>(CATALOG_CACHE_KEYS.SERVICES, [])
  );
  const [blogs, setBlogsState] = useState<Blog[]>(() =>
    getCachedCatalog<Blog[]>(CATALOG_CACHE_KEYS.BLOGS, [])
  );
  const [reviews, setReviewsState] = useState<Review[]>(() =>
    getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, [])
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [isUsingCache, setIsUsingCache] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetchAll = useCallback(async (): Promise<AllCatalogs> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllCatalogsWithCache();
      setCategoriesState(result.catalogs.categories);
      setBlogCategoriesState(result.catalogs.blogCategories || []);
      setServicesState(result.catalogs.services);
      setBlogsState(result.catalogs.blogs);
      setReviewsState(result.catalogs.reviews);
      setIsUsingCache(result.isCached);
      if (result.errors.length > 0) {
        setError(result.errors.join('; '));
      }
      return result.catalogs;
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch catalog');
      setIsUsingCache(true);
      return {
        categories: getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, []),
        blogCategories: getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, []),
        services: getCachedCatalog<Service[]>(CATALOG_CACHE_KEYS.SERVICES, []),
        blogs: getCachedCatalog<Blog[]>(CATALOG_CACHE_KEYS.BLOGS, []),
        reviews: getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, [])
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCategories = useCallback((cats: ServiceCategory[]) => {
    setCategoriesState(cats);
    setCachedCatalog(CATALOG_CACHE_KEYS.CATEGORIES, cats);
  }, []);

  const updateBlogCategories = useCallback((blogCats: BlogCategory[]) => {
    setBlogCategoriesState(blogCats);
    setCachedCatalog(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, blogCats);
  }, []);

  const updateServices = useCallback((servs: Service[]) => {
    setServicesState(servs);
    setCachedCatalog(CATALOG_CACHE_KEYS.SERVICES, servs);
  }, []);

  const updateBlogs = useCallback((bList: Blog[]) => {
    setBlogsState(bList);
    setCachedCatalog(CATALOG_CACHE_KEYS.BLOGS, bList);
  }, []);

  const updateReviews = useCallback((rList: Review[]) => {
    setReviewsState(rList);
    setCachedCatalog(CATALOG_CACHE_KEYS.REVIEWS, rList);
  }, []);

  const refetchReviews = useCallback(async (): Promise<Review[]> => {
    invalidateReviewsCache();
    try {
      const result = await fetchReviewsWithCache([]);
      setReviewsState(result.data);
      return result.data;
    } catch (err) {
      console.warn('[useCatalog] Failed to refetch reviews:', err);
      return reviews;
    }
  }, [reviews]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  return {
    categories,
    blogCategories,
    services,
    blogs,
    reviews,
    loading,
    isUsingCache,
    error,
    refetchAll,
    refetchReviews,
    updateCategories,
    updateBlogCategories,
    updateServices,
    updateBlogs,
    updateReviews,
    setCategories: updateCategories,
    setBlogCategories: updateBlogCategories,
    setServices: updateServices,
    setBlogs: updateBlogs,
    setReviews: updateReviews
  };
}
