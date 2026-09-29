import { NavLink, Outlet } from 'react-router-dom';

const SUB_NAV = [
  { to: '/investment', label: 'Portfolio', end: true },
  { to: '/investment/watchlist', label: 'Watchlist', end: false },
  { to: '/investment/wishlist', label: 'Wishlist', end: false },
];

function InvestmentLayout() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <nav
        className="flex gap-1 px-4 sm:px-6 pt-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        {SUB_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                isActive ? 'font-semibold' : ''
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--c-accent)' : 'var(--c-muted)',
              borderBottom: isActive ? '2px solid var(--c-accent)' : '2px solid transparent',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

export default InvestmentLayout;
