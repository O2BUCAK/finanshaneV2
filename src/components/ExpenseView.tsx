import React from 'react';
import { 
  TrendingDown, Plus, Calendar, ArrowDownLeft, 
  Clock, Wallet, Briefcase, Target, CreditCard, Tag, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PlannedExpense, Account, Transaction, Category } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { SubscriptionsView } from './SubscriptionsView';
import { PlannedExpenses } from './PlannedExpenses';
import { deleteLedgerTransaction } from '../lib/ledger';
import { ConfirmModal } from './ConfirmModal';
import { useState } from 'react';

interface ExpenseViewProps {
  householdId: string;
  plannedExpenses: PlannedExpense[];
  expenseSources: any[];
  transactions: Transaction[];
  accounts: Account[];
  categories: Account[];
  members?: Record<string, any>;
  onAddTransaction: () => void;
  onAddSubscription: () => void;
  onAddPlannedExpense: () => void;
  onEditPlannedExpense?: (expense: PlannedExpense) => void;
  onEditExpenseSource?: (source: any) => void;
  isPrivacyMode?: boolean;
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({
  householdId,
  plannedExpenses,
  expenseSources,
  transactions,
  accounts,
  categories,
  members,
  onAddTransaction,
  onAddSubscription,
  onAddPlannedExpense,
  onEditPlannedExpense,
  onEditExpenseSource,
  isPrivacyMode = false
}) => {
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<string>('');

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteLedgerTransaction(householdId, id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const expenseTransactions = transactions.filter(tx => {
    const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
    const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
    return debitAcc?.type === 'expense' && creditAcc?.type === 'asset';
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Gider Yönetimi</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Harcamalarınız, abonelikleriniz ve planlanan giderleriniz</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onAddTransaction}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-500/20"
          >
            <Plus className="w-5 h-5" />
            Yeni Harcama
          </button>
        </div>
      </div>

      {/* Planlanan Giderler */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Planlanan Giderler
          </h2>
        </div>
        <PlannedExpenses 
          householdId={householdId}
          accounts={accounts}
          categories={categories}
          members={members}
          isPrivacyMode={isPrivacyMode}
          onEditPlannedExpense={onEditPlannedExpense}
          onEditExpenseSource={onEditExpenseSource}
        />
      </div>

      {/* Abonelikler */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Düzenli Ödemeler & Abonelikler
          </h2>
        </div>
        <SubscriptionsView 
          householdId={householdId}
          expenseSources={expenseSources}
          accounts={accounts}
          categories={categories}
          members={members}
          onAddSubscription={onAddSubscription}
          isPrivacyMode={isPrivacyMode}
        />
      </div>

      {/* Son Harcamalar */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ArrowDownLeft className="w-5 h-5 text-rose-500" />
          Son Harcamalar
        </h2>
        <div className="corporate-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Açıklama</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Tutar</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {expenseTransactions.slice(0, 10).map(tx => {
                const category = categories.find(c => c.id === tx.categoryId);
                return (
                  <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {new Date(tx.date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {tx.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                        <Tag className="w-3 h-3" />
                        {category?.name || 'Diğer'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-rose-500 text-right">
                      -{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setDeleteConfirmId(tx.id);
                          setDeleteConfirmTitle('İşlemi Sil');
                          setDeleteConfirmMessage(`${tx.description} işlemini silmek istediğinizden emin misiniz? Bu işlem hesap bakiyelerini de etkileyecektir.`);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) handleDeleteTransaction(deleteConfirmId);
        }}
        title={deleteConfirmTitle}
        message={deleteConfirmMessage}
      />
    </div>
  );
};
