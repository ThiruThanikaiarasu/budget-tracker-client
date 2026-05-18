import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import useDashboardStore from '../store/dashboardStore';
import useAccountStore from '../store/accountStore';

const PIE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function Dashboard() {
  const {
    summary,
    breakdown,
    trend,
    recentTransactions,
    isLoading,
    fetchSummary,
    fetchCategoryBreakdown,
    fetchMonthlyTrend,
    fetchRecentTransactions,
  } = useDashboardStore();

  const { accounts, fetchAccounts } = useAccountStore();

  useEffect(() => {
    fetchSummary();
    fetchCategoryBreakdown();
    fetchMonthlyTrend();
    fetchRecentTransactions();
    fetchAccounts();
  }, [fetchSummary, fetchCategoryBreakdown, fetchMonthlyTrend, fetchRecentTransactions, fetchAccounts]);

  const totalBalance = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance, 0);

  if (isLoading && !summary) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Your financial overview</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link
            to="/transactions"
            state={{ openCreate: true, initialType: 'income' }}
            className="flex-1 whitespace-nowrap rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-green-700 sm:flex-none sm:px-4"
          >
            + Add Income
          </Link>
          <Link
            to="/transactions"
            state={{ openCreate: true, initialType: 'expense' }}
            className="flex-1 whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-red-700 sm:flex-none sm:px-4"
          >
            + Add Expense
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Balance */}
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Total Balance</p>
          <p className={`mt-1 text-2xl font-bold ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {accounts.filter((a) => a.isActive).length} active account{accounts.filter((a) => a.isActive).length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Income */}
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Income (This Month)</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(summary?.totalIncome ?? 0)}
          </p>
        </div>

        {/* Expense */}
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Expense (This Month)</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(summary?.totalExpense ?? 0)}
          </p>
        </div>

        {/* Net */}
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Net (This Month)</p>
          <p className={`mt-1 text-2xl font-bold ${(summary?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary?.net ?? 0)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown - Pie Chart */}
        <div className="rounded-lg bg-white p-5 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
          <p className="mb-4 text-sm text-gray-500">By category this month</p>
          {breakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No expense data for this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {breakdown.map((_entry, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Trend - Bar Chart */}
        <div className="rounded-lg bg-white p-5 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Trend</h2>
          <p className="mb-4 text-sm text-gray-500">Income vs Expense</p>
          {trend.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No trend data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend}>
                <XAxis dataKey="month" tickFormatter={formatMonth} />
                <YAxis tickFormatter={(v) => formatCurrency(Number(v))} width={90} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg bg-white p-5 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            View All
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No transactions yet</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100">
            {recentTransactions.map((tx) => (
              <div key={tx._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      tx.type === 'income'
                        ? 'bg-green-100 text-green-600'
                        : tx.type === 'expense'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '~'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tx.categoryId?.name ?? (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.note ? `${tx.note} · ` : ''}
                      {tx.accountId?.name}
                      {tx.toAccountId ? ` -> ${tx.toAccountId.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      tx.type === 'income'
                        ? 'text-green-600'
                        : tx.type === 'expense'
                          ? 'text-red-600'
                          : 'text-blue-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
