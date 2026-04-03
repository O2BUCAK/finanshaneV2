import React from 'react';
import { 
  TrendingUp, Plus, Calendar, ArrowUpRight, 
  Clock, Wallet, Briefcase, Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { IncomeSource, ExpectedIncome, Account, Transaction } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';

interface IncomeViewProps {
  householdId: string;
  incomeSources: IncomeSource[];
  expectedIncomes: ExpectedIncome[];
  transactions: Transaction[];
  accounts: Account[];
  onAddIncome: () => void;
  onEditIncome: (source: IncomeSource) => void;
  onApproveIncome: (expected: ExpectedIncome) => void;
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
  onApproveIncome,
  isPrivacyMode = false
}) => {
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);

  const pendingIncomes = expectedIncomes.filter(i => i.status === 'pending');
  const realizedIncomes = transactions.filter(tx => {
    const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
    const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
    return debitAcc?.type === 'asset' && creditAcc?.type === 'income';
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Gelir Yönetimi</h1>
          <p className="text-zinc-400 font-medium mt-1">Gelir kaynaklarınız ve beklenen ödemeleriniz</p>
        </div>
        <button 
          onClick={onAddIncome}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Yeni Gelir Kaynağı
        </button>
      </div>

      {/* Beklenen Gelirler */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Beklenen Gelirler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingIncomes.length === 0 && (
            <div className="col-span-full p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-center">
              <p className="text-zinc-500">Yakın zamanda beklenen bir gelir bulunmuyor.</p>
            </div>
          )}
          {pendingIncomes.map(income => (
            <div key={income.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl hover:border-emerald-500/30 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                  {new Date(income.expectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                </span>
              </div>
              <h3 className="font-bold text-white mb-1">{income.sourceName}</h3>
              <p className="text-2xl font-bold text-emerald-500 mb-4">
                {formatWithEquivalent(income.amount, income.currency || 'TRY')}
              </p>
              <button 
                onClick={() => onApproveIncome(income)}
                className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                Tahsil Edildi Olarak İşaretle
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Gelir Kaynakları */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-blue-500" />
          Aktif Gelir Kaynakları
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incomeSources.map(source => (
            <div 
              key={source.id} 
              onClick={() => onEditIncome(source)}
              className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl hover:border-emerald-500/30 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  source.flowType === 'fixed' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {source.flowType === 'fixed' ? 'Sabit' : source.flowType === 'variable' ? 'Değişken' : 'Spot'}
                </span>
                <span className="text-xs text-zinc-500">Her ayın {source.periodDay}. günü</span>
              </div>
              <h3 className="font-bold text-white">{source.name}</h3>
              <p className="text-lg font-bold text-zinc-300 mt-1">
                {formatWithEquivalent(source.amount, source.currency || 'TRY')}
              </p>
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Açıklama</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Hesap</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {realizedIncomes.slice(0, 10).map(tx => (
                <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
