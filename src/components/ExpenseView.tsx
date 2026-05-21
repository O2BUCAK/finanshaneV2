import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, Plus, Calendar, ArrowDownLeft, 
  Clock, Wallet, Briefcase, Target, CreditCard, Tag, Trash2,
  Check, X, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PlannedExpense, Account, Transaction, Category, ExpectedExpense } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { SubscriptionsView } from './SubscriptionsView';
import { PlannedExpenses } from './PlannedExpenses';
import { deleteLedgerTransaction, createLedgerTransaction } from '../lib/ledger';
import { updateExpectedExpense, createExpectedExpense } from '../lib/expenseSources';
import { useAuth } from '../hooks/useAuth';
import { ConfirmModal } from './ConfirmModal';

interface ExpenseViewProps {
  householdId: string;
  plannedExpenses: PlannedExpense[];
  expenseSources: any[];
  expectedExpenses: ExpectedExpense[];
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
  plannedExpenses = [],
  expenseSources = [],
  expectedExpenses = [],
  transactions = [],
  accounts = [],
  categories = [],
  members,
  onAddTransaction,
  onAddSubscription,
  onAddPlannedExpense,
  onEditPlannedExpense,
  onEditExpenseSource,
  isPrivacyMode = false
}) => {
  const { user } = useAuth();
  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<string>('');

  const totalPlanned = useMemo(() => {
    const planned = plannedExpenses.reduce((sum, exp) => sum + convertToTRY(exp.amount, exp.currency), 0);
    const expected = expectedExpenses
      .filter(ee => ee.status === 'pending')
      .reduce((sum, ee) => sum + convertToTRY(ee.amount, ee.currency), 0);
    return planned + expected;
  }, [plannedExpenses, expectedExpenses, convertToTRY]);

  const totalPaid = useMemo(() => {
    const planned = plannedExpenses
      .filter(exp => exp.status === 'paid')
      .reduce((sum, exp) => sum + convertToTRY(exp.amount, exp.currency), 0);
    const expected = expectedExpenses
      .filter(ee => ee.status === 'paid')
      .reduce((sum, ee) => sum + convertToTRY(ee.amount, ee.currency), 0);
    return planned + expected;
  }, [plannedExpenses, expectedExpenses, convertToTRY]);

  const progress = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0;

  const handleApproveExpectedExpense = async (expected: ExpectedExpense) => {
    if (!householdId || !user) return;
    
    // Engelleme: Vakti gelmeyen (gelecek tarihli) beklenen gider ödenemez
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const expectedDate = expected.expectedDate instanceof Date 
      ? expected.expectedDate 
      : (expected.expectedDate as any)?.seconds 
        ? new Date((expected.expectedDate as any).seconds * 1000) 
        : new Date(expected.expectedDate);

    if (expectedDate > today) {
      alert("Hata: Vade tarihi gelmemiş olan gelecek tarihli giderler tahsil edilemez/ödenemez!");
      return;
    }
    
    try {
      // 1. Create a transaction
      const txData = {
        description: `${expected.sourceName} (Düzenli Ödeme)`,
        amount: expected.amount,
        currency: expected.currency,
        date: new Date(),
        debitAccountId: expected.categoryId === 'transfer' ? (expected.targetAccountId || '') : expected.categoryId,
        creditAccountId: expected.sourceAccountId,
        categoryId: expected.categoryId,
        userId: expected.ownerId || user.uid,
      };

      await createLedgerTransaction(householdId, txData);

      // 2. Update expected expense status
      await updateExpectedExpense(householdId, expected.id, {
        status: 'paid',
        transactionId: 'temp-id',
      });

      // 3. Generate the NEXT expected expense
      const source = expenseSources.find(s => s.id === expected.sourceId);
      if (source) {
        const nextDate = new Date(expectedDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        await createExpectedExpense(householdId, {
          sourceId: source.id,
          sourceName: source.name,
          amount: source.amount,
          currency: source.currency,
          expectedDate: nextDate,
          status: 'pending',
          sourceAccountId: source.sourceAccountId,
          categoryId: source.categoryId,
          targetAccountId: source.targetAccountId || null,
          ownerId: source.ownerId || null,
        });
      }
    } catch (error) {
      console.error('Approve expected expense error:', error);
    }
  };

  const handleCancelExpectedExpense = async (id: string) => {
    try {
      await updateExpectedExpense(householdId, id, { status: 'cancelled' });
    } catch (error) {
      console.error('Cancel expected expense error:', error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteLedgerTransaction(householdId, id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const expenseTransactions = transactions.filter(tx => {
    const debitAcc = categories.find(a => a.id === tx.debitAccountId);
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

      {/* 1. Statistics Cards & Budget Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
        <div className="corporate-card p-8 bg-zinc-950/45 border border-zinc-900">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Target className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Planlanan</span>
          </div>
          <div className="text-3xl font-black text-foreground">
            {formatWithEquivalent(totalPlanned, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-8 bg-zinc-950/45 border border-zinc-900">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Ödenen</span>
          </div>
          <div className="text-3xl font-black text-emerald-500">
            {formatWithEquivalent(totalPaid, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-8 bg-zinc-950/45 border border-zinc-900">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Kalan Ödeme</span>
          </div>
          <div className="text-3xl font-black text-foreground">
            {formatWithEquivalent(totalPlanned - totalPaid, 'TRY')}
          </div>
        </div>
      </div>

      <div className="corporate-card p-8 bg-zinc-950/45 border border-zinc-900 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-bold text-foreground uppercase tracking-wide">Aylık Gider Ödemeleri İlerleme Durumu</span>
          <span className="text-sm font-bold text-rose-500">%{progress.toFixed(1)}</span>
        </div>
        <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progress)}%` }}
            className="bg-rose-500 h-full rounded-full shadow-sm"
          />
        </div>
      </div>

      {/* 2. Bekleyen Ödemeler (Expected / Recurring Pending Bills) */}
      <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" />
          Bekleyen Ödemeler
        </h2>
        
        {expectedExpenses.filter(ee => ee.status === 'pending').length > 0 ? (
          <div className="corporate-card overflow-hidden border border-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-900 bg-secondary/30">
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vade</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tanım</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kategori</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Miktar</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {expectedExpenses
                    .filter(ee => ee.status === 'pending')
                    .sort((a, b) => {
                      const dateA = a.expectedDate instanceof Date ? a.expectedDate : (a.expectedDate as any)?.seconds ? new Date((a.expectedDate as any).seconds * 1000) : new Date(a.expectedDate);
                      const dateB = b.expectedDate instanceof Date ? b.expectedDate : (b.expectedDate as any)?.seconds ? new Date((b.expectedDate as any).seconds * 1000) : new Date(b.expectedDate);
                      return dateA.getTime() - dateB.getTime();
                    })
                    .map(ee => {
                      const category = categories.find(c => c.id === ee.categoryId);
                      const expectedDate = ee.expectedDate instanceof Date 
                        ? ee.expectedDate 
                        : (ee.expectedDate as any)?.seconds 
                          ? new Date((ee.expectedDate as any).seconds * 1000) 
                          : new Date(ee.expectedDate);
                      
                      const isOverdue = expectedDate < new Date();
                      
                      const isFuture = (() => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        return expectedDate > today;
                      })();

                      return (
                        <tr key={ee.id} className="group hover:bg-secondary/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-bold ${isOverdue ? 'text-rose-500 font-extrabold' : isFuture ? 'text-zinc-500 font-medium' : 'text-foreground'}`}>
                              {expectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            {isOverdue && <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wide">Gecikti</span>}
                            {isFuture && <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wide">Gelecek Dönem</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-foreground">{ee.sourceName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || 'var(--muted-foreground)' }} />
                              <span className="text-sm font-medium text-muted-foreground">{category?.name || 'Kategorisiz'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-bold text-foreground">
                              {formatWithEquivalent(ee.amount, ee.currency)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                disabled={isFuture}
                                onClick={() => handleApproveExpectedExpense(ee)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border-0 ${
                                  isFuture
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                }`}
                                title={isFuture ? 'Tarihi gelmediği için henüz ödenemez.' : 'Ödeme Yapıldı'}
                              >
                                <Check className="w-3.5 h-3.5" /> Ödeme Yapıldı
                              </button>
                              <button 
                                onClick={() => handleCancelExpectedExpense(ee.id)}
                                className="p-2 hover:bg-rose-500/10 rounded-xl text-muted-foreground hover:text-rose-500 transition-all border-0"
                                title="İptal Et"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-950/40 border border-dashed border-zinc-900 rounded-3xl">
            <p className="text-sm font-semibold text-muted-foreground">Yakın zamanda ödenmesi beklenen düzenli ödeme/fatura bulunmuyor.</p>
          </div>
        )}
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
