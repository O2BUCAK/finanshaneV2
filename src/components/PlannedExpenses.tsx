import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Target, Trash2, Check, X, AlertCircle, TrendingDown, Tag, Wallet, Settings } from 'lucide-react';
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
}

const EXPENSE_FLOW_OPTIONS = [
  { id: 'fixed', label: 'Sabit (Kira vb.)', description: 'Kira, aidat gibi düzenli giderler' },
  { id: 'subscription', label: 'Abonelik', description: 'Netflix, Spotify, internet gibi servisler' },
  { id: 'variable', label: 'Değişken', description: 'Fatura gibi miktarı değişen düzenli giderler' },
];

export const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ householdId, categories, accounts, members, isPrivacyMode = false }) => {
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PlannedExpense | null>(null);
  const [editingSource, setEditingSource] = useState<ExpenseSource | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; type: 'planned' | 'source' | 'expected' } | null>(null);

  // Form State for Planned
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Source
  const [sourceName, setSourceName] = useState('');
  const [sourceOwnerId, setSourceOwnerId] = useState('');
  const [sourceFlowType, setSourceFlowType] = useState<ExpenseFlowType>('fixed');
  const [sourceAmount, setSourceAmount] = useState('');
  const [sourceCurrency, setSourceCurrency] = useState('TRY');
  const [sourceCategoryId, setSourceCategoryId] = useState('');
  const [sourceAccId, setSourceAccId] = useState('');
  const [sourcePeriodDay, setSourcePeriodDay] = useState('1');

  const openModal = (expense?: PlannedExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setTitle(expense.title);
      setOwnerId(expense.ownerId || '');
      setAmount(expense.amount.toString());
      setCurrency(expense.currency);
      setDueDate(new Date(expense.dueDate).toISOString().split('T')[0]);
      setCategoryId(expense.categoryId);
      setSourceAccountId(expense.sourceAccountId || '');
    } else {
      setEditingExpense(null);
      setTitle('');
      setOwnerId(user?.uid || Object.keys(members || {})[0] || '');
      setAmount('');
      setCurrency('TRY');
      setDueDate(new Date().toISOString().split('T')[0]);
      setCategoryId(categories.find(c => c.type === 'expense')?.id || '');
      setSourceAccountId('');
    }
    setIsModalOpen(true);
  };

  const openSourceModal = (source?: ExpenseSource) => {
    if (source) {
      setEditingSource(source);
      setSourceName(source.name);
      setSourceOwnerId(source.ownerId);
      setSourceFlowType(source.flowType);
      setSourceAmount(source.amount.toString());
      setSourceCurrency(source.currency);
      setSourceCategoryId(source.categoryId);
      setSourceAccId(source.sourceAccountId);
      setSourcePeriodDay(source.periodDay?.toString() || '1');
    } else {
      setEditingSource(null);
      setSourceName('');
      setSourceOwnerId(user?.uid || Object.keys(members || {})[0] || '');
      setSourceFlowType('fixed');
      setSourceAmount('');
      setSourceCurrency('TRY');
      setSourceCategoryId(categories.find(c => c.type === 'expense')?.id || '');
      setSourceAccId('');
      setSourcePeriodDay('1');
    }
    setIsSourceModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const expenseData = {
        title,
        ownerId,
        amount: parseFloat(amount),
        currency,
        dueDate: new Date(dueDate),
        status: editingExpense ? editingExpense.status : 'pending' as const,
        categoryId,
        sourceAccountId: sourceAccountId || undefined,
      };

      if (editingExpense) {
        await updatePlannedExpense(householdId, editingExpense.id, expenseData);
      } else {
        await createPlannedExpense(householdId, expenseData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving planned expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const sourceData = {
        name: sourceName,
        ownerId: sourceOwnerId,
        flowType: sourceFlowType,
        amount: parseFloat(sourceAmount),
        currency: sourceCurrency,
        categoryId: sourceCategoryId,
        sourceAccountId: sourceAccId,
        periodDay: parseInt(sourcePeriodDay),
      };

      if (editingSource) {
        await updateExpenseSource(householdId, editingSource.id, sourceData);
      } else {
        await createExpenseSource(householdId, sourceData);
      }
      setIsSourceModalOpen(false);
    } catch (error) {
      console.error("Error saving expense source:", error);
    } finally {
      setIsSubmitting(false);
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
        debitAccountId: expected.categoryId, // Expense category
        creditAccountId: expected.sourceAccountId, // Asset account
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
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bütçe Planlama</h1>
          <p className="text-muted-foreground font-medium mt-1">Gelecek harcamalarınızı ve aboneliklerinizi yönetin.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => activeView === 'planned' ? openModal() : openSourceModal()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" /> {activeView === 'planned' ? 'Yeni Plan' : 'Yeni Abonelik/Kira'}
          </button>
        </div>
      </div>

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
        <div className="corporate-card p-6">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Target className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Toplam Planlanan</span>
          </div>
          <div className="text-3xl font-bold text-foreground">
            {formatWithEquivalent(totalPlanned, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-6">
          <div className="flex items-center gap-3 text-muted-foreground mb-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Ödenen</span>
          </div>
          <div className="text-3xl font-bold text-emerald-500">
            {formatWithEquivalent(totalPaid, 'TRY')}
          </div>
        </div>
        <div className="corporate-card p-6">
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
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || 'var(--muted-foreground)' }} />
                              <span className="text-sm font-medium text-muted-foreground">{category?.name || 'Kategorisiz'}</span>
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

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                <h2 className="text-xl font-bold text-foreground">
                  {editingExpense ? 'Planı Düzenle' : 'Yeni Harcama Planı'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-secondary rounded-xl text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Harcamayı Yapan</label>
                  <select 
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                  >
                    {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                      <option key={id} value={id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Harcama Başlığı</label>
                  <input 
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Kira, Elektrik Faturası..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Miktar</label>
                    <input 
                      type="text"
                      required
                      value={formatAmount(amount)}
                      onChange={(e) => setAmount(parseAmount(cleanAmountInput(e.target.value)))}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Para Birimi</label>
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-bold"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vade Tarihi</label>
                    <input 
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kategori</label>
                    <select 
                      required
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                    >
                      {categories.filter(c => c.type === 'expense').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ödeme Hesabı (Opsiyonel)</label>
                  <select 
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                  >
                    <option value="">Hesap Seçilmedi</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({formatWithEquivalent(acc.balance, acc.currency || 'TRY')})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-all border border-border"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    {isSubmitting ? 'Kaydediliyor...' : editingExpense ? 'Güncelle' : 'Planı Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Source Modal */}
      <AnimatePresence>
        {isSourceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSourceModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/30">
                <h2 className="text-xl font-bold text-foreground">
                  {editingSource ? 'Düzenli Ödemeyi Düzenle' : 'Yeni Düzenli Ödeme Kaynağı'}
                </h2>
                <button onClick={() => setIsSourceModalOpen(false)} className="p-2 hover:bg-secondary rounded-xl text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSourceSubmit} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sorumlu</label>
                  <select 
                    value={sourceOwnerId}
                    onChange={(e) => setSourceOwnerId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                  >
                    {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                      <option key={id} value={id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ödeme Adı</label>
                  <input 
                    type="text"
                    required
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Örn: Ev Kirası, Netflix, İnternet..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ödeme Türü</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EXPENSE_FLOW_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSourceFlowType(option.id as ExpenseFlowType)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          sourceFlowType === option.id 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'bg-secondary border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        <div className="text-xs font-bold">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Miktar</label>
                    <input 
                      type="text"
                      required
                      value={formatAmount(sourceAmount)}
                      onChange={(e) => setSourceAmount(parseAmount(cleanAmountInput(e.target.value)))}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Para Birimi</label>
                    <select 
                      value={sourceCurrency}
                      onChange={(e) => setSourceCurrency(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-bold"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Her Ayın Günü</label>
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={sourcePeriodDay}
                      onChange={(e) => setSourcePeriodDay(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kategori</label>
                    <select 
                      required
                      value={sourceCategoryId}
                      onChange={(e) => setSourceCategoryId(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                    >
                      {categories.filter(c => c.type === 'expense').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ödeme Yapılacak Hesap</label>
                  <select 
                    required
                    value={sourceAccId}
                    onChange={(e) => setSourceAccId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                  >
                    <option value="">Hesap Seçin</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({formatWithEquivalent(acc.balance, acc.currency || 'TRY')})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsSourceModalOpen(false)}
                    className="flex-1 px-6 py-3 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-all border border-border"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    {isSubmitting ? 'Kaydediliyor...' : editingSource ? 'Güncelle' : 'Kaynağı Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
