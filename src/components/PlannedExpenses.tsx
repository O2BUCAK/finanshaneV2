import React, { useState, useMemo } from 'react';
import { Plus, Calendar, Target, Trash2, Check, X, AlertCircle, TrendingDown, Tag, Wallet, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp, orderBy } from 'firebase/firestore';
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
}

export const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ householdId, categories, accounts, members }) => {
  const { data: plannedExpenses, loading } = useCollection<PlannedExpense>(
    householdId ? `households/${householdId}/plannedExpenses` : '',
    [orderBy('dueDate', 'asc')]
  );

  const { formatWithEquivalent, convertToTRY } = useExchangeRates();

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
      setDueDate(expense.dueDate.toDate().toISOString().split('T')[0]);
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
        dueDate: Timestamp.fromDate(new Date(dueDate)),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bütçe Planlama</h1>
          <p className="text-zinc-100">Gelecek harcamalarınızı planlayın ve takip edin.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Yeni Plan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-zinc-100 mb-2">
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium">Toplam Planlanan</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatWithEquivalent(totalPlanned, 'TRY')}
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-zinc-100 mb-2">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium">Ödenen</span>
          </div>
          <div className="text-2xl font-bold text-emerald-500">
            {formatWithEquivalent(totalPaid, 'TRY')}
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-zinc-100 mb-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-medium">Kalan</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatWithEquivalent(totalPlanned - totalPaid, 'TRY')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-zinc-100">Bütçe İlerlemesi</span>
          <span className="text-sm font-bold text-white">%{progress.toFixed(1)}</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-3">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="bg-emerald-500 h-3 rounded-full"
          />
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-300">Yükleniyor...</div>
        ) : plannedExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Harcamayı Yapan</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Başlık</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Kategori</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Vade</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider text-right">Miktar</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {plannedExpenses.map(expense => {
                  const category = categories.find(c => c.id === expense.categoryId);
                  const isOverdue = expense.status === 'pending' && expense.dueDate.toDate() < new Date();
                  const member = members?.[expense.ownerId];
                  
                  return (
                    <tr key={expense.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => toggleStatus(expense)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            expense.status === 'paid' 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : 'border-zinc-700 hover:border-emerald-500/50'
                          }`}
                        >
                          {expense.status === 'paid' && <Check className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${member?.type === 'child' ? 'bg-blue-500/20 text-blue-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {member?.displayName?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-zinc-100">{member?.displayName || 'Bilinmiyor'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{expense.title}</div>
                        {isOverdue && (
                          <div className="flex items-center gap-1 text-[10px] text-rose-500 font-bold uppercase mt-1">
                            <AlertCircle className="w-3 h-3" /> Gecikti
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || '#52525b' }} />
                          <span className="text-sm text-zinc-200">{category?.name || 'Kategorisiz'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-zinc-200">
                          {expense.dueDate.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-bold ${expense.status === 'paid' ? 'text-zinc-200 line-through' : 'text-white'}`}>
                          {formatWithEquivalent(expense.amount, expense.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openModal(expense)}
                            className="p-2 hover:bg-white/5 rounded-xl text-zinc-100 hover:text-white transition-all"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(expense.id)}
                            className="p-2 hover:bg-rose-500/10 rounded-xl text-zinc-200 hover:text-rose-500 transition-all"
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
          <div className="p-12 text-center text-zinc-200">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Henüz planlanmış bir harcama bulunmuyor.</p>
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
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  {editingExpense ? 'Planı Düzenle' : 'Yeni Harcama Planı'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Harcamayı Yapan</label>
                  <select 
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
                  >
                    {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                      <option key={id} value={id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Harcama Başlığı</label>
                  <input 
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Kira, Elektrik Faturası..."
                    className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Miktar</label>
                    <input 
                      type="text"
                      required
                      value={formatAmount(amount)}
                      onChange={(e) => setAmount(parseAmount(cleanAmountInput(e.target.value)))}
                      className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Para Birimi</label>
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Vade Tarihi</label>
                    <input 
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Kategori</label>
                    <select 
                      required
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
                    >
                      {categories.filter(c => c.type === 'expense').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Ödeme Hesabı (Opsiyonel)</label>
                  <select 
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
                  >
                    <option value="">Hesap Seçilmedi</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({formatWithEquivalent(acc.balance, acc.currency || 'TRY')})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-2 px-8 py-3 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
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
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl p-6 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Planı Sil?</h3>
              <p className="text-zinc-100 mb-6">Bu harcama planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                >
                  İptal
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all"
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
