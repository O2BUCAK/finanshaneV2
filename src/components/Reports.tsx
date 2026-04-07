import React, { useMemo, useState } from 'react';
import { PieChart, RefreshCw } from 'lucide-react';
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

  const transactions = useMemo(() => 
    selectedMemberId === 'all' ? allTransactions : allTransactions.filter(t => t.userId === selectedMemberId),
    [allTransactions, selectedMemberId]
  );

  const sankeyData = useMemo(() => {
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

    // We need to build nodes and links
    // Nodes: Income sources, "Toplam Gelir", Expense categories, "Artan Gelir"
    const nodes: any[] = [];
    const links: any[] = [];

    // 1. Calculate Income by Source
    const incomeBySource: Record<string, number> = {};
    let totalIncome = 0;

    filteredTxs.forEach(tx => {
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      
      // Income transaction: debit is asset, credit is income
      if (debitAcc?.type === 'asset' && creditAcc?.type === 'income') {
        const amountTRY = convertToTRY(tx.amount, tx.currency || 'TRY');
        incomeBySource[creditAcc.name] = (incomeBySource[creditAcc.name] || 0) + amountTRY;
        totalIncome += amountTRY;
      }
    });

    // Add Predicted Incomes
    if (showPredicted && period === 'currentMonth') {
      // 1. Existing pending expected incomes
      const pendingSourceIds = new Set();
      expectedIncomes.forEach(ei => {
        const eiDate = new Date(ei.expectedDate);
        const isThisMonth = eiDate.getMonth() === currentMonth && eiDate.getFullYear() === currentYear;
        
        if (ei.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(ei.amount, ei.currency || 'TRY');
          const name = `(Tahmini) ${ei.sourceName}`;
          incomeBySource[name] = (incomeBySource[name] || 0) + amountTRY;
          totalIncome += amountTRY;
          pendingSourceIds.add(ei.sourceId);
        }
      });

      // 2. Recurring sources that don't have a pending item for this month yet
      incomeSources.forEach(is => {
        if (!is.isArchived && is.flowType !== 'spot' && !pendingSourceIds.has(is.id)) {
          // Check if it was already realized this month
          const alreadyRealized = transactions.some(tx => {
            const txDate = new Date(tx.date);
            const isThisMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
            return isThisMonth && creditAcc?.name === is.name;
          });

          if (!alreadyRealized) {
            const amountTRY = convertToTRY(is.amount, is.currency || 'TRY');
            const name = `(Tahmini) ${is.name}`;
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
      
      // Expense transaction: debit is expense, credit is asset
      if (debitAcc?.type === 'expense' && creditAcc?.type === 'asset') {
        const amountTRY = convertToTRY(tx.amount, tx.currency || 'TRY');
        expenseByCategory[debitAcc.name] = (expenseByCategory[debitAcc.name] || 0) + amountTRY;
        totalExpense += amountTRY;
      }
    });

    // Add Predicted Expenses
    if (showPredicted && period === 'currentMonth') {
      const pendingPlannedIds = new Set();
      const pendingExpectedIds = new Set();

      // 1. Planned Expenses
      plannedExpenses.forEach(pe => {
        const peDate = new Date(pe.dueDate);
        const isThisMonth = peDate.getMonth() === currentMonth && peDate.getFullYear() === currentYear;

        if (pe.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(pe.amount, pe.currency || 'TRY');
          const category = categories.find(c => c.id === pe.categoryId);
          const name = `(Tahmini) ${category?.name || 'Diğer'}`;
          expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
          totalExpense += amountTRY;
          pendingPlannedIds.add(pe.id);
        }
      });

      // 2. Expected Expenses
      expectedExpenses.forEach(ee => {
        const eeDate = new Date(ee.expectedDate);
        const isThisMonth = eeDate.getMonth() === currentMonth && eeDate.getFullYear() === currentYear;

        if (ee.status === 'pending' && isThisMonth) {
          const amountTRY = convertToTRY(ee.amount, ee.currency || 'TRY');
          const category = categories.find(c => c.id === ee.categoryId);
          const name = `(Tahmini) ${category?.name || 'Diğer'}`;
          expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
          totalExpense += amountTRY;
          pendingExpectedIds.add(ee.sourceId);
        }
      });

      // 3. Recurring expense sources (subscriptions etc) not yet generated or pending
      expenseSources.forEach(es => {
        if (!es.isArchived && !pendingExpectedIds.has(es.id)) {
          // Check if already paid this month
          const alreadyPaid = transactions.some(tx => {
            const txDate = new Date(tx.date);
            const isThisMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
            return isThisMonth && debitAcc?.id === es.categoryId;
          });

          if (!alreadyPaid) {
            const amountTRY = convertToTRY(es.amount, es.currency || 'TRY');
            const category = categories.find(c => c.id === es.categoryId);
            const name = `(Tahmini) ${category?.name || 'Diğer'}`;
            expenseByCategory[name] = (expenseByCategory[name] || 0) + amountTRY;
            totalExpense += amountTRY;
          }
        }
      });
    }

    // If no data at all, return empty
    if (totalIncome === 0 && totalExpense === 0) {
      return { nodes: [], links: [] };
    }

    // Add Income Nodes
    const incomeColors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
    Object.entries(incomeBySource).forEach(([name, amount], i) => {
      if (amount > 0) {
        const id = `income_${i}`;
        nodes.push({ id, name, value: amount, color: incomeColors[i % incomeColors.length] });
        links.push({ source: id, target: 'total_income', value: amount });
      }
    });

    // Add Total Income Node
    nodes.push({ id: 'total_income', name: 'Toplam Gelir', value: totalIncome, displayValue: totalIncome, color: '#3b82f6' });

    // Add Expense Nodes
    const expenseColors = ['#3b82f6', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];
    Object.entries(expenseByCategory).forEach(([name, amount], i) => {
      if (amount > 0) {
        const id = `expense_${i}`;
        nodes.push({ id, name, value: amount, color: expenseColors[i % expenseColors.length] });
        links.push({ source: 'total_income', target: id, value: amount });
      }
    });

    // Add Remaining Income Node
    const remaining = totalIncome - totalExpense;
    if (remaining > 0) {
      nodes.push({ id: 'remaining', name: 'Artan Gelir', value: remaining, color: '#22c55e' });
      links.push({ source: 'total_income', target: 'remaining', value: remaining });
    } else if (remaining < 0) {
      // If expenses > income, we might want to show deficit
      nodes.push({ id: 'deficit', name: 'Bütçe Açığı', value: Math.abs(remaining), color: '#ef4444' });
      // To make Sankey work, deficit should flow INTO total income or expenses
      // A simple way is to flow from deficit to total_income to balance it
      links.push({ source: 'deficit', target: 'total_income', value: Math.abs(remaining) });
    }

    return { nodes, links };
  }, [transactions, accounts, period, convertToTRY, showPredicted, expectedIncomes, plannedExpenses, expectedExpenses, incomeSources, expenseSources]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Nakit Akış Analizi</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Gelir ve giderlerinizin görsel akış diyagramı</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
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
    </div>
  );
};
