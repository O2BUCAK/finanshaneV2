import React, { useMemo, useState } from 'react';
import { Account, Transaction, Category } from '../types';
import { SankeyChart } from './SankeyChart';

interface ReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Account[];
  formatWithEquivalent: (amount: number, currency: string) => string;
  convertToTRY: (amount: number, currency: string) => number;
  members?: Record<string, any>;
}

export const Reports: React.FC<ReportsProps> = ({
  transactions: allTransactions,
  accounts,
  categories,
  formatWithEquivalent,
  convertToTRY,
  members
}) => {
  const [period, setPeriod] = useState<'currentMonth' | 'lastMonth' | 'allTime'>('currentMonth');
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');

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
      const txDate = tx.date.toDate();
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

    // If no income, return empty
    if (totalIncome === 0) {
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
  }, [transactions, accounts, period, convertToTRY]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold">Paranın nereye aktığını görmeye artık hazırsın</h2>
          <p className="text-zinc-100 mt-1">Gelir ve giderlerinizin görsel akışı</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
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

          <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button
              onClick={() => setPeriod('currentMonth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === 'currentMonth' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-100 hover:text-white'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => setPeriod('lastMonth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === 'lastMonth' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-100 hover:text-white'
              }`}
            >
              Geçen Ay
            </button>
            <button
              onClick={() => setPeriod('allTime')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === 'allTime' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-100 hover:text-white'
              }`}
            >
              Tümü
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 lg:p-12 min-h-[600px] flex items-center justify-center relative overflow-hidden">
        {sankeyData.nodes.length > 0 ? (
          <div className="w-full h-[500px]">
            <SankeyChart 
              data={sankeyData} 
              formatCurrency={(val) => formatWithEquivalent(val, 'TRY')}
            />
          </div>
        ) : (
          <div className="text-center text-zinc-100">
            <p className="text-lg mb-2">Bu dönem için yeterli veri bulunmuyor.</p>
            <p className="text-sm">Gelir ve gider işlemlerinizi ekledikçe grafik burada oluşacaktır.</p>
          </div>
        )}
      </div>
    </div>
  );
};
