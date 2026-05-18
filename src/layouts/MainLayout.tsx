import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const navItems = [
  { to: '/transactions', label: 'Transactions', icon: '💳' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/accounts', label: 'Accounts', icon: '🏦' },
  { to: '/budget', label: 'Budget', icon: '🎯' },
  { to: '/friends', label: 'Friends', icon: '👥' },
  { to: '/investments', label: 'Investments', icon: '📈' },
];

const mobileMainNav = navItems.slice(0, 4);
const mobileOverflowNav = navItems.slice(4);

function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);

  const isOverflowActive = mobileOverflowNav.some((item) => location.pathname === item.to);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">Budget Tracker</h1>
          {user && (
            <p className="mt-1 text-sm text-gray-500 truncate">{user.name}</p>
          )}
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* Bottom Nav - Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-10 flex md:hidden bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
          {mobileMainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium leading-tight transition-colors ${
                  isActive ? 'text-blue-700' : 'text-gray-500'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span className="w-full truncate text-center">{item.label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <div ref={moreRef} className="relative flex min-w-0 flex-1">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium leading-tight transition-colors ${
                isOverflowActive || moreOpen ? 'text-blue-700' : 'text-gray-500'
              }`}
            >
              <span className="text-base">•••</span>
              <span>More</span>
            </button>

            {/* Popover */}
            {moreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5">
                {mobileOverflowNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`
                    }
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default MainLayout;
