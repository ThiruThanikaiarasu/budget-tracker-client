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
import useBudgetStore from '../store/budgetStore';
import useThemeStore from '../store/themeStore';
import { renderCategoryIcon } from '../utils/categoryIcons';

const PIE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];
const CRED_PIE_COLORS = ['#0a0a0a', '#343438', '#5d5d63', '#85858c', '#adadb3', '#d4d4d8'];

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
  const isCredWhite = useThemeStore((s) => s.theme === 'cred-white');
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
  const { todaySummary, fetchTodaySummary } = useBudgetStore();

  useEffect(() => {
    fetchSummary();
    fetchCategoryBreakdown();
    fetchMonthlyTrend();
    fetchRecentTransactions();
    fetchAccounts();
    fetchTodaySummary();
  }, [fetchSummary, fetchCategoryBreakdown, fetchMonthlyTrend, fetchRecentTransactions, fetchAccounts, fetchTodaySummary]);

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
    <div className="analysis-page space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="analysis-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            className="analysis-add-expense flex-1 whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-red-700 sm:flex-none sm:px-4"
          >
            + Add Expense
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analysis-summary grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Balance */}
        <div className="analysis-summary-card rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Total Balance</p>
          <p className={`mt-1 text-2xl font-bold ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {accounts.filter((a) => a.isActive).length} active account{accounts.filter((a) => a.isActive).length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Income */}
        <div className="analysis-summary-card rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Income (This Month)</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(summary?.totalIncome ?? 0)}
          </p>
        </div>

        {/* Expense */}
        <div className="analysis-summary-card rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Expense (This Month)</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(summary?.totalExpense ?? 0)}
          </p>
        </div>

        {/* Net */}
        <div className="analysis-summary-card rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Net (This Month)</p>
          <p className={`mt-1 text-2xl font-bold ${(summary?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary?.net ?? 0)}
          </p>
        </div>
      </div>

      {/* Budget Alert */}
      {todaySummary && (
        <div className={`analysis-budget-status rounded-lg p-4 shadow ${todaySummary.isOver ? 'is-over bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className={`text-sm font-semibold ${todaySummary.isOver ? 'text-red-800' : 'text-green-800'}`}>
                {todaySummary.isOver ? 'You\'ve exceeded today\'s budget!' : 'Today\'s Budget Status'}
              </h3>
              <p className={`mt-1 text-sm ${todaySummary.isOver ? 'text-red-700' : 'text-green-700'}`}>
                Spent {formatCurrency(todaySummary.spent)}
                {todaySummary.dailyLimit && ` of ${formatCurrency(todaySummary.dailyLimit)} daily limit`}
              </p>
              {todaySummary.isOver && (
                <p className="mt-2 text-sm font-medium text-red-800">
                  Think before you spend.
                </p>
              )}
            </div>
            <Link
              to="/budget"
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View Budget &rarr;
            </Link>
          </div>
          {todaySummary.categoryStatus.length > 0 && todaySummary.categoryStatus.some((c) => c.isOver) && (
            <div className="mt-3 border-t border-red-200 pt-3">
              <p className="text-xs font-medium text-red-700">Categories over limit:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {todaySummary.categoryStatus
                  .filter((c) => c.isOver)
                  .map((c) => (
                    <span
                      key={c.categoryId._id}
                      className="analysis-over-category inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                    >
                      {isCredWhite && <span className="analysis-category-icon">{renderCategoryIcon(c.categoryId.icon, c.categoryId.name, 16)}</span>}
                      {!isCredWhite && c.categoryId.icon} {c.categoryId.name}: {formatCurrency(c.spent)} / {formatCurrency(c.effectiveLimit)}
                      {' '}({c.frequency})
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="analysis-charts grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown - Pie Chart */}
        <div className="analysis-panel rounded-lg bg-white p-5 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
          <p className="mb-4 text-sm text-gray-500">By category this month</p>
          {breakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No expense data for this month</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={isCredWhite ? 220 : 300}>
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={isCredWhite ? 48 : 60}
                    outerRadius={isCredWhite ? 82 : 100}
                    paddingAngle={2}
                  >
                    {breakdown.map((_entry, index) => (
                      <Cell key={index} fill={(isCredWhite ? CRED_PIE_COLORS : PIE_COLORS)[index % (isCredWhite ? CRED_PIE_COLORS : PIE_COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  {!isCredWhite && <Legend />}
                </PieChart>
              </ResponsiveContainer>
              {isCredWhite && (
                <div className="analysis-chart-legend">
                  {breakdown.map((entry, index) => (
                    <div key={entry.categoryId} className="analysis-chart-legend-item">
                      <span style={{ background: CRED_PIE_COLORS[index % CRED_PIE_COLORS.length] }} />
                      <span title={entry.categoryName}>{entry.categoryName}</span>
                      <strong>{formatCurrency(entry.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Monthly Trend - Bar Chart */}
        <div className="analysis-panel rounded-lg bg-white p-5 shadow">
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
                <Bar dataKey="income" name="Income" fill={isCredWhite ? '#0a0a0a' : '#10B981'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill={isCredWhite ? '#a1a1aa' : '#EF4444'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="analysis-panel analysis-recent rounded-lg bg-white p-5 shadow">
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
              <div key={tx._id} className="analysis-transaction flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {isCredWhite && tx.categoryId ? (
                    <span className="analysis-category-icon">
                      {renderCategoryIcon(tx.categoryId.icon, tx.categoryId.name, 32)}
                    </span>
                  ) : <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      tx.type === 'income'
                        ? 'bg-green-100 text-green-600'
                        : tx.type === 'expense'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '~'}
                  </span>}
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
