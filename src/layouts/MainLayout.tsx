import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

// ── SVG icon paths ────────────────────────────────────────────────────
const Icons = {
  records: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  analysis: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  budgets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2" />
      <circle cx="17" cy="14" r="1.5" fill="currentColor" />
    </svg>
  ),
  categories: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
    </svg>
  ),
  friends: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  investments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  watchlist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  hamburger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ── Bottom nav (mobile): exactly 5 tabs ───────────────────────────────
const BOTTOM_NAV = [
  { to: '/dashboard', label: 'Analysis', icon: Icons.analysis },
  { to: '/budget', label: 'Budgets', icon: Icons.budgets },
  { to: '/transactions', label: 'Records', icon: Icons.records },
  { to: '/accounts', label: 'Accounts', icon: Icons.accounts },
  { to: '/categories', label: 'Categories', icon: Icons.categories },
];

// ── Sidebar nav (desktop): all pages ─────────────────────────────────
const SIDEBAR_NAV = [
  { to: '/transactions', label: 'Records', icon: Icons.records },
  { to: '/dashboard', label: 'Analysis', icon: Icons.analysis },
  { to: '/budget', label: 'Budgets', icon: Icons.budgets },
  { to: '/accounts', label: 'Accounts', icon: Icons.accounts },
  { to: '/categories', label: 'Categories', icon: Icons.categories },
  { to: '/friends', label: 'Friends', icon: Icons.friends },
  { to: '/investments', label: 'Investments', icon: Icons.investments },
  { to: '/watchlist', label: 'Watchlist', icon: Icons.watchlist },
  { to: '/personalization', label: 'Settings', icon: Icons.settings },
];

// ── Drawer nav: all pages (shown in mobile drawer) ────────────────────
const DRAWER_NAV = SIDEBAR_NAV;

function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className="main-layout flex h-screen"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className="hidden md:flex md:flex-col md:w-60 flex-shrink-0"
        style={{
          background: 'var(--c-nav-bg)',
          borderRight: '1px solid var(--c-border)',
        }}
      >
        {/* Brand */}
        <div className="px-5 py-6">
          <h1 className="cred-serif text-lg font-bold" style={{ color: 'var(--c-accent)' }}>
            Budget Tracker
          </h1>
          {user && (
            <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--c-muted)' }}>
              {user.name}
            </p>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {SIDEBAR_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `desktop-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'is-active font-semibold' : ''
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? 'var(--c-accent)' : 'var(--c-muted)',
                backgroundColor: 'transparent',
              })}
            >
              <span className="nav-icon-shell">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3" style={{ borderTop: '1px solid var(--c-border)' }}>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--c-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--c-surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {Icons.logout}
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">

        {/* ── Mobile top header ──────────────────────────────────────── */}
        <header
          className={`app-mobile-header ${location.pathname === '/transactions' ? 'transactions-route-header' : ''} md:hidden flex items-center justify-between px-4 h-14 flex-shrink-0 z-10`}
          style={{ background: 'var(--c-header-bg)', borderBottom: '1px solid var(--c-border)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg"
            style={{ color: 'var(--c-text)' }}
          >
            {Icons.hamburger}
          </button>

          <span className="cred-serif text-base font-bold" style={{ color: 'var(--c-accent)' }}>
            Budget Tracker
          </span>

          <button
            onClick={() => navigate('/transactions')}
            className="p-1.5 -mr-1.5 rounded-lg"
            style={{ color: 'var(--c-text)' }}
          >
            {Icons.search}
          </button>
        </header>

        <main
          className="flex-1 overflow-y-auto min-h-0"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
        >
          <Outlet />
        </main>

        {/* ── Mobile bottom nav ────────────────────────────────────── */}
        <nav
          className="mobile-bottom-nav fixed bottom-0 left-0 right-0 md:hidden flex z-20"
          style={{
            background: 'var(--c-nav-bg)',
            borderTop: '1px solid var(--c-nav-border)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {BOTTOM_NAV.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to === '/transactions' && location.pathname === '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`mobile-nav-link ${item.to === '/transactions' ? 'mobile-nav-primary' : ''} ${isActive ? 'is-active' : ''} flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-w-0`}
                style={{ color: isActive ? 'var(--c-active)' : 'var(--c-muted)' }}
              >
                <span className="nav-icon-shell">{item.icon}</span>
                <span className="text-[9px] font-medium leading-tight truncate w-full text-center">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <div
            className="fixed top-0 left-0 bottom-0 z-40 flex flex-col w-72 md:hidden"
            style={{ background: 'var(--c-nav-bg)' }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 h-14 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--c-border)' }}
            >
              <div>
                <p className="cred-serif text-base font-bold" style={{ color: 'var(--c-accent)' }}>
                  Budget Tracker
                </p>
                {user && (
                  <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>
                    {user.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--c-muted)' }}
              >
                {Icons.close}
              </button>
            </div>

            {/* Drawer nav links */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {DRAWER_NAV.map((item) => {
                const isActive = location.pathname === item.to ||
                  (item.to === '/transactions' && location.pathname === '/');
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`drawer-nav-link ${isActive ? 'is-active' : ''} flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium`}
                    style={{
                      color: isActive ? 'var(--c-active)' : 'var(--c-muted)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <span className="nav-icon-shell">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="p-3" style={{ borderTop: '1px solid var(--c-border)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => { setDrawerOpen(false); handleLogout(); }}
                className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
                style={{ color: 'var(--c-muted)' }}
              >
                {Icons.logout}
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MainLayout;
