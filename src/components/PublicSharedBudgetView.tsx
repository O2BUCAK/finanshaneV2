import React, { useState, useEffect, useMemo } from 'react';
import { Users, Receipt, Calculator, ArrowRight, AlertCircle, Clock, Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { SharedBudget } from '../types';
import { db, query, collectionGroup, where, getDocs, limit } from '../lib/firebase';

interface PublicSharedBudgetViewProps {
  joinCode: string;
}

export const PublicSharedBudgetView: React.FC<PublicSharedBudgetViewProps> = ({ joinCode }) => {
  const [budget, setBudget] = useState<SharedBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBudget = async () => {
      const cleanCode = joinCode.trim().toUpperCase();
      if (!cleanCode) {
        setError('Geçersiz katılım kodu.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const q = query(
          collectionGroup(db, 'sharedBudgets'), 
          where('joinCode', '==', cleanCode),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('Grup bulunamadı veya erişim izniniz yok. Lütfen kodun doğruluğunu kontrol edin.');
        } else {
          const data = snap.docs[0].data();
          // Convert Firestore timestamps to Dates
          const processedData = { ...data };
          if (processedData.expenses) {
            processedData.expenses = processedData.expenses.map((exp: any) => ({
              ...exp,
              date: exp.date?.toDate ? exp.date.toDate() : exp.date
            }));
          }
          if (processedData.createdAt?.toDate) processedData.createdAt = processedData.createdAt.toDate();
          if (processedData.date?.toDate) processedData.date = processedData.date.toDate();
          
          setBudget({ ...processedData, id: snap.docs[0].id } as SharedBudget);
        }
      } catch (err) {
        console.error('Error fetching public budget:', err);
        setError('Grup yüklenirken bir güvenlik veya bağlantı hatası oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
  }, [joinCode]);

  const calculations = useMemo(() => {
    if (!budget) return null;

    const balances: Record<string, { paid: number; owed: number; net: number }> = {};
    budget.participants.forEach(p => {
      balances[p.id] = { paid: 0, owed: 0, net: 0 };
    });

    budget.expenses.forEach(exp => {
      if (balances[exp.paidBy]) {
        balances[exp.paidBy].paid += exp.amount;
      }

      const sharingParticipants = exp.participantIds && exp.participantIds.length > 0
        ? budget.participants.filter(p => exp.participantIds!.includes(p.id))
        : budget.participants;

      if (sharingParticipants.length === 0) return;

      const totalSharingWeight = sharingParticipants.reduce((sum, p) => sum + p.weight, 0);

      if (exp.splitType === 'equal' || exp.splitType === 'by_weight') {
        sharingParticipants.forEach(p => {
          const share = (exp.amount / totalSharingWeight) * p.weight;
          balances[p.id].owed += share;
        });
      } else if (exp.splitType === 'exact' && exp.exactAmounts) {
        sharingParticipants.forEach(p => {
          balances[p.id].owed += (exp.exactAmounts![p.id] || 0);
        });
      }
    });

    Object.keys(balances).forEach(id => {
      balances[id].net = balances[id].paid - balances[id].owed;
    });

    const debtors = Object.entries(balances)
      .filter(([_, b]) => b.net < -0.01)
      .map(([id, b]) => ({ id, amount: Math.abs(b.net) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([_, b]) => b.net > 0.01)
      .map(([id, b]) => ({ id, amount: b.net }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i], creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0.01) settlements.push({ from: debtor.id, to: creditor.id, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return { balances, settlements };
  }, [budget]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Hata</h2>
          <p className="text-zinc-400 mb-6">{error || 'Grup bulunamadı.'}</p>
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider rounded">Paylaşılan Grup</span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-zinc-400 text-xs">{new Date(budget.createdAt).toLocaleDateString('tr-TR')}</span>
            </div>
            <h1 className="text-3xl font-bold">{budget.name}</h1>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all text-sm"
            >
              Giriş Yap / Kaydol
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Participants */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-emerald-500" /> Kişiler
            </h3>
            <div className="space-y-3">
              {budget.participants.map(p => (
                <div key={p.id} className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="font-bold">{p.name}</p>
                  <div className="flex gap-1 mt-1">
                    {p.adultCount ? <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.adultCount} Yetişkin</span> : null}
                    {p.childCount ? <span className="text-[10px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.childCount} Çocuk</span> : null}
                    {p.elderlyCount ? <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.elderlyCount} Yaşlı</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 lg:col-span-2">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Receipt className="w-5 h-5 text-blue-500" /> Harcamalar
            </h3>
            <div className="space-y-4">
              {budget.expenses.map(exp => {
                const payer = budget.participants.find(p => p.id === exp.paidBy);
                
                // Calculate shares for this specific expense
                const sharingParticipants = exp.participantIds && exp.participantIds.length > 0
                  ? budget.participants.filter(p => exp.participantIds!.includes(p.id))
                  : budget.participants;

                const totalSharingWeight = sharingParticipants.reduce((sum, p) => sum + p.weight, 0);
                const shares: { name: string; amount: number }[] = [];

                if (exp.splitType === 'equal' || exp.splitType === 'by_weight') {
                  sharingParticipants.forEach(p => {
                    const share = (exp.amount / totalSharingWeight) * p.weight;
                    shares.push({ name: p.name, amount: share });
                  });
                } else if (exp.splitType === 'exact' && exp.exactAmounts) {
                  sharingParticipants.forEach(p => {
                    shares.push({ name: p.name, amount: exp.exactAmounts![p.id] || 0 });
                  });
                }

                return (
                  <div key={exp.id} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold">{exp.description}</p>
                        <p className="text-xs text-zinc-400">
                          <span className="text-emerald-500 font-medium">{payer?.name}</span> ödedi
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">{exp.amount.toLocaleString('tr-TR')} ₺</span>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] text-zinc-500">{new Date(exp.date).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Split Details */}
                    <div className="pt-3 border-t border-zinc-900">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Bölüşüm Özeti</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-medium">
                          {exp.splitType === 'equal' ? 'Eşit' : exp.splitType === 'by_weight' ? 'Ağırlıklı' : 'Tam Tutar'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {shares.map((s, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] text-zinc-400 truncate mr-2">{s.name}</span>
                            <span className="text-[10px] font-bold text-zinc-200">{s.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {budget.expenses.length === 0 && (
                <p className="text-center text-zinc-500 py-8">Henüz harcama yok.</p>
              )}
            </div>
          </div>
        </div>

        {/* Settlements / Bölüşüm Özeti */}
        {calculations && budget.expenses.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-purple-500" /> Bölüşüm Özeti (Hesaplaşma)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Genel Durum</h4>
                <div className="space-y-3">
                  {budget.participants.map(p => {
                    const bal = calculations.balances[p.id];
                    return (
                      <div key={p.id} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-zinc-100">{p.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Ödediği: {bal.paid.toLocaleString('tr-TR')} ₺ | Payı: {bal.owed.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                          </p>
                        </div>
                        <div className={`text-right font-bold ${bal.net > 0.01 ? 'text-emerald-500' : bal.net < -0.01 ? 'text-rose-500' : 'text-zinc-400'}`}>
                          {bal.net > 0.01 ? '+' : ''}{bal.net.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Transferler (Kim Kime Ödeyecek?)</h4>
                <div className="space-y-3">
                  {calculations.settlements.length > 0 ? calculations.settlements.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-rose-500">{budget.participants.find(p => p.id === s.from)?.name}</span>
                        <ArrowRight className="w-4 h-4 text-zinc-300" />
                        <span className="font-bold text-emerald-500">{budget.participants.find(p => p.id === s.to)?.name}</span>
                      </div>
                      <span className="font-bold text-white">{s.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                    </div>
                  )) : (
                    <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center">
                      <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-emerald-500 font-medium">Tüm hesaplar dengede!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
