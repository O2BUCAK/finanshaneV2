import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Plus, Calendar, ArrowUpRight, 
  Clock, Wallet, Briefcase, Target, Trash2, Pencil, Check, X,
  ArrowDown, ArrowUp, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IncomeSource, ExpectedIncome, Account, Transaction } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { deleteIncomeSource, deleteExpectedIncome } from '../lib/incomeSources';
import { deleteLedgerTransaction } from '../lib/ledger';
import { formatAmount, parseAmount, cleanAmountInput } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';

interface IncomeViewProps {
  householdId: string;
  incomeSources: IncomeSource[];
  expectedIncomes: ExpectedIncome[];
  transactions: Transaction[];
  accounts: Account[];
  onAddIncome: () => void;
  onEditIncome: (source: IncomeSource) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onAddAccount?: () => void;
  onApproveIncome: (expected: ExpectedIncome, customAmount?: number) => void;
  onCancelIncome: (expected: ExpectedIncome) => void;
  isPrivacyMode?: boolean;
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  householdId,
  incomeSources,
  expectedIncomes,
  transactions,
  accounts,
  onAddIncome,
  onEditIncome,
  onEditTransaction,
  onAddAccount,
  onApproveIncome,
  onCancelIncome,
  isPrivacyMode = false
}) => {
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'source' | 'expected' | 'transaction';
    title: string;
    message: string;
  } | null>(null);

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteIncomeSource(householdId, id);
    } catch (error) {
      console.error('Error deleting income source:', error);
    }
  };

  const handleDeleteExpected = async (id: string) => {
    try {
      await deleteExpectedIncome(householdId, id);
    } catch (error) {
      console.error('Error deleting expected income:', error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteLedgerTransaction(householdId, id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const pendingIncomes = expectedIncomes.filter(i => i.status === 'pending');

  const startApprove = (income: ExpectedIncome) => {
    setApprovingId(income.id);
    setCustomAmount(income.amount.toString());
  };

  const confirmApprove = (income: ExpectedIncome) => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;
    onApproveIncome(income, amount);
    setApprovingId(null);
  };

  const [incomeSortField, setIncomeSortField] = useState<'date' | 'description' | 'account' | 'amount'>('date');
  const [incomeSortOrder, setIncomeSortOrder] = useState<'desc' | 'asc'>('desc');

  const toggleIncomeSort = (field: 'date' | 'description' | 'account' | 'amount') => {
    if (incomeSortField === field) {
      setIncomeSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setIncomeSortField(field);
      setIncomeSortOrder(field === 'description' || field === 'account' ? 'asc' : 'desc');
    }
  };

  const realizedIncomes = useMemo(() => {
    const list = transactions.filter(tx => {
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      return debitAcc?.type === 'asset' && creditAcc?.type === 'income';
    });

    return [...list].sort((a, b) => {
      let diff = 0;
      if (incomeSortField === 'date') {
        const getTime = (d: any) => {
          if (!d) return 0;
          if (d instanceof Date) return d.getTime();
          if (typeof d === 'number') return d;
          if (d?.seconds) return d.seconds * 1000;
          const parsed = new Date(d).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        diff = getTime(a.date) - getTime(b.date);
      } else if (incomeSortField === 'description') {
        diff = (a.description || '').localeCompare(b.description || '', 'tr');
      } else if (incomeSortField === 'account') {
        const accA = accounts.find(acc => acc.id === a.debitAccountId)?.name || '';
        const accB = accounts.find(acc => acc.id === b.debitAccountId)?.name || '';
        diff = accA.localeCompare(accB, 'tr');
      } else if (incomeSortField === 'amount') {
        diff = a.amount - b.amount;
      }
      return incomeSortOrder === 'asc' ? diff : -diff;
    });
  }, [transactions, accounts, incomeSortField, incomeSortOrder]);

  const assetAccounts = accounts.filter(a => a.type === 'asset');

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Gelir Yönetimi</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Gelir kaynaklarınız ve beklenen ödemeleriniz</p>
        </div>
        <div className="flex items-center gap-3">
          {onAddAccount && (
            <button 
              onClick={onAddAccount}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-3 rounded-2xl font-bold transition-all border border-zinc-700 hover:border-zinc-600 text-sm"
            >
              <Plus className="w-4 h-4 text-emerald-500" />
              Hesap Ekle
            </button>
          )}
          <button 
            onClick={onAddIncome}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 text-sm"
          >
            <Plus className="w-5 h-5" />
            Yeni Gelir Kaynağı
          </button>
        </div>
      </div>

      {assetAccounts.length === 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-300">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-sm">Banka / Varlık Hesabı Bulunamadı</p>
              <p className="text-xs text-amber-400/80">Gelirlerinizin yatırılacağı bir banka veya nakit hesabı eklemeniz önerilir.</p>
            </div>
          </div>
          {onAddAccount && (
            <button
              onClick={onAddAccount}
              className="px-4 py-2 bg-amber-500 text-zinc-950 rounded-xl font-bold hover:bg-amber-400 transition-all text-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Hemen Hesap Ekle
            </button>
          )}
        </div>
      )}

      {/* Beklenen Gelirler */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Beklenen Gelirler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingIncomes.length === 0 && (
            <div className="col-span-full p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-center">
              <p className="text-zinc-500">Yakın zamanda beklenen bir gelir bulunmuyor.</p>
            </div>
          )}
          {pendingIncomes.map(income => {
            const isFuture = (() => {
              const today = new Date();
              today.setHours(23, 59, 59, 999);
              const dateObj = income.expectedDate instanceof Date 
                ? income.expectedDate 
                : (income.expectedDate as any)?.seconds 
                  ? new Date((income.expectedDate as any).seconds * 1000) 
                  : new Date(income.expectedDate);
              return dateObj > today;
            })();

            return (
              <div key={income.id} className="corporate-card p-8 relative group overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                      {new Date(income.expectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </span>
                    <button 
                      onClick={() => setDeleteConfirm({
                        id: income.id,
                        type: 'expected',
                        title: 'Beklenen Geliri Sil',
                        message: `${income.sourceName} için beklenen bu geliri silmek istediğinizden emin misiniz?`
                      })}
                      className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-white mb-1">{income.sourceName}</h3>
                <p className="text-2xl font-bold text-emerald-500 mb-4">
                  {formatWithEquivalent(income.amount, income.currency || 'TRY')}
                </p>
                
                <AnimatePresence mode="wait">
                  {approvingId === income.id ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Yatan Net Tutar</label>
                        <div className="relative">
                          <input 
                            type="text"
                            autoFocus
                            value={formatAmount(customAmount)}
                            onChange={(e) => setCustomAmount(parseAmount(cleanAmountInput(e.target.value)))}
                            className="w-full bg-zinc-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">{income.currency || 'TRY'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => confirmApprove(income)}
                          className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Check className="w-4 h-4" /> Onayla
                        </button>
                        <button 
                          onClick={() => setApprovingId(null)}
                          className="p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex gap-2">
                      <motion.button 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        disabled={isFuture}
                        onClick={() => !isFuture && startApprove(income)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          isFuture 
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white'
                        }`}
                        title={isFuture ? 'Tarihi gelmediği için henüz tahsil edilemez.' : undefined}
                      >
                        Tahsil Edildi
                      </motion.button>
                      <motion.button 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => onCancelIncome(income)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all"
                        title="Tahsil Edilemedi (İptal Et)"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gelir Kaynakları */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-blue-500" />
          Aktif Gelir Kaynakları
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {incomeSources.map(source => (
            <div 
              key={source.id} 
              onClick={() => onEditIncome(source)}
              className="corporate-card p-8 relative group overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                      source.flowType === 'fixed' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {source.flowType === 'fixed' ? 'Sabit' : source.flowType === 'variable' ? 'Değişken' : 'Spot'}
                    </span>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Her ayın {source.periodDay}. günü</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({
                        id: source.id,
                        type: 'source',
                        title: 'Gelir Kaynağını Sil',
                        message: `${source.name} gelir kaynağını ve buna bağlı tüm bekleyen gelecek gelirleri silmek istediğinizden emin misiniz?`
                      });
                    }}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="font-black text-foreground tracking-tight">{source.name}</h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-xl font-black text-foreground tracking-tighter">
                    {source.calculationType === 'daily_rate' && source.dailyRate
                      ? formatWithEquivalent(Number(source.dailyRate), source.currency || 'TRY')
                      : formatWithEquivalent(source.amount, source.currency || 'TRY')}
                  </p>
                  {source.calculationType === 'daily_rate' && (
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">/ GÜNLÜK</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Son Gelir İşlemleri */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5 text-emerald-500" />
          Son Gelir İşlemleri
        </h2>
        <div className="corporate-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleIncomeSort('date')}
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                    title="Tarihe göre sırala"
                  >
                    Tarih
                    {incomeSortField === 'date' ? (
                      incomeSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleIncomeSort('description')}
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                    title="Açıklamaya göre sırala"
                  >
                    Açıklama
                    {incomeSortField === 'description' ? (
                      incomeSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <button 
                    onClick={() => toggleIncomeSort('account')}
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
                    title="Hesaba göre sırala"
                  >
                    Hesap
                    {incomeSortField === 'account' ? (
                      incomeSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">
                  <button 
                    onClick={() => toggleIncomeSort('amount')}
                    className="flex items-center gap-1.5 ml-auto hover:text-emerald-400 transition-colors"
                    title="Tutara göre sırala"
                  >
                    Tutar
                    {incomeSortField === 'amount' ? (
                      incomeSortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {realizedIncomes.slice(0, 10).map(tx => (
                <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {new Date(tx.date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {tx.description}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {accounts.find(a => a.id === tx.debitAccountId)?.name}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-500 text-right">
                    +{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
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
                      onClick={() => setDeleteConfirm({
                        id: tx.id,
                        type: 'transaction',
                        title: 'İşlemi Sil',
                        message: `${tx.description} işlemini silmek istediğinizden emin misiniz? Bu işlem hesap bakiyelerini de etkileyecektir.`
                      })}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-zinc-800/60 bg-zinc-900/40"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.type === 'source') handleDeleteSource(deleteConfirm.id);
          if (deleteConfirm.type === 'expected') handleDeleteExpected(deleteConfirm.id);
          if (deleteConfirm.type === 'transaction') handleDeleteTransaction(deleteConfirm.id);
        }}
        title={deleteConfirm?.title || ''}
        message={deleteConfirm?.message || ''}
      />
    </div>
  );
};
