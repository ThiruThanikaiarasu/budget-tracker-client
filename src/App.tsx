import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useThemeStore from './store/themeStore';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Friends from './pages/Friends';
import PortfolioOverview from './pages/investments/PortfolioOverview';
import AssetClassesPage from './pages/investments/AssetClassesPage';
import StocksPage from './pages/investments/StocksPage';
import WatchlistPage from './pages/watchlist/WatchlistPage';
import StockDetailPage from './pages/stocks/StockDetailPage';
import Categories from './pages/Categories';
import Personalization from './pages/Personalization';
import Budget from './pages/Budget';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';

function ThemeSync() {
  const { theme } = useThemeStore();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/investments" element={<PortfolioOverview />} />
            <Route path="/investments/assets" element={<AssetClassesPage />} />
            <Route path="/investments/stocks" element={<StocksPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/stocks/:symbol" element={<StockDetailPage />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/personalization" element={<Personalization />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/transactions" replace />} />
      </Routes>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-border)',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
