import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Building2, Bitcoin, Gift, 
  Calendar, ArrowUpRight, ArrowDownLeft, Plus, Bus, ArrowRightLeft,
  GripHorizontal, Eye, EyeOff, PieChart
} from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { Account, Transaction, IncomeSource, ExpectedIncome, PlannedExpense } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';

interface DashboardProps {
  householdId?: string;
  accounts: Account[];
  transactions: Transaction[];
  categories: Account[];
  incomeSources: IncomeSource[];
  expectedIncomes: ExpectedIncome[];
  plannedExpenses: PlannedExpense[];
  assetPrices?: Record<string, { price: number; currency: string }>;
  members?: Record<string, any>;
  onAddIncome: () => void;
  onAddTransaction: () => void;
  onCryptoTransfer: () => void;
  onAkbilLoad: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  householdId,
  accounts: allAccounts,
  transactions: allTransactions,
  categories,
  incomeSources: allIncomeSources,
  expectedIncomes: allExpectedIncomes,
  plannedExpenses: allPlannedExpenses,
  assetPrices = {},
  members,
  onAddIncome,
  onAddTransaction,
  onCryptoTransfer,
  onAkbilLoad
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');

  const accounts = useMemo(() => 
    selectedMemberId === 'all' ? allAccounts : allAccounts.filter(a => a.ownerId === selectedMemberId),
    [allAccounts, selectedMemberId]
  );

  const transactions = useMemo(() => 
    selectedMemberId === 'all' ? allTransactions : allTransactions.filter(t => t.userId === selectedMemberId),
    [allTransactions, selectedMemberId]
  );

  const incomeSources = useMemo(() => 
    selectedMemberId === 'all' ? allIncomeSources : allIncomeSources.filter(s => s.ownerId === selectedMemberId),
    [allIncomeSources, selectedMemberId]
  );

  const expectedIncomes = useMemo(() => 
    selectedMemberId === 'all' ? allExpectedIncomes : allExpectedIncomes.filter(i => i.ownerId === selectedMemberId),
    [allExpectedIncomes, selectedMemberId]
  );

  const plannedExpenses = useMemo(() => 
    selectedMemberId === 'all' ? allPlannedExpenses : allPlannedExpenses.filter(e => e.ownerId === selectedMemberId),
    [allPlannedExpenses, selectedMemberId]
  );

  const defaultLayout = [
    { id: 'master_widget', visible: true },
    { id: 'quick_actions', visible: true },
    { id: 'branch_distribution', visible: true },
    { id: 'cash_flow_radar', visible: true },
    { id: 'payment_calendar', visible: true },
  ];

  const [layout, setLayout] = useState(defaultLayout);
  const { formatWithEquivalent, convertToTRY } = useExchangeRates();

  // Calculations
  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => {
    let balance = a.balance;
    if (a.assetDetails && assetPrices[a.assetDetails.symbol]) {
      balance = a.assetDetails.quantity * assetPrices[a.assetDetails.symbol].price;
    }
    return sum + convertToTRY(balance, a.currency || 'TRY');
  }, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + convertToTRY(a.balance, a.currency || 'TRY'), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Mock previous month net worth for change percentage (in a real app, calculate from historical data)
  const prevNetWorth = netWorth * 0.95; // 5% increase mock
  const netWorthChange = prevNetWorth ? ((netWorth - prevNetWorth) / prevNetWorth) * 100 : 0;

  // Branch distribution
  const getBalanceWithPrice = (a: Account) => {
    let balance = a.balance;
    if (a.assetDetails && assetPrices[a.assetDetails.symbol]) {
      balance = a.assetDetails.quantity * assetPrices[a.assetDetails.symbol].price;
    }
    return convertToTRY(balance, a.currency || 'TRY');
  };

  const bankBalance = accounts.filter(a => a.branch === 'banking' && a.type === 'asset').reduce((sum, a) => sum + getBalanceWithPrice(a), 0);
  const cryptoBalance = accounts.filter(a => a.branch === 'crypto' && a.type === 'asset').reduce((sum, a) => sum + getBalanceWithPrice(a), 0);
  const socialBalance = accounts.filter(a => a.branch === 'social_gift' && a.type === 'asset').reduce((sum, a) => sum + getBalanceWithPrice(a), 0);

  // Cash flow radar (Current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTxs = transactions.filter(t => {
    const d = t.date.toDate();
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = currentMonthTxs
    .filter(t => accounts.find(a => a.id === t.debitAccountId) && !accounts.find(a => a.id === t.creditAccountId))
    .reduce((sum, t) => sum + convertToTRY(t.amount, t.currency || 'TRY'), 0);

  const totalExpense = currentMonthTxs
    .filter(t => !accounts.find(a => a.id === t.debitAccountId) && accounts.find(a => a.id === t.creditAccountId))
    .reduce((sum, t) => sum + convertToTRY(t.amount, t.currency || 'TRY'), 0);

  const remainingBudget = totalIncome - totalExpense; // Simplified

  // Payment Calendar Logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getPaymentStatusColor = (date: Date, status: string) => {
    if (status === 'paid' || status === 'realized') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-rose-500/10 text-rose-500 border-rose-500/20'; // Overdue
    if (diffDays === 0) return 'bg-orange-500/10 text-orange-500 border-orange-500/20'; // Today
    if (diffDays <= 3) return 'bg-amber-500/10 text-amber-500 border-amber-500/20'; // Upcoming
    return 'bg-zinc-800 text-zinc-200 border-zinc-700'; // Future
  };

  const getPaymentStatusLabel = (date: Date, status: string) => {
    if (status === 'paid' || status === 'realized') return 'Tamamlandı';
    
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} gün gecikti`;
    if (diffDays === 0) return 'Bugün';
    if (diffDays <= 3) return `${diffDays} gün kaldı`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Combine expected incomes, planned expenses, and future installments for the calendar
  const calendarItems = useMemo(() => {
    const items = [
      ...expectedIncomes.map(inc => ({
        id: inc.id,
        title: inc.sourceName,
        amount: inc.amount,
        currency: inc.currency || 'TRY',
        date: inc.expectedDate.toDate(),
        status: inc.status,
        type: 'income' as const
      })),
      ...plannedExpenses.map(exp => ({
        id: exp.id,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency || 'TRY',
        date: exp.dueDate.toDate(),
        status: exp.status,
        type: 'expense' as const
      })),
      ...transactions.filter(t => t.isInstallment && t.date.toDate() > today).map(t => ({
        id: t.id,
        title: `${t.description} (${t.installmentNumber}/${t.installmentCount})`,
        amount: t.amount,
        currency: t.currency || 'TRY',
        date: t.date.toDate(),
        status: 'pending',
        type: 'expense' as const
      }))
    ];

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [expectedIncomes, plannedExpenses, transactions, today]);

  const toggleModuleVisibility = (id: string) => {
    setLayout(layout.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  };

  const renderModule = (id: string) => {
    switch (id) {
      case 'master_widget':
        return (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-zinc-200">
                <Wallet className="w-5 h-5" />
                <span className="font-medium">Toplam Varlık Özeti</span>
              </div>
              <GripHorizontal className="w-5 h-5 text-zinc-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-end gap-4">
              <h2 className="text-4xl font-bold text-white">
                {formatWithEquivalent(netWorth, 'TRY')}
              </h2>
              <div className={`flex items-center gap-1 text-sm font-bold mb-1 ${netWorthChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netWorthChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(netWorthChange).toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-zinc-200 mt-2">Geçen aya göre değişim</p>
          </div>
        );

      case 'branch_distribution':
        return (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-zinc-200">
                <PieChart className="w-5 h-5" />
                <span className="font-medium">Dal Bazlı Varlık Dağılımı</span>
              </div>
              <GripHorizontal className="w-5 h-5 text-zinc-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex flex-col p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors text-left">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span className="font-bold text-sm">Bankalar</span>
                </div>
                <span className="text-xl font-bold text-white">{formatWithEquivalent(bankBalance, 'TRY')}</span>
              </button>
              <button className="flex flex-col p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors text-left">
                <div className="flex items-center gap-2 text-orange-500 mb-2">
                  <Bitcoin className="w-4 h-4" />
                  <span className="font-bold text-sm">Kripto</span>
                </div>
                <span className="text-xl font-bold text-white">{formatWithEquivalent(cryptoBalance, 'TRY')}</span>
              </button>
              <button className="flex flex-col p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 hover:bg-purple-500/10 transition-colors text-left">
                <div className="flex items-center gap-2 text-purple-500 mb-2">
                  <Gift className="w-4 h-4" />
                  <span className="font-bold text-sm">Sosyal/Hediye</span>
                </div>
                <span className="text-xl font-bold text-white">{formatWithEquivalent(socialBalance, 'TRY')}</span>
              </button>
            </div>
          </div>
        );

      case 'payment_calendar':
        return (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-zinc-200">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Dinamik Ödeme Takvimi</span>
              </div>
              <GripHorizontal className="w-5 h-5 text-zinc-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-3">
              {calendarItems.length > 0 ? calendarItems.map(item => {
                const colorClass = getPaymentStatusColor(item.date, item.status);
                const label = getPaymentStatusLabel(item.date, item.status);
                return (
                  <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border ${colorClass} bg-opacity-10`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${colorClass.split(' ')[1].replace('text-', 'bg-')}`} />
                      <div>
                        <p className="font-bold text-sm">{item.title}</p>
                        <p className="text-xs opacity-90">{label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {item.type === 'income' ? '+' : '-'}
                        {formatWithEquivalent(item.amount, item.currency)}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-zinc-200 text-sm text-center py-4">Yaklaşan ödeme veya gelir bulunmuyor.</p>
              )}
            </div>
          </div>
        );

      case 'cash_flow_radar':
        return (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-zinc-200">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Nakit Akış Radarı (Bu Ay)</span>
              </div>
              <GripHorizontal className="w-5 h-5 text-zinc-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-200">Toplam Girdi</span>
                  <span className="text-emerald-500 font-bold">{formatWithEquivalent(totalIncome, 'TRY')}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-200">Toplam Gider</span>
                  <span className="text-rose-500 font-bold">{formatWithEquivalent(totalExpense, 'TRY')}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-rose-500 h-2 rounded-full" style={{ width: totalIncome > 0 ? `${Math.min((totalExpense / totalIncome) * 100, 100)}%` : '0%' }}></div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className="text-sm text-zinc-200">
                  Bu ay harcayabileceğin <span className="text-white font-bold">{formatWithEquivalent(Math.max(remainingBudget, 0), 'TRY')}</span> daha var.
                </p>
              </div>
            </div>
          </div>
        );

      case 'quick_actions':
        return (
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 relative group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-zinc-200">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Hızlı İşlemler</span>
              </div>
              <GripHorizontal className="w-5 h-5 text-zinc-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={onAddIncome} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all gap-2">
                <Plus className="w-6 h-6" />
                <span className="text-xs font-bold">Gelir Ekle</span>
              </button>
              <button onClick={onAkbilLoad} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all gap-2">
                <Bus className="w-6 h-6" />
                <span className="text-xs font-bold">Akbil Yükle</span>
              </button>
              <button onClick={onCryptoTransfer} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all gap-2">
                <ArrowRightLeft className="w-6 h-6" />
                <span className="text-xs font-bold">Kripto Transfer</span>
              </button>
              <button onClick={onAddTransaction} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-all gap-2">
                <ArrowUpRight className="w-6 h-6" />
                <span className="text-xs font-bold">Gider Ekle</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-white">Ana Ekran</h1>
        
        {/* Member Filter */}
        {members && Object.keys(members).length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setSelectedMemberId('all')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                selectedMemberId === 'all'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-white/5'
              }`}
            >
              Tüm Hane
            </button>
            {Object.entries(members).map(([id, member]) => (
              <button
                key={id}
                onClick={() => setSelectedMemberId(id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedMemberId === id
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-white/5'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${member.type === 'child' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                {member.displayName}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {layout.map(item => (
            <button
              key={`toggle-${item.id}`}
              onClick={() => toggleModuleVisibility(item.id)}
              className={`p-2 rounded-lg border transition-colors ${item.visible ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}
              title={`${item.id} modülünü ${item.visible ? 'gizle' : 'göster'}`}
            >
              {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>

      <Reorder.Group axis="y" values={layout} onReorder={setLayout} className="space-y-6">
        {layout.filter(item => item.visible).map(item => (
          <Reorder.Item key={item.id} value={item}>
            {renderModule(item.id)}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
};
