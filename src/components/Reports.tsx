import React, { useMemo, useState } from 'react';
import { PieChart, RefreshCw, LayoutGrid, BarChart3, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Account, Transaction, Category, ExpectedIncome, PlannedExpense, ExpectedExpense, IncomeSource, ExpenseSource } from '../types';
import { SankeyChart } from './SankeyChart';

interface ReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Account[];
  expectedIncomes: ExpectedIncome[];
  plannedExpenses: PlannedExpense[];
  expectedExpenses: ExpectedExpense[];
  incomeSources: IncomeSource[];
  expenseSources: ExpenseSource[];
  formatWithEquivalent: (amount: number, currency: string) => string;
  convertToTRY: (amount: number, currency: string) => number;
  members?: Record<string, any>;
}

export const Reports: React.FC<ReportsProps> = ({
  transactions: allTransactions,
  accounts,
  categories,
  expectedIncomes,
  plannedExpenses,
  expectedExpenses,
  incomeSources,
  expenseSources,
  formatWithEquivalent,
  convertToTRY,
  members
}) => {
  const [period, setPeriod] = useState<'currentMonth' | 'lastMonth' | 'allTime'>('currentMonth');
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');
  const [showPredicted, setShowPredicted] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
  const [accountGroupBy, setAccountGroupBy] = useState<'none' | 'institution' | 'type' | 'branch'>('none');
  const [accountSearch, setAccountSearch] = useState('');

  const transactions = useMemo(() => 
    selectedMemberId === 'all' ? allTransactions : allTransactions.filter(t => t.userId === selectedMemberId),
    [allTransactions, selectedMemberId]
  );

  const groupedAccounts = useMemo(() => {
    const assetAccounts = accounts.filter(a => 
      a.type === 'asset' && 
      !a.isArchived &&
      (accountSearch === '' || a.name.toLowerCase().includes(accountSearch.toLowerCase()) || a.institution?.toLowerCase().includes(accountSearch.toLowerCase()))
    );

    if (accountGroupBy === 'none') return { 'Tüm Varlıklar': assetAccounts };

    const groups: Record<string, Account[]> = {};
    assetAccounts.forEach(acc => {
      let key = 'Diğer';
      if (accountGroupBy === 'institution') {
        key = acc.institution || 'Kurum Belirtilmemiş';
      } else if (accountGroupBy === 'type') {
        if (acc.assetDetails?.assetType) {
          const typeMap: any = { stock: 'Hisse Senetleri', crypto: 'Kripto Varlıklar', fund: 'Yatırım Fonları' };
          key = typeMap[acc.assetDetails.assetType] || 'Diğer Yatırımlar';
        } else {
          const subTypeMap: any = { 
            liquidity_deposit: 'Vadesiz/Mevduat', 
            investment: 'Yatırım', 
            credit_debt: 'Alacaklar',
            transport: 'Ulaşım Kartları',
            food: 'Yemek Kartları',
            corporate_gift: 'Kurumsal Hediyeler'
          };
          key = subTypeMap[acc.subType] || 'Diğer';
        }
      } else if (accountGroupBy === 'branch') {
        const branchMap: any = { banking: 'Bankacılık', crypto: 'Kripto', social_gift: 'Sosyal/Yan Haklar' };
        key = branchMap[acc.branch] || 'Diğer';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    });

    return groups;
  }, [accounts, accountGroupBy, accountSearch]);

  const reportData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const filteredTxs = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (period === 'currentMonth') {
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      } else if (period === 'lastMonth') {
        return txDate.getMonth() === lastMonth && txDate.getFullYear() === lastMonthYear;
      }
      return true;
    });

    // 1. Calculate Income by Source
    const incomeBySource: Record<string, number> = {};
    let totalIncome = 0;

    filteredTxs.forEach(tx => {
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      
      if (debitAcc?.type === 'asset' && creditAcc?.type === 'income') {
        const amountTRY = convertToTRY(tx.amount, tx.currency || 'TRY');
        incomeBySource[creditAcc.name] = (incomeBySource[creditAcc.name] || 0) + amountTRY;
        totalIncome += amountTRY;
      }
    });

    if (showPredicted && period === 'currentMonth') {
      const pendingSourceIds = new Set();
      expectedIncomes.forEach(ei => {
        const eiDate = new Date(ei.expectedDate);
        const isThisMonth = eiDate.getMonth() === currentMonth && eiDate.getFullYear() === currentYear;
        
        if (ei.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(ei.amount, ei.currency || 'TRY');
          const name = `${ei.sourceName}\u200B`;
          incomeBySource[name] = (incomeBySource[name] || 0) + amountTRY;
          totalIncome += amountTRY;
          pendingSourceIds.add(ei.sourceId);
        }
      });

      incomeSources.forEach(is => {
        if (!is.isArchived && is.flowType !== 'spot' && !pendingSourceIds.has(is.id)) {
          const alreadyRealized = transactions.some(tx => {
            const txDate = new Date(tx.date);
            const isThisMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
            return isThisMonth && creditAcc?.name === is.name;
          });

          if (!alreadyRealized) {
            const amountTRY = convertToTRY(is.amount, is.currency || 'TRY');
            const name = `${is.name}\u200B`;
            incomeBySource[name] = (incomeBySource[name] || 0) + amountTRY;
            totalIncome += amountTRY;
          }
        }
      });
    }

    // 2. Calculate Expenses by Category
    const expenseByCategory: Record<string, number> = {};
    let totalExpense = 0;

    filteredTxs.forEach(tx => {
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      
      if (debitAcc?.type === 'expense' && creditAcc?.type === 'asset') {
        const amountTRY = convertToTRY(tx.amount, tx.currency || 'TRY');
        expenseByCategory[debitAcc.name] = (expenseByCategory[debitAcc.name] || 0) + amountTRY;
        totalExpense += amountTRY;
      }
    });

    if (showPredicted && period === 'currentMonth') {
      const pendingExpectedIds = new Set();

      plannedExpenses.forEach(pe => {
        const peDate = new Date(pe.dueDate);
        const isThisMonth = peDate.getMonth() === currentMonth && peDate.getFullYear() === currentYear;

        if (pe.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(pe.amount, pe.currency || 'TRY');
          const category = categories.find(c => c.id === pe.categoryId);
          const name = `${category?.name || 'Diğer'}\u200B`;
          expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
          totalExpense += amountTRY;
        }
      });

      expectedExpenses.forEach(ee => {
        const eeDate = new Date(ee.expectedDate);
        const isThisMonth = eeDate.getMonth() === currentMonth && eeDate.getFullYear() === currentYear;

        if (ee.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(ee.amount, ee.currency || 'TRY');
          const category = categories.find(c => c.id === ee.categoryId);
          const name = `${category?.name || 'Diğer'}\u200B`;
          expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
          totalExpense += amountTRY;
          pendingExpectedIds.add(ee.sourceId);
        }
      });

      expenseSources.forEach(es => {
        if (!es.isArchived && !pendingExpectedIds.has(es.id)) {
          const alreadyPaid = transactions.some(tx => {
            const txDate = new Date(tx.date);
            const isThisMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
            return isThisMonth && debitAcc?.id === es.categoryId;
          });

          if (!alreadyPaid) {
            const amountTRY = convertToTRY(es.amount, es.currency || 'TRY');
            const category = categories.find(c => c.id === es.categoryId);
            const name = `${category?.name || 'Diğer'}\u200B`;
            expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
            totalExpense += amountTRY;
          }
        }
      });
    }

    return { incomeBySource, totalIncome, expenseByCategory, totalExpense };
  }, [transactions, accounts, period, convertToTRY, showPredicted, expectedIncomes, plannedExpenses, expectedExpenses, incomeSources, expenseSources]);

  const sankeyData = useMemo(() => {
    const { incomeBySource, totalIncome, expenseByCategory, totalExpense } = reportData;
    const nodes: any[] = [];
    const links: any[] = [];

    if (totalIncome === 0 && totalExpense === 0) {
      return { nodes: [], links: [] };
    }

    const incomeColors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
    Object.entries(incomeBySource).forEach(([name, amount], i) => {
      if (amount > 0) {
        const id = `income_${i}`;
        nodes.push({ id, name, value: amount, color: incomeColors[i % incomeColors.length] });
        links.push({ source: id, target: 'total_income', value: amount });
      }
    });

    nodes.push({ id: 'total_income', name: 'Toplam Gelir', value: totalIncome, displayValue: totalIncome, color: '#3b82f6' });

    const expenseColors = ['#3b82f6', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];
    Object.entries(expenseByCategory).forEach(([name, amount], i) => {
      if (amount > 0) {
        const id = `expense_${i}`;
        nodes.push({ id, name, value: amount, color: expenseColors[i % expenseColors.length] });
        links.push({ source: 'total_income', target: id, value: amount });
      }
    });

    const remaining = totalIncome - totalExpense;
    if (remaining > 0) {
      nodes.push({ id: 'remaining', name: 'Artan Gelir', value: remaining, color: '#22c55e' });
      links.push({ source: 'total_income', target: 'remaining', value: remaining });
    } else if (remaining < 0) {
      nodes.push({ id: 'deficit', name: 'Bütçe Açığı', value: Math.abs(remaining), color: '#ef4444' });
      links.push({ source: 'deficit', target: 'total_income', value: Math.abs(remaining) });
    }

    return { nodes, links };
  }, [reportData]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Nakit Akış Analizi</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Gelir ve giderlerinizin detaylı analizi</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'chart' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Akış Grafiği</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'list' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Liste Görünümü</span>
            </button>
          </div>

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

          <div className="flex bg-secondary/50 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setPeriod('currentMonth')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                period === 'currentMonth' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => setPeriod('lastMonth')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                period === 'lastMonth' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Geçen Ay
            </button>
            <button
              onClick={() => setPeriod('allTime')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                period === 'allTime' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tümü
            </button>
          </div>

          {period === 'currentMonth' && (
            <button
              onClick={() => setShowPredicted(!showPredicted)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all border ${
                showPredicted 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                  : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${showPredicted ? 'animate-spin-slow' : ''}`} />
              Tahmini Veriler: {showPredicted ? 'Açık' : 'Kapalı'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="corporate-card p-8 min-h-[500px] flex items-center justify-center relative overflow-hidden">
          {sankeyData.nodes.length > 0 ? (
            <div className="w-full h-[400px]">
              <SankeyChart 
                data={sankeyData} 
                formatCurrency={(val) => formatWithEquivalent(val, 'TRY')}
              />
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                <PieChart className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-base font-bold text-foreground mb-1">Yeterli veri bulunmuyor</p>
              <p className="text-xs text-muted-foreground font-medium">Gelir ve gider işlemlerinizi ekledikçe grafik burada oluşacaktır.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Accounts Section */}
          <div className="corporate-card p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tighter">Hesaplar</h3>
                  <p className="text-xs text-muted-foreground font-medium">Varlık dağılımı</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select 
                  value={accountGroupBy}
                  onChange={(e) => setAccountGroupBy(e.target.value as any)}
                  className="text-[10px] font-bold uppercase tracking-wider bg-secondary/50 border-none rounded-lg px-2 py-1 focus:ring-0"
                >
                  <option value="none">Gruplama Yok</option>
                  <option value="institution">Kurum</option>
                  <option value="type">Tür</option>
                  <option value="branch">Branş</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <input 
                type="text"
                placeholder="Hesap veya kurum ara..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full bg-secondary/30 border-none rounded-xl px-4 py-2 text-xs font-medium placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(groupedAccounts).map(([groupName, accs]) => {
                const groupTotal = accs.reduce((sum, a) => sum + convertToTRY(a.balance, a.currency), 0);
                if (accs.length === 0) return null;
                
                return (
                  <div key={groupName} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/50 pb-1">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{groupName}</h4>
                      <span className="text-[10px] font-black font-mono text-primary">{formatWithEquivalent(groupTotal, 'TRY')}</span>
                    </div>
                    <div className="space-y-2">
                      {accs.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/30 hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-lg shadow-sm">
                              {acc.icon || '💰'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold leading-none">{acc.name}</span>
                              {acc.institution && <span className="text-[10px] text-muted-foreground font-medium mt-1">{acc.institution}</span>}
                            </div>
                          </div>
                          <span className="text-sm font-black font-mono">
                            {formatWithEquivalent(acc.balance, acc.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Income Section */}
          <div className="corporate-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tighter">Gelirler</h3>
                <p className="text-xs text-muted-foreground font-medium">Kaynak bazlı dağılım</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(reportData.incomeBySource).map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <span className={`text-sm font-bold ${name.endsWith('\u200B') ? 'text-muted-foreground/60 italic font-medium' : ''}`}>
                    {name.replace(/\u200B/g, '')}
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-600">
                    {formatWithEquivalent(amount, 'TRY')}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-xs font-black uppercase text-muted-foreground">Toplam</span>
                <span className="text-base font-black font-mono text-emerald-600">
                  {formatWithEquivalent(reportData.totalIncome, 'TRY')}
                </span>
              </div>
            </div>
          </div>

          {/* Expense Section */}
          <div className="corporate-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tighter">Giderler</h3>
                <p className="text-xs text-muted-foreground font-medium">Kategori bazlı dağılım</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(reportData.expenseByCategory).map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <span className={`text-sm font-bold ${name.endsWith('\u200B') ? 'text-muted-foreground/60 italic font-medium' : ''}`}>
                    {name.replace(/\u200B/g, '')}
                  </span>
                  <span className="text-sm font-black font-mono text-rose-600">
                    {formatWithEquivalent(amount, 'TRY')}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-xs font-black uppercase text-muted-foreground">Toplam</span>
                <span className="text-base font-black font-mono text-rose-600">
                  {formatWithEquivalent(reportData.totalExpense, 'TRY')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
