import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import Header from './components/Header.js';
import HomeView from './components/HomeView.js';
import ServicesView from './components/ServicesView.js';
import Footer from './components/Footer.js';

// Lazy load heavy administrative, secondary, and portal routes for minimal initial bundle size
const ServiceDetailsView = lazy(() => import('./components/ServiceDetailsView.js'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard.js'));
const BlogsView = lazy(() => import('./components/BlogsView.js'));
const TrackingView = lazy(() => import('./components/TrackingView.js'));
const AIChatAssistant = lazy(() => import('./components/AIChatAssistant.js'));
const AuthPortal = lazy(() => import('./components/AuthPortal.js'));
const AboutUsView = lazy(() => import('./components/AboutUsView.js'));
const ContactView = lazy(() => import('./components/ContactView.js'));
const PaymentView = lazy(() => import('./components/PaymentView.js'));
const PrivacySecurityView = lazy(() => import('./components/PrivacySecurityView.js'));
const ReviewSubmissionForm = lazy(() => import('./components/ReviewSubmissionForm.js'));

import { User, Service } from './types.js';
import { useCatalog } from './hooks/useCatalog.js';
import { useScrollToTopOnChange } from './lib/scrollUtils.js';
import { auth, onAuthStateChanged } from './lib/firebaseClient.js';
import { LanguageProvider } from './context/LanguageContext.js';
import { WifiOff, RefreshCw } from 'lucide-react';

function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-xs text-slate-400 font-sans">
      <div className="w-7 h-7 border-3 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
      <span>Loading EasyDesk module...</span>
    </div>
  );
}

export default function App() {
  
  // Routing state
  const [view, setView] = useState<string>('home');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Global scroll-to-top on route / main view transition
  useScrollToTopOnChange([view, selectedServiceId]);

  // Admin user state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedAdmin = localStorage.getItem('easydesk_admin_user');
      return savedAdmin ? JSON.parse(savedAdmin) : null;
    } catch {
      return null;
    }
  });

  // App Catalog database with automatic localStorage cache fallback
  const {
    categories,
    blogCategories,
    services,
    blogs,
    updateBlogs,
    reviews,
    setReviews,
    loading,
    refetchAll: fetchPlatformCatalogs
  } = useCatalog();

  // Network connectivity status listener & auto-resync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchPlatformCatalogs();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchPlatformCatalogs]);

  // Helper to parse route from browser URL
  const parseRouteFromLocation = useCallback(() => {
    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    const queryService = searchParams.get('service') || searchParams.get('serviceId');
    if (queryService) {
      return { view: 'service-details', serviceId: queryService };
    }

    const servicePathMatch = pathname.match(/^\/services\/([a-zA-Z0-9_-]+)/);
    if (servicePathMatch && servicePathMatch[1]) {
      return { view: 'service-details', serviceId: servicePathMatch[1] };
    }

    const hashMatch = hash.match(/^#(?:services|service)\/([a-zA-Z0-9_-]+)/);
    if (hashMatch && hashMatch[1]) {
      return { view: 'service-details', serviceId: hashMatch[1] };
    }

    if (pathname === '/services' || hash === '#services') return { view: 'services', serviceId: null };
    if (pathname === '/blogs' || hash === '#blogs') return { view: 'blogs', serviceId: null };
    if (pathname === '/about' || hash === '#about') return { view: 'about', serviceId: null };
    if (pathname === '/contact' || hash === '#contact') return { view: 'contact', serviceId: null };
    if (pathname === '/payment' || hash === '#payment') return { view: 'payment', serviceId: null };
    if (pathname === '/privacy-security' || hash === '#privacy-security') return { view: 'privacy-security', serviceId: null };
    if (pathname === '/admin' || hash === '#admin') return { view: 'admin', serviceId: null };
    if (pathname === '/admin-login' || hash === '#admin-login') return { view: 'admin-login', serviceId: null };
    if (pathname === '/track' || hash === '#track') return { view: 'track', serviceId: null };
    if (pathname === '/submit-review' || hash === '#submit-review') return { view: 'submit-review', serviceId: null };

    return { view: 'home', serviceId: null };
  }, []);

  // Custom navigation wrapper with history sync
  const handleSetView = useCallback((nextView: string) => {
    setView(nextView);
    if (nextView !== 'service-details') {
      setSelectedServiceId(null);
    }
    
    let targetPath = nextView === 'home' ? '/' : `/${nextView}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: nextView, serviceId: null }, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSelectService = useCallback((sId: string | null) => {
    setSelectedServiceId(sId);
    if (sId) {
      setView('service-details');
      const targetPath = `/services/${sId}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: 'service-details', serviceId: sId }, '', targetPath);
      }
    } else {
      setView('services');
      if (window.location.pathname !== '/services') {
        window.history.pushState({ view: 'services', serviceId: null }, '', '/services');
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Initial load and PopState listener
  useEffect(() => {
    const route = parseRouteFromLocation();
    setView(route.view);
    setSelectedServiceId(route.serviceId);

    const handlePopState = () => {
      const r = parseRouteFromLocation();
      setView(r.view);
      setSelectedServiceId(r.serviceId);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseRouteFromLocation]);

  useEffect(() => {
    // Purge obsolete customer keys from localStorage if present
    localStorage.removeItem('easydesk_user');
    localStorage.removeItem('easydesk_token');

    // Restore saved admin user session
    const savedAdminToken = localStorage.getItem('easydesk_admin_token');
    const savedAdminUser = localStorage.getItem('easydesk_admin_user');
    
    if (savedAdminUser) {
      try {
        const parsedAdmin = JSON.parse(savedAdminUser);
        const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(parsedAdmin?.role);
        if (parsedAdmin && isAdminRole) {
          setCurrentUser(parsedAdmin);
        }
      } catch (e) {
        localStorage.removeItem('easydesk_admin_user');
      }
    }

    // Verify token with backend if present
    if (savedAdminToken) {
      fetch('/api/auth/admin/me', {
        headers: { 'Authorization': `Bearer ${savedAdminToken}` }
      })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
            return;
          }
        }
        // Try refresh token if access token expired
        const refreshToken = localStorage.getItem('easydesk_admin_refresh') || localStorage.getItem('easydesk_admin_refresh_token');
        if (refreshToken) {
          try {
            const refRes = await fetch('/api/auth/admin/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            });
            if (refRes.ok) {
              const refData = await refRes.json();
              if (refData.accessToken) {
                localStorage.setItem('easydesk_admin_token', refData.accessToken);
                const meRes = await fetch('/api/auth/admin/me', {
                  headers: { 'Authorization': `Bearer ${refData.accessToken}` }
                });
                if (meRes.ok) {
                  const meData = await meRes.json();
                  if (meData && meData.user) {
                    setCurrentUser(meData.user);
                    localStorage.setItem('easydesk_admin_user', JSON.stringify(meData.user));
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // refresh error
          }
        }
        // Clean up invalid session
        localStorage.removeItem('easydesk_admin_token');
        localStorage.removeItem('easydesk_admin_user');
        localStorage.removeItem('easydesk_admin_refresh');
        localStorage.removeItem('easydesk_admin_refresh_token');
        setCurrentUser(null);
      })
      .catch(err => console.error('[Admin Session Verification Error]', err));
    }

    // Attach Firebase Auth SDK state listener for Admin session
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/firebase-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, expectedRole: 'ADMIN' })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user && (data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN')) {
              setCurrentUser(data.user);
              localStorage.setItem('easydesk_admin_token', data.accessToken);
              localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
            }
          }
        } catch (err) {
          console.error('[Firebase Auth Verify Listener Error]', err);
        }
      } else {
        const savedAdm = localStorage.getItem('easydesk_admin_user');
        if (!savedAdm) {
          setCurrentUser(null);
        }
      }
    });

    fetchPlatformCatalogs();

    return () => unsubscribe();
  }, []);

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans select-none antialiased">
        
        {!isOnline && (
          <div className="bg-amber-600 text-white text-[11px] font-semibold py-1.5 px-4 flex items-center justify-center gap-2 shadow-xs z-50 animate-in fade-in">
            <WifiOff className="w-3.5 h-3.5" />
            <span>You are currently offline. Displaying cached data. Reconnecting automatically when internet is available...</span>
          </div>
        )}

        {/* Universal header with navigation */}
        <Header 
          currentView={view} 
          setView={handleSetView} 
          currentUser={currentUser} 
          setCurrentUser={setCurrentUser} 
          allUsers={[]}
        />

        <main className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-xs text-slate-400 font-sans">
              <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
              <span>Establishing EasyDesk Digital Services...</span>
            </div>
          ) : (
            <Suspense fallback={<ViewLoadingFallback />}>
              {view === 'home' && (
                <HomeView 
                  services={services} 
                  blogs={blogs} 
                  blogCategories={blogCategories}
                  reviews={reviews} 
                  setView={handleSetView} 
                  setSelectedServiceId={handleSelectService} 
                />
              )}

              {view === 'services' && (
                <ServicesView 
                  categories={categories} 
                  services={services} 
                  setView={handleSetView} 
                  setSelectedServiceId={handleSelectService} 
                  selectedServiceId={selectedServiceId}
                />
              )}

              {view === 'service-details' && selectedServiceId && (
                <ServiceDetailsView
                  serviceId={selectedServiceId}
                  services={services}
                  categories={categories}
                  reviews={reviews}
                  setView={handleSetView}
                  setSelectedServiceId={handleSelectService}
                  onRefreshCatalogs={fetchPlatformCatalogs}
                />
              )}

              {view === 'track' && (
                <TrackingView />
              )}

              {view === 'admin-login' && (
                <div className="notranslate" translate="no">
                  <AuthPortal 
                    setView={handleSetView}
                    setCurrentUser={setCurrentUser}
                  />
                </div>
              )}

              {view === 'admin' && (
                <div className="notranslate" translate="no">
                  {currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'STAFF' || currentUser?.role === 'OPERATOR' ? (
                    <AdminDashboard onRefreshCatalogs={fetchPlatformCatalogs} />
                  ) : (
                    <AuthPortal 
                      setView={handleSetView}
                      setCurrentUser={setCurrentUser}
                    />
                  )}
                </div>
              )}

              {/* About Us View */}
              {view === 'about' && (
                <AboutUsView setView={handleSetView} />
              )}

              {/* Contact Us View */}
              {view === 'contact' && (
                <ContactView />
              )}

              {/* Privacy & Security View */}
              {view === 'privacy-security' && (
                <PrivacySecurityView setView={handleSetView} />
              )}

              {/* Payment Portal View */}
              {view === 'payment' && (
                <PaymentView currentUser={currentUser} setView={handleSetView} />
              )}

              {/* SEO Blogs list and detail view */}
              {view === 'blogs' && (
                <BlogsView blogs={blogs} blogCategories={blogCategories} updateBlogs={updateBlogs} />
              )}

              {/* Standalone Customer Review Submission Form */}
              {(view === 'submit-review' || view === 'review') && (
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                  <ReviewSubmissionForm
                    onSuccess={() => {
                      fetchPlatformCatalogs();
                    }}
                    onCancel={() => handleSetView('home')}
                  />
                </div>
              )}
            </Suspense>
          )}
        </main>

        {/* Universal Footer */}
        <Footer setView={handleSetView} />

        {/* Persistent AI Doc Auditor & Floating Chat Assistant widget on all screens */}
        <Suspense fallback={null}>
          <AIChatAssistant activeService={services.find(s => s.id === selectedServiceId) || null} />
        </Suspense>

      </div>
    </LanguageProvider>
  );
}
