import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Building2, Bitcoin, Gift, 
  Calendar, ArrowUpRight, ArrowDownLeft, Plus, Bus, ArrowRightLeft,
  GripHorizontal, Eye, EyeOff, PieChart, X
} from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { Account, Transaction, IncomeSource, ExpectedIncome, PlannedExpense } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { MarketDataWidget } from './MarketDataWidget';

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
  isPrivacyMode?: boolean;
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
  isPrivacyMode = false,
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
    { id: 'market_data', visible: true },
    { id: 'credit_cards', visible: true },
    { id: 'quick_actions', visible: true },
    { id: 'branch_distribution', visible: true },
    { id: 'cash_flow_radar', visible: true },
    { id: 'payment_calendar', visible: true },
  ];

  const [layout, setLayout] = useState(defaultLayout);
  const [toggledPrivacy, setToggledPrivacy] = useState<Set<string>>(new Set());
  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);

  const toggleLocalPrivacy = (id: string) => {
    setToggledPrivacy(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isItemHidden = (id: string) => {
    return isPrivacyMode ? !toggledPrivacy.has(id) : toggledPrivacy.has(id);
  };

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

  const creditCardAccounts = useMemo(() => 
    accounts.filter(a => a.subType === 'credit_card'),
    [accounts]
  );

  const totalCreditCardDebt = useMemo(() => 
    creditCardAccounts.reduce((sum, a) => sum + convertToTRY(a.balance, a.currency || 'TRY'), 0),
    [creditCardAccounts, convertToTRY]
  );

  const totalCreditLimit = useMemo(() => 
    creditCardAccounts.reduce((sum, a) => sum + convertToTRY(a.creditLimit || 0, a.currency || 'TRY'), 0),
    [creditCardAccounts, convertToTRY]
  );

  // Cash flow radar (Current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTxs = transactions.filter(t => {
    const d = t.date;
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
    
    const diffTime = new Date(date).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'bg-rose-500/10 text-rose-500 border-rose-500/20'; // Overdue
    if (diffDays === 0) return 'bg-orange-500/10 text-orange-500 border-orange-500/20'; // Today
    if (diffDays <= 3) return 'bg-amber-500/10 text-amber-500 border-amber-500/20'; // Upcoming
    return 'bg-zinc-800 text-zinc-200 border-zinc-700'; // Future
  };

  const getPaymentStatusLabel = (date: Date, status: string) => {
    if (status === 'paid' || status === 'realized') return 'Tamamlandı';
    
    const diffTime = new Date(date).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} gün gecikti`;
    if (diffDays === 0) return 'Bugün';
    if (diffDays <= 3) return `${diffDays} gün kaldı`;
    return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Combine expected incomes, planned expenses, and future installments for the calendar
  const calendarItems = useMemo(() => {
    const items = [
      ...expectedIncomes.map(inc => ({
        id: inc.id,
        title: inc.sourceName,
        amount: inc.amount,
        currency: inc.currency || 'TRY',
        date: inc.expectedDate,
        status: inc.status,
        type: 'income' as const
      })),
      ...plannedExpenses.map(exp => ({
        id: exp.id,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency || 'TRY',
        date: exp.dueDate,
        status: exp.status,
        type: 'expense' as const
      })),
      ...transactions.filter(t => t.isInstallment && t.date > today).map(t => ({
        id: t.id,
        title: `${t.description} (${t.installmentNumber}/${t.installmentCount})`,
        amount: t.amount,
        currency: t.currency || 'TRY',
        date: t.date,
        status: 'pending',
        type: 'expense' as const
      }))
    ];

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [expectedIncomes, plannedExpenses, transactions, today]);

  const toggleModuleVisibility = (id: string) => {
    setLayout(layout.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  };

  const renderModule = (id: string) => {
    const isVisible = layout.find(i => i.id === id)?.visible;
    if (!isVisible) return null;

    const moduleHeader = (title: string, icon: React.ReactNode) => (
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="font-semibold uppercase tracking-wider text-xs">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleLocalPrivacy(id);
            }}
            className={`p-1.5 border border-border/50 rounded-lg transition-all ${
              isItemHidden(id)
                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                : 'text-muted-foreground/50 hover:text-foreground hover:bg-zinc-800'
            }`}
            title={isItemHidden(id) ? 'Göster' : 'Gizle'}
          >
            {isItemHidden(id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleModuleVisibility(id);
            }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-muted-foreground/50 hover:text-foreground transition-all"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
          <GripHorizontal className="w-5 h-5 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );

    switch (id) {
      case 'master_widget':
        return (
          <div className="corporate-card p-8 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            {moduleHeader('Toplam Varlık Özeti', <Wallet className="w-5 h-5" />)}
            <div className="flex items-end gap-4 relative z-10">
              <h2 className="text-5xl font-bold tracking-tight text-foreground">
                {formatWithEquivalent(netWorth, 'TRY', isItemHidden('master_widget'))}
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold mb-1.5 ${netWorthChange >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                {netWorthChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(netWorthChange).toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-medium">Geçen aya göre finansal performans değişimi</p>
          </div>
        );

      case 'market_data':
        return (
          <div className="relative group">
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLocalPrivacy(id);
                }}
                className={`p-1.5 border border-border/50 rounded-lg transition-all ${
                  isItemHidden(id)
                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                    : 'bg-zinc-900/80 backdrop-blur-sm text-muted-foreground/50 hover:text-foreground hover:bg-zinc-800'
                }`}
                title={isItemHidden(id) ? 'Göster' : 'Gizle'}
              >
                {isItemHidden(id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleModuleVisibility(id);
                }}
                className="p-1.5 bg-zinc-900/80 backdrop-blur-sm border border-border/50 hover:bg-zinc-800 rounded-lg text-muted-foreground/50 hover:text-foreground transition-all"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
              <GripHorizontal className="w-5 h-5 text-muted-foreground/30 cursor-grab" />
            </div>
            <MarketDataWidget />
          </div>
        );

      case 'credit_cards':
        if (creditCardAccounts.length === 0) return null;
        return (
          <div className="corporate-card p-8 relative group">
            {moduleHeader('Kredi Kartları Özeti', <Wallet className="w-5 h-5" />)}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Toplam Borç</p>
                <p className="text-2xl font-bold text-rose-500">{formatWithEquivalent(totalCreditCardDebt, 'TRY', isItemHidden('credit_cards'))}</p>
              </div>
              <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Toplam Limit</p>
                <p className="text-2xl font-bold text-foreground">{formatWithEquivalent(totalCreditLimit, 'TRY', isItemHidden('credit_cards'))}</p>
              </div>
              <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Kullanılabilir Limit</p>
                <p className="text-2xl font-bold text-emerald-500">{formatWithEquivalent(totalCreditLimit - totalCreditCardDebt, 'TRY', isItemHidden('credit_cards'))}</p>
              </div>
              <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Limit Doluluk</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-foreground">
                    {totalCreditLimit > 0 ? ((totalCreditCardDebt / totalCreditLimit) * 100).toFixed(1) : 0}%
                  </p>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full mb-2 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full" 
                      style={{ width: `${Math.min((totalCreditCardDebt / (totalCreditLimit || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {creditCardAccounts.map(acc => (
                <div key={acc.id} className="p-4 rounded-2xl bg-zinc-950/30 border border-border flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-foreground">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Kesim Günü: {acc.statementDay}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-500">{formatWithEquivalent(acc.balance, acc.currency || 'TRY', isItemHidden('credit_cards'))}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Asgari: {formatWithEquivalent(acc.balance * ((acc.creditLimit || 0) >= 25000 ? 0.4 : 0.2), acc.currency || 'TRY', isItemHidden('credit_cards'))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'branch_distribution':
        return (
          <div className="corporate-card p-8 relative group">
            {moduleHeader('Varlık Dağılımı', <PieChart className="w-5 h-5" />)}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button className="flex flex-col p-6 rounded-2xl bg-secondary/50 border border-border hover:border-primary/30 transition-all text-left group/item">
                <div className="flex items-center gap-2 text-blue-500 mb-3">
                  <Building2 className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Bankalar</span>
                </div>
                <span className="text-2xl font-bold text-foreground group-hover/item:text-primary transition-colors">{formatWithEquivalent(bankBalance, 'TRY', isItemHidden('branch_distribution'))}</span>
              </button>
              <button className="flex flex-col p-6 rounded-2xl bg-secondary/50 border border-border hover:border-primary/30 transition-all text-left group/item">
                <div className="flex items-center gap-2 text-orange-500 mb-3">
                  <Bitcoin className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Kripto</span>
                </div>
                <span className="text-2xl font-bold text-foreground group-hover/item:text-primary transition-colors">{formatWithEquivalent(cryptoBalance, 'TRY', isItemHidden('branch_distribution'))}</span>
              </button>
              <button className="flex flex-col p-6 rounded-2xl bg-secondary/50 border border-border hover:border-primary/30 transition-all text-left group/item">
                <div className="flex items-center gap-2 text-purple-500 mb-3">
                  <Gift className="w-5 h-5" />
                  <span className="font-bold text-xs uppercase tracking-wide">Sosyal/Hediye</span>
                </div>
                <span className="text-2xl font-bold text-foreground group-hover/item:text-primary transition-colors">{formatWithEquivalent(socialBalance, 'TRY', isItemHidden('branch_distribution'))}</span>
              </button>
            </div>
          </div>
        );

      case 'payment_calendar':
        return (
          <div className="corporate-card p-8 relative group">
            {moduleHeader('Ödeme Takvimi', <Calendar className="w-5 h-5" />)}
            <div className="space-y-3">
              {calendarItems.length > 0 ? calendarItems.map(item => {
                const colorClass = getPaymentStatusColor(item.date, item.status);
                const label = getPaymentStatusLabel(item.date, item.status);
                return (
                  <div key={item.id} className={`flex items-center justify-between p-5 rounded-2xl border ${colorClass} bg-opacity-5 transition-all hover:bg-opacity-10`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${colorClass.split(' ')[1].replace('text-', 'bg-')} shadow-sm`} />
                      <div>
                        <p className="font-bold text-sm text-foreground">{item.title}</p>
                        <p className="text-xs font-medium opacity-80">{label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.type === 'income' ? 'text-emerald-500' : 'text-foreground'}`}>
                        {item.type === 'income' ? '+' : '-'}
                        {formatWithEquivalent(item.amount, item.currency, isItemHidden('payment_calendar'))}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-12 bg-secondary/30 rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground text-sm font-medium">Yaklaşan ödeme veya gelir bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'cash_flow_radar':
        return (
          <div className="corporate-card p-8 relative group">
            {moduleHeader('Nakit Akış Radarı (Bu Ay)', <TrendingUp className="w-5 h-5" />)}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground font-medium">Toplam Girdi</span>
                  <span className="text-emerald-500 font-bold">{formatWithEquivalent(totalIncome, 'TRY', isItemHidden('cash_flow_radar'))}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    className="bg-emerald-500 h-full rounded-full" 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground font-medium">Toplam Gider</span>
                  <span className="text-destructive font-bold">{formatWithEquivalent(totalExpense, 'TRY', isItemHidden('cash_flow_radar'))}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: totalIncome > 0 ? `${Math.min((totalExpense / totalIncome) * 100, 100)}%` : '0%' }}
                    className="bg-destructive h-full rounded-full" 
                  />
                </div>
              </div>
              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground font-medium">
                  Bu ay harcayabileceğin <span className="text-foreground font-bold">{formatWithEquivalent(Math.max(remainingBudget, 0), 'TRY', isItemHidden('cash_flow_radar'))}</span> daha var.
                </p>
              </div>
            </div>
          </div>
        );

      case 'quick_actions':
        return (
          <div className="corporate-card p-8 relative group">
            {moduleHeader('Hızlı İşlemler', <Plus className="w-5 h-5" />)}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <button onClick={onAddIncome} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 hover:bg-emerald-500 hover:text-white transition-all gap-3 group/btn">
                <Plus className="w-7 h-7 group-hover/btn:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wide">Gelir Ekle</span>
              </button>
              <button onClick={onAkbilLoad} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-blue-500/5 text-blue-500 border border-blue-500/10 hover:bg-blue-500 hover:text-white transition-all gap-3 group/btn">
                <Bus className="w-7 h-7 group-hover/btn:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wide">Akbil Yükle</span>
              </button>
              <button onClick={onCryptoTransfer} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-orange-500/5 text-orange-500 border border-orange-500/10 hover:bg-orange-500 hover:text-white transition-all gap-3 group/btn">
                <ArrowRightLeft className="w-7 h-7 group-hover/btn:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wide">Kripto Transfer</span>
              </button>
              <button onClick={onAddTransaction} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-secondary text-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-all gap-3 group/btn">
                <ArrowUpRight className="w-7 h-7 group-hover/btn:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wide">Gider Ekle</span>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const hiddenModules = layout.filter(item => !item.visible);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Finansal Durum</h1>
          <p className="text-muted-foreground font-medium mt-1">Hane halkı varlık ve nakit akışı özeti</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Member Filter */}
          {members && Object.keys(members).length > 1 && (
            <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border">
              <button
                onClick={() => setSelectedMemberId('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                  selectedMemberId === 'all'
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Tümü
              </button>
              {Object.entries(members).map(([id, member]) => (
                <button
                  key={id}
                  onClick={() => setSelectedMemberId(id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${
                    selectedMemberId === id
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${member.type === 'child' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                  {member.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Reorder.Group axis="y" values={layout} onReorder={setLayout} className="space-y-8">
        {layout.filter(item => item.visible).map(item => (
          <Reorder.Item key={item.id} value={item} className="focus:outline-none">
            {renderModule(item.id)}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {hiddenModules.length > 0 && (
        <div className="pt-12 border-t border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Gizlenen Modüller</p>
          <div className="flex flex-wrap gap-3">
            {hiddenModules.map(item => (
              <button
                key={`restore-${item.id}`}
                onClick={() => toggleModuleVisibility(item.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all group"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {item.id === 'master_widget' && 'Varlık Özeti'}
                  {item.id === 'market_data' && 'Piyasa Verileri'}
                  {item.id === 'credit_cards' && 'Kredi Kartları'}
                  {item.id === 'branch_distribution' && 'Varlık Dağılımı'}
                  {item.id === 'payment_calendar' && 'Ödeme Takvimi'}
                  {item.id === 'cash_flow_radar' && 'Nakit Akışı'}
                  {item.id === 'quick_actions' && 'Hızlı İşlemler'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
