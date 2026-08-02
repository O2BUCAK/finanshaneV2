import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, Plus, Calendar, ArrowDownLeft, 
  Clock, Wallet, Briefcase, Target, CreditCard, Tag, Trash2, Pencil,
  Check, X, AlertCircle, ChevronDown, ChevronUp, Layers, Filter,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlannedExpense, Account, Transaction, Category, ExpectedExpense } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { SubscriptionsView } from './SubscriptionsView';
import { PlannedExpenses } from './PlannedExpenses';
import { deleteLedgerTransaction, createLedgerTransaction, deleteInstallmentGroup } from '../lib/ledger';
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
  onEditTransaction?: (tx: Transaction) => void;
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
  onEditTransaction,
  onAddSubscription,
  onAddPlannedExpense,
  onEditPlannedExpense,
  onEditExpenseSource,
  isPrivacyMode = false
}) => {
  const { user } = useAuth();
  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    isInstallmentGroup?: boolean;
    parentTransactionId?: string;
    title: string;
    message: string;
  } | null>(null);

  const [expandedInstallmentKey, setExpandedInstallmentKey] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'single' | 'installment'>('all');
  const [txSortField, setTxSortField] = useState<'date' | 'description' | 'category' | 'amount'>('date');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expectedSortField, setExpectedSortField] = useState<'date' | 'title' | 'category' | 'amount'>('date');
  const [expectedExpenseSortOrder, setExpectedExpenseSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAllTx, setShowAllTx] = useState<boolean>(false);

  const toggleTxSort = (field: 'date' | 'description' | 'category' | 'amount') => {
    if (txSortField === field) {
      setTxSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setTxSortField(field);
      setTxSortOrder(field === 'description' || field === 'category' ? 'asc' : 'desc');
    }
  };

  const toggleExpectedSort = (field: 'date' | 'title' | 'category' | 'amount') => {
    if (expectedSortField === field) {
      setExpectedExpenseSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setExpectedSortField(field);
      setExpectedExpenseSortOrder(field === 'title' || field === 'category' ? 'asc' : 'desc');
    }
  };

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

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.isInstallmentGroup && deleteConfirm.parentTransactionId) {
        await deleteInstallmentGroup(householdId, deleteConfirm.parentTransactionId);
      } else {
        await deleteLedgerTransaction(householdId, deleteConfirm.id);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const expenseTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const debitAcc = categories.find(a => a.id === tx.debitAccountId || a.id === tx.categoryId) || accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      if (tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1)) return true;
      if (debitAcc?.type === 'expense') return true;
      if (creditAcc && debitAcc?.type !== 'income') return true;
      return false;
    });
  }, [transactions, categories, accounts]);

  const filteredExpenseTransactions = useMemo(() => {
    const list = expenseTransactions.filter(tx => {
      const isInst = tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1);
      if (txFilter === 'single') return !isInst;
      if (txFilter === 'installment') return isInst;
      return true;
    });

    return [...list].sort((a, b) => {
      let diff = 0;
      if (txSortField === 'date') {
        const getTime = (d: any) => {
          if (!d) return 0;
          if (d instanceof Date) return d.getTime();
          if (typeof d === 'number') return d;
          if (d?.seconds) return d.seconds * 1000;
          const parsed = new Date(d).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        diff = getTime(a.date) - getTime(b.date);
      } else if (txSortField === 'description') {
        diff = (a.description || '').localeCompare(b.description || '', 'tr');
      } else if (txSortField === 'category') {
        const catA = categories.find(c => c.id === a.categoryId || c.id === a.debitAccountId)?.name || '';
        const catB = categories.find(c => c.id === b.categoryId || c.id === b.debitAccountId)?.name || '';
        diff = catA.localeCompare(catB, 'tr');
      } else if (txSortField === 'amount') {
        const isInstA = a.isInstallment || (a.installmentCount && a.installmentCount > 1);
        const amountA = isInstA && a.installmentCount ? a.amount * a.installmentCount : a.amount;
        const isInstB = b.isInstallment || (b.installmentCount && b.installmentCount > 1);
        const amountB = isInstB && b.installmentCount ? b.amount * b.installmentCount : b.amount;
        diff = amountA - amountB;
      }
      return txSortOrder === 'asc' ? diff : -diff;
    });
  }, [expenseTransactions, txFilter, txSortField, txSortOrder, categories]);

  const installmentGroups = useMemo(() => {
    const groupsMap = new Map<string, {
      key: string;
      description: string;
      categoryId: string;
      creditAccountId: string;
      debitAccountId: string;
      monthlyAmount: number;
      currency: string;
      installmentCount: number;
      installments: Transaction[];
      parentTransactionId?: string;
    }>();

    transactions.forEach(tx => {
      if (tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1)) {
        const key = tx.parentTransactionId || `${tx.description}-${tx.installmentCount}-${tx.amount}`;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            description: tx.description,
            categoryId: tx.categoryId,
            creditAccountId: tx.creditAccountId,
            debitAccountId: tx.debitAccountId,
            monthlyAmount: tx.amount,
            currency: tx.currency || 'TRY',
            installmentCount: tx.installmentCount || 1,
            installments: [],
            parentTransactionId: tx.parentTransactionId
          });
        }
        groupsMap.get(key)!.installments.push(tx);
      }
    });

    const now = new Date();
    return Array.from(groupsMap.values()).map(group => {
      const sortedInstallments = [...group.installments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const paidInstallments = sortedInstallments.filter(t => new Date(t.date) <= now);
      const futureInstallments = sortedInstallments.filter(t => new Date(t.date) > now);
      
      const paidCount = paidInstallments.length > 0 ? Math.min(group.installmentCount, paidInstallments.length) : (sortedInstallments[0] && new Date(sortedInstallments[0].date) <= now ? 1 : 0);
      const remainingCount = Math.max(0, group.installmentCount - paidCount);
      const totalAmount = group.monthlyAmount * group.installmentCount;
      const remainingAmount = group.monthlyAmount * remainingCount;
      const paidAmount = totalAmount - remainingAmount;
      const progress = group.installmentCount > 0 ? (paidCount / group.installmentCount) * 100 : 0;
      const nextInstallment = futureInstallments[0] || sortedInstallments[sortedInstallments.length - 1];

      const category = categories.find(c => c.id === group.categoryId || c.id === group.debitAccountId);
      const creditAccount = accounts.find(a => a.id === group.creditAccountId);

      return {
        ...group,
        installments: sortedInstallments,
        paidCount,
        remainingCount,
        totalAmount,
        paidAmount,
        remainingAmount,
        progress,
        nextInstallmentDate: nextInstallment ? new Date(nextInstallment.date) : null,
        categoryName: category?.name || 'Gider',
        accountName: creditAccount?.name || 'Kredi Kartı / Hesap'
      };
    });
  }, [transactions, categories, accounts]);

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
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <button 
                        onClick={() => toggleExpectedSort('date')}
                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                        title="Vadeye göre sırala"
                      >
                        Vade
                        {expectedSortField === 'date' ? (
                          expectedExpenseSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <button 
                        onClick={() => toggleExpectedSort('title')}
                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                        title="Tanıma göre sırala"
                      >
                        Tanım
                        {expectedSortField === 'title' ? (
                          expectedExpenseSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <button 
                        onClick={() => toggleExpectedSort('category')}
                        className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                        title="Kategoriye göre sırala"
                      >
                        Kategori
                        {expectedSortField === 'category' ? (
                          expectedExpenseSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                      <button 
                        onClick={() => toggleExpectedSort('amount')}
                        className="flex items-center gap-1.5 ml-auto hover:text-amber-400 transition-colors"
                        title="Miktara göre sırala"
                      >
                        Miktar
                        {expectedSortField === 'amount' ? (
                          expectedExpenseSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-400" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {expectedExpenses
                    .filter(ee => ee.status === 'pending')
                    .sort((a, b) => {
                      let diff = 0;
                      if (expectedSortField === 'date') {
                        const dateA = a.expectedDate instanceof Date ? a.expectedDate : (a.expectedDate as any)?.seconds ? new Date((a.expectedDate as any).seconds * 1000) : new Date(a.expectedDate);
                        const dateB = b.expectedDate instanceof Date ? b.expectedDate : (b.expectedDate as any)?.seconds ? new Date((b.expectedDate as any).seconds * 1000) : new Date(b.expectedDate);
                        diff = dateA.getTime() - dateB.getTime();
                      } else if (expectedSortField === 'title') {
                        diff = (a.sourceName || '').localeCompare(b.sourceName || '', 'tr');
                      } else if (expectedSortField === 'category') {
                        const catA = categories.find(c => c.id === a.categoryId)?.name || '';
                        const catB = categories.find(c => c.id === b.categoryId)?.name || '';
                        diff = catA.localeCompare(catB, 'tr');
                      } else if (expectedSortField === 'amount') {
                        diff = a.amount - b.amount;
                      }
                      return expectedExpenseSortOrder === 'asc' ? diff : -diff;
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

      {/* Taksitli Harcamalar (Taksit Takibi) */}
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            Taksitli Harcamalar (Taksit Takibi)
          </h2>
          {installmentGroups.length > 0 && (
            <span className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              {installmentGroups.length} Aktif Taksitli Harcama
            </span>
          )}
        </div>

        {installmentGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {installmentGroups.map(group => {
              const isExpanded = expandedInstallmentKey === group.key;

              return (
                <div key={group.key} className="corporate-card p-6 bg-zinc-950/50 border border-zinc-800/80 rounded-3xl space-y-4 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                          {group.paidCount}/{group.installmentCount} Taksit
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">{group.categoryName}</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-foreground mt-1.5">{group.description}</h3>
                      <p className="text-xs text-zinc-500 font-medium">{group.accountName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Aylık Taksit</div>
                        <div className="text-xl font-black text-rose-400">{formatWithEquivalent(group.monthlyAmount, group.currency)}</div>
                      </div>
                      <button 
                        onClick={() => setDeleteConfirm({
                          id: group.installments[0]?.id || group.key,
                          isInstallmentGroup: true,
                          parentTransactionId: group.parentTransactionId || group.installments[0]?.parentTransactionId || group.installments[0]?.id,
                          title: 'Taksitli Harcamayı Sil',
                          message: `${group.description} taksit planındaki tüm (${group.installmentCount}) taksiti silmek istediğinizden emin misiniz?`
                        })}
                        className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-zinc-800/80 bg-zinc-900/60"
                        title="Tüm Taksit Grubunu Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-900/60 rounded-2xl text-center border border-zinc-800/50">
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block">Toplam Tutar</span>
                      <span className="text-xs font-extrabold text-foreground">{formatWithEquivalent(group.totalAmount, group.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block">Ödenen</span>
                      <span className="text-xs font-extrabold text-emerald-400">{formatWithEquivalent(group.paidAmount, group.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block">Kalan Borç</span>
                      <span className="text-xs font-extrabold text-amber-400">{formatWithEquivalent(group.remainingAmount, group.currency)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-400">Taksit İlerlemesi</span>
                      <span className="text-indigo-400 font-bold">
                        {group.paidCount} / {group.installmentCount} Ödendi ({group.remainingCount} Kalan)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, group.progress)}%` }}
                      />
                    </div>
                  </div>

                  {group.nextInstallmentDate && (
                    <div className="flex items-center justify-between pt-1 text-xs text-zinc-400 border-t border-zinc-900">
                      <span>Gelecek / Son Taksit Vadesi:</span>
                      <span className="font-bold text-zinc-200">
                        {group.nextInstallmentDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setExpandedInstallmentKey(isExpanded ? null : group.key)}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-zinc-800/60"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" /> Taksit Detaylarını Gizle
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" /> Tüm Taksit Vadelerini Gör ({group.installmentCount} Taksit)
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-2 pt-2 border-t border-zinc-800"
                      >
                        <div className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Taksit Planı</div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {group.installments.map((instTx) => {
                            const instDate = new Date(instTx.date);
                            const isPast = instDate <= new Date();
                            return (
                              <div 
                                key={instTx.id} 
                                className={`flex justify-between items-center p-2.5 rounded-xl text-xs border ${
                                  isPast ? 'bg-zinc-900/40 border-zinc-900 text-zinc-400' : 'bg-indigo-500/5 border-indigo-500/20 text-zinc-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isPast ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                  <span className="font-bold">{instTx.installmentNumber}. Taksit:</span>
                                  <span>{instDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold">{formatWithEquivalent(instTx.amount, instTx.currency || 'TRY')}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    isPast ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                  }`}>
                                    {isPast ? 'İşlendi' : 'Bekliyor'}
                                  </span>
                                  <button 
                                    onClick={() => setDeleteConfirm({
                                      id: instTx.id,
                                      isInstallmentGroup: false,
                                      title: 'Taksit Sil',
                                      message: `${instTx.description} (${instTx.installmentNumber}. taksit) işlemini silmek istediğinizden emin misiniz?`
                                    })}
                                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-zinc-800/60"
                                    title="Bu Taksiti Sil"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-950/40 border border-dashed border-zinc-900 rounded-3xl space-y-2">
            <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-1" />
            <p className="text-sm font-semibold text-muted-foreground">Aktif taksitli harcama kaydınız bulunmuyor.</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Yeni bir harcama eklerken "Taksitli İşlem" seçeneğini açarak taksit sayısı belirleyebilirsiniz. Taksitler otomatik olarak aylara bölünüp burada takip edilir.
            </p>
          </div>
        )}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-rose-500" />
            Son Harcamalar
          </h2>
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800 self-start">
            <button
              onClick={() => setTxFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                txFilter === 'all' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tümü ({expenseTransactions.length})
            </button>
            <button
              onClick={() => setTxFilter('single')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                txFilter === 'single' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tek Çekim
            </button>
            <button
              onClick={() => setTxFilter('installment')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                txFilter === 'installment' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Taksitli
            </button>
          </div>
        </div>

        <div className="corporate-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleTxSort('date')}
                    className="flex items-center gap-1.5 hover:text-rose-400 transition-colors"
                    title="Tarihe göre sırala"
                  >
                    Tarih
                    {txSortField === 'date' ? (
                      txSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> : <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleTxSort('description')}
                    className="flex items-center gap-1.5 hover:text-rose-400 transition-colors"
                    title="Açıklamaya göre sırala"
                  >
                    Açıklama
                    {txSortField === 'description' ? (
                      txSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> : <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleTxSort('category')}
                    className="flex items-center gap-1.5 hover:text-rose-400 transition-colors"
                    title="Kategoriye göre sırala"
                  >
                    Kategori
                    {txSortField === 'category' ? (
                      txSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> : <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  <button 
                    onClick={() => toggleTxSort('amount')}
                    className="flex items-center gap-1.5 ml-auto hover:text-rose-400 transition-colors"
                    title="Tutara göre sırala"
                  >
                    Tutar
                    {txSortField === 'amount' ? (
                      txSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> : <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-16">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredExpenseTransactions.length > 0 ? (
                (showAllTx ? filteredExpenseTransactions : filteredExpenseTransactions.slice(0, 10)).map(tx => {
                  const category = categories.find(c => c.id === tx.categoryId || c.id === tx.debitAccountId);
                  const isInst = tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1);
                  const totalInstAmount = isInst && tx.installmentCount ? tx.amount * tx.installmentCount : tx.amount;
                  const remainingInst = isInst && tx.installmentCount && tx.installmentNumber ? tx.installmentCount - tx.installmentNumber : 0;

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-zinc-400 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{tx.description}</span>
                          {isInst && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold">
                              Taksit {tx.installmentNumber}/{tx.installmentCount}
                            </span>
                          )}
                        </div>
                        {isInst && (
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Aylık: <span className="font-bold text-zinc-300">{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}</span> | Toplam: <span className="font-bold text-zinc-300">{formatWithEquivalent(totalInstAmount, tx.currency || 'TRY')}</span> ({remainingInst} taksit kaldı)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                          <Tag className="w-3 h-3" />
                          {category?.name || 'Gider'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-rose-500 text-right whitespace-nowrap">
                        -{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                        {onEditTransaction && (
                          <button 
                            onClick={() => onEditTransaction(tx)}
                            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-zinc-800/60 bg-zinc-900/40"
                            title="Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            const isInstGroup = (tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1)) && (tx.installmentNumber === 1 || !tx.installmentNumber);
                            setDeleteConfirm({
                              id: tx.id,
                              isInstallmentGroup: isInstGroup,
                              parentTransactionId: tx.parentTransactionId || tx.id,
                              title: isInstGroup ? 'Taksitli Harcamayı Sil' : 'İşlemi Sil',
                              message: isInstGroup 
                                ? `${tx.description} taksitli harcamasını ve bağlı tüm taksitlerini silmek istediğinizden emin misiniz?`
                                : `${tx.description} harcamasını silmek istediğinizden emin misiniz? Bu işlem hesap bakiyelerini de güncelleyecektir.`
                            });
                          }}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-zinc-800/60 bg-zinc-900/40"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                    Seçilen filtreye uygun harcama kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filteredExpenseTransactions.length > 10 && (
            <div className="p-4 border-t border-zinc-800 text-center bg-zinc-950/30">
              <button
                onClick={() => setShowAllTx(!showAllTx)}
                className="text-xs font-bold text-zinc-400 hover:text-white transition-colors py-1 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
              >
                {showAllTx ? 'Daha Az Göster (İlk 10)' : `Tüm Harcamaları Göster (${filteredExpenseTransactions.length} Kayıt)`}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm?.title || ''}
        message={deleteConfirm?.message || ''}
      />
    </div>
  );
};
