import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, LayoutDashboard, Wallet, Receipt, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Household, Account, Transaction, Category } from '../types';
import { db, query, collection, where, getDocs, limit, orderBy } from '../lib/firebase';

interface PublicHouseholdViewProps {
  shareToken: string;
}

export const PublicHouseholdView: React.FC<PublicHouseholdViewProps> = ({ shareToken }) => {
  const [household, setHousehold] = useState<Household | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHousehold = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'households'), where('shareToken', '==', shareToken), where('isPublic', '==', true), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('Hane bulunamadı veya paylaşım kapalı.');
        } else {
          const h = { ...snap.docs[0].data(), id: snap.docs[0].id } as Household;
          setHousehold(h);

          // Fetch accounts
          const accSnap = await getDocs(collection(db, `households/${h.id}/accounts`));
          setAccounts(accSnap.docs.map(d => ({ ...d.data(), id: d.id } as Account)));

          // Fetch recent transactions
          const txQ = query(collection(db, `households/${h.id}/transactions`), orderBy('date', 'desc'), limit(50));
          const txSnap = await getDocs(txQ);
          setTransactions(txSnap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
        }
      } catch (err) {
        console.error('Error fetching public household:', err);
        setError('Hane yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchHousehold();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !household) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Hata</h2>
          <p className="text-zinc-400 mb-6">{error || 'Hane bulunamadı.'}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-emerald-500 text-white font-bold rounded-2xl"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider rounded">Paylaşılan Hane</span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-zinc-400 text-xs">{household.currency}</span>
            </div>
            <h1 className="text-3xl font-bold">{household.name}</h1>
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all text-sm"
          >
            Giriş Yap / Kaydol
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Toplam Varlık</p>
            <p className="text-2xl font-bold text-emerald-500">{totalAssets.toLocaleString('tr-TR')} {household.currency}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Toplam Borç</p>
            <p className="text-2xl font-bold text-rose-500">{totalLiabilities.toLocaleString('tr-TR')} {household.currency}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Net Durum</p>
            <p className="text-2xl font-bold text-white">{(totalAssets - totalLiabilities).toLocaleString('tr-TR')} {household.currency}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" /> Hesaplar
              </h3>
              <div className="space-y-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div>
                      <p className="text-sm font-bold">{acc.name}</p>
                      <p className="text-[10px] text-zinc-500 uppercase">{acc.branch}</p>
                    </div>
                    <p className={`text-sm font-bold ${acc.type === 'asset' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {acc.balance.toLocaleString('tr-TR')} {acc.currency}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" /> Son İşlemler
              </h3>
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <div>
                      <p className="text-sm font-bold">{tx.description}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <p className="text-sm font-bold">
                      {tx.amount.toLocaleString('tr-TR')} {tx.currency}
                    </p>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-center text-zinc-500 py-8">Henüz işlem yok.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="pt-8 border-t border-zinc-800 text-center">
          <p className="text-zinc-500 text-sm flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" /> 2026 FinansHane Güvenli Paylaşım Sistemi
          </p>
        </footer>
      </div>
    </div>
  );
};
