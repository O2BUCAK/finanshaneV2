import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Target, Trash2, Check, X, AlertCircle, TrendingDown, Tag, Wallet, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlannedExpense, Category, Account } from '../types';
import { useCollection } from '../hooks/useFirestore';
import { createPlannedExpense, updatePlannedExpense, deletePlannedExpense } from '../lib/plannedExpenses';
import { formatAmount, parseAmount, cleanAmountInput } from '../utils/formatters';
import { useExchangeRates } from '../hooks/useExchangeRates';

interface PlannedExpensesProps {
  householdId?: string;
  categories: Account[];
  accounts: Account[];
  members?: Record<string, any>;
  isPrivacyMode?: boolean;
}

export const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ householdId, categories, accounts, members, isPrivacyMode = false }) => {
  const { data: plannedExpenses, loading } = useCollection<PlannedExpense>(
    householdId ? `households/${householdId}/plannedExpenses` : ''
  );

  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PlannedExpense | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModal = (expense?: PlannedExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setTitle(expense.title);
      setOwnerId(expense.ownerId || '');
      setAmount(expense.amount.toString());
      setCurrency(expense.currency);
      setDueDate(expense.dueDate.toISOString().split('T')[0]);
      setCategoryId(expense.categoryId);
      setSourceAccountId(expense.sourceAccountId || '');
    } else {
      setEditingExpense(null);
      setTitle('');
      setOwnerId(Object.keys(members || {})[0] || '');
      setAmount('');
      setCurrency('TRY');
      setDueDate(new Date().toISOString().split('T')[0]);
      setCategoryId(categories.find(c => c.type === 'expense')?.id || '');
      setSourceAccountId('');
    }
    setIsModalOpen(true);
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

  const handleDelete = async (id: string) => {
    if (!householdId) return;
    setExpenseToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!householdId || !expenseToDelete) return;
    try {
      await deletePlannedExpense(householdId, expenseToDelete);
      setIsDeleteConfirmOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting planned expense:", error);
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

  const totalPlanned = useMemo(() => {
    return plannedExpenses.reduce((sum, exp) => sum + convertToTRY(exp.amount, exp.currency), 0);
  }, [plannedExpenses, convertToTRY]);

  const totalPaid = useMemo(() => {
    return plannedExpenses
      .filter(exp => exp.status === 'paid')
      .reduce((sum, exp) => sum + convertToTRY(exp.amount, exp.currency), 0);
  }, [plannedExpenses, convertToTRY]);

  const progress = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bütçe Planlama</h1>
          <p className="text-muted-foreground font-medium mt-1">Gelecek harcamalarınızı planlayın ve nakit akışınızı yönetin.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> Yeni Plan
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
                  const isOverdue = expense.status === 'pending' && expense.dueDate < new Date();
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
                            onClick={() => handleDelete(expense.id)}
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
