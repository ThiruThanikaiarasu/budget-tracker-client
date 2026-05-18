import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/accounts', label: 'Accounts', icon: '🏦' },
  { to: '/transactions', label: 'Transactions', icon: '💳' },
  { to: '/friends', label: 'Friends', icon: '👥' },
  { to: '/investments', label: 'Investments', icon: '📈' },
];

function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium leading-tight transition-colors ${
                  isActive ? 'text-blue-700' : 'text-gray-500'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span className="w-full truncate text-center">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium leading-tight text-gray-500 transition-colors"
          >
            <span className="text-base">🚪</span>
            <span className="w-full truncate text-center">Logout</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default MainLayout;
