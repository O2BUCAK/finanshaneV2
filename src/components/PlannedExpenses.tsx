import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Target, Trash2, Check, X, AlertCircle, TrendingDown, Tag, Wallet, Settings, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlannedExpense, Category, Account, ExpenseSource, ExpectedExpense, ExpenseFlowType } from '../types';
import { useCollection } from '../hooks/useFirestore';
import { createPlannedExpense, updatePlannedExpense, deletePlannedExpense } from '../lib/plannedExpenses';
import { createExpenseSource, updateExpenseSource, deleteExpenseSource, updateExpectedExpense, createExpectedExpense } from '../lib/expenseSources';
import { createLedgerTransaction } from '../lib/ledger';
import { formatAmount, parseAmount, cleanAmountInput } from '../utils/formatters';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useAuth } from '../hooks/useAuth';

interface PlannedExpensesProps {
  householdId?: string;
  categories: Account[];
  accounts: Account[];
  members?: Record<string, any>;
  isPrivacyMode?: boolean;
  onAddPlannedExpense?: () => void;
  onAddSubscription?: () => void;
  onEditPlannedExpense?: (expense: PlannedExpense) => void;
  onEditExpenseSource?: (source: any) => void;
}

const EXPENSE_FLOW_OPTIONS = [
  { id: 'fixed', label: 'Sabit (Kira vb.)', description: 'Kira, aidat gibi düzenli giderler' },
  { id: 'subscription', label: 'Abonelik', description: 'Netflix, Spotify, internet gibi servisler' },
  { id: 'variable', label: 'Değişken', description: 'Fatura gibi miktarı değişen düzenli giderler' },
];

export const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ 
  householdId, 
  categories, 
  accounts, 
  members, 
  isPrivacyMode = false,
  onAddPlannedExpense,
  onAddSubscription,
  onEditPlannedExpense,
  onEditExpenseSource
}) => {
  const { user } = useAuth();
  const { data: plannedExpenses, loading: plannedLoading } = useCollection<PlannedExpense>(
    householdId ? `households/${householdId}/plannedExpenses` : ''
  );

  const { data: expenseSources, loading: sourcesLoading } = useCollection<ExpenseSource>(
    householdId ? `households/${householdId}/expenseSources` : ''
  );

  const { data: expectedExpenses, loading: expectedLoading } = useCollection<ExpectedExpense>(
    householdId ? `households/${householdId}/expectedExpenses` : ''
  );

  const loading = plannedLoading || sourcesLoading || expectedLoading;

  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);

  const [activeView, setActiveView] = useState<'planned' | 'recurring'>('planned');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; type: 'planned' | 'source' | 'expected' } | null>(null);

  const openModal = (expense?: PlannedExpense) => {
    if (expense) {
      onEditPlannedExpense?.(expense);
    } else {
      onAddPlannedExpense?.();
    }
  };

  const openSourceModal = (source?: ExpenseSource) => {
    if (source) {
      onEditExpenseSource?.(source);
    } else {
      onAddSubscription?.();
    }
  };

  const handleDelete = async (id: string, type: 'planned' | 'source' | 'expected') => {
    if (!householdId) return;
    setExpenseToDelete({ id, type });
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!householdId || !expenseToDelete) return;
    try {
      if (expenseToDelete.type === 'planned') {
        await deletePlannedExpense(householdId, expenseToDelete.id);
      } else if (expenseToDelete.type === 'source') {
        await deleteExpenseSource(householdId, expenseToDelete.id);
      } else if (expenseToDelete.type === 'expected') {
        await updateExpectedExpense(householdId, expenseToDelete.id, { status: 'cancelled' });
      }
      setIsDeleteConfirmOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const toggleStatus = async (expense: PlannedExpense) => {
    if (!householdId) return;
    try {
      await updatePlannedExpense(householdId, expense.id, {
        status: expense.status === 'pending' ? 'paid' : 'pending'
      });
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleApproveExpectedExpense = async (expected: ExpectedExpense) => {
    if (!householdId || !user) return;
    
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
        const nextDate = new Date(expected.expectedDate);
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
          targetAccountId: source.targetAccountId,
          ownerId: source.ownerId,
        });
      }
    } catch (error) {
      console.error('Approve expected expense error:', error);
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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-secondary rounded-2xl w-fit">
        <button
          onClick={() => setActiveView('planned')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'planned' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Planlanan Giderler
        </button>
        <button
          onClick={() => setActiveView('recurring')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'recurring' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Düzenli Ödemeler (Kira, Abonelik)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="corporate-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Target className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Planlanan</span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {formatWithEquivalent(totalPlanned, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Ödenen</span>
          </div>
          <div className="text-3xl font-bold text-emerald-500">
            {formatWithEquivalent(totalPaid, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <span className="text-xs font-bold uppercase tracking-wider">Kalan Ödeme</span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {formatWithEquivalent(totalPlanned - totalPaid, 'TRY')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="corporate-card p-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-bold text-foreground uppercase tracking-wide">Bütçe İlerlemesi</span>
          <span className="text-sm font-bold text-primary">%{progress.toFixed(1)}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="bg-primary h-full rounded-full shadow-sm"
          />
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-8">
        {activeView === 'planned' ? (
          <div className="corporate-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground font-medium">Veriler yükleniyor...</div>
            ) : plannedExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Durum</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sorumlu</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Başlık</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kategori</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vade</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Miktar</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plannedExpenses.map(expense => {
                      const category = categories.find(c => c.id === expense.categoryId);
                      const isOverdue = expense.status === 'pending' && new Date(expense.dueDate) < new Date();
                      const member = members?.[expense.ownerId];
                      
                      return (
                        <tr key={expense.id} className="group hover:bg-secondary/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button 
                              onClick={() => toggleStatus(expense)}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                expense.status === 'paid' 
                                  ? 'bg-emerald-500 border-emerald-500 text-white' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              {expense.status === 'paid' && <Check className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border border-border ${member?.type === 'child' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                                {member?.displayName?.charAt(0) || '?'}
                              </div>
                              <span className="text-sm font-medium text-foreground">{member?.displayName || 'Bilinmiyor'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-foreground">{expense.title}</div>
                            {isOverdue && (
                              <div className="flex items-center gap-1 text-[10px] text-destructive font-bold uppercase mt-1">
                                <AlertCircle className="w-3 h-3" /> Gecikti
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {expense.categoryId === 'transfer' ? (
                                <>
                                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {accounts.find(a => a.id === expense.sourceAccountId)?.name} → {accounts.find(a => a.id === expense.targetAccountId)?.name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || 'var(--muted-foreground)' }} />
                                  <span className="text-sm font-medium text-muted-foreground">{category?.name || 'Kategorisiz'}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-muted-foreground">
                              {expense.dueDate ? new Date(expense.dueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className={`text-sm font-bold ${expense.status === 'paid' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {formatWithEquivalent(expense.amount, expense.currency)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openModal(expense)}
                                className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(expense.id, 'planned')}
                                className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Harcama planı bulunmuyor</p>
                <p className="text-sm text-muted-foreground font-medium">Henüz planlanmış bir harcama bulunmuyor.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Bekleyen Ödemeler */}
            <div className="corporate-card overflow-hidden">
              <div className="p-6 border-b border-border bg-secondary/10">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Bekleyen Ödemeler
                </h3>
              </div>
              {expectedExpenses.filter(ee => ee.status === 'pending').length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vade</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kaynak</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kategori</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Miktar</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expectedExpenses
                        .filter(ee => ee.status === 'pending')
                        .sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime())
                        .map(ee => {
                          const category = categories.find(c => c.id === ee.categoryId);
                          const isOverdue = new Date(ee.expectedDate) < new Date();
                          
                          return (
                            <tr key={ee.id} className="group hover:bg-secondary/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-bold ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                                  {new Date(ee.expectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                </div>
                                {isOverdue && <div className="text-[10px] font-bold text-destructive uppercase">Gecikti</div>}
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
                                    onClick={() => handleApproveExpectedExpense(ee)}
                                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" /> Öde
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(ee.id, 'expected')}
                                    className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all"
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
              ) : (
                <div className="p-12 text-center text-muted-foreground font-medium">Yaklaşan ödeme bulunmuyor.</div>
              )}
            </div>

            {/* Ödeme Kaynakları */}
            <div className="corporate-card overflow-hidden">
              <div className="p-6 border-b border-border bg-secondary/10">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" /> Ödeme Kaynakları (Abonelikler, Kira vb.)
                </h3>
              </div>
              {expenseSources.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kaynak Adı</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tür</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Periyot</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Miktar</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expenseSources.map(source => {
                        const flowOption = EXPENSE_FLOW_OPTIONS.find(o => o.id === source.flowType);
                        return (
                          <tr key={source.id} className="group hover:bg-secondary/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-foreground">{source.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase">
                                {flowOption?.label || source.flowType}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-muted-foreground">Her ayın {source.periodDay}. günü</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="text-sm font-bold text-foreground">
                                {formatWithEquivalent(source.amount, source.currency)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => openSourceModal(source)}
                                  className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(source.id, 'source')}
                                  className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground font-medium">Kayıtlı ödeme kaynağı bulunmuyor.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Planı Sil?</h3>
              <p className="text-muted-foreground font-medium mb-8">Bu harcama planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-all border border-border"
                >
                  İptal
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
                >
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
