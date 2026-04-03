import React from 'react';
import { 
  Calendar, CreditCard, Plus, Trash2, 
  AlertCircle, CheckCircle2, Clock, 
  ArrowRightLeft, Tag, Wallet
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Account, Category } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { deleteDoc, doc, db } from '../lib/firebase';

interface SubscriptionsViewProps {
  householdId: string;
  expenseSources: any[];
  accounts: Account[];
  categories: Account[];
  onAddSubscription: () => void;
  isPrivacyMode?: boolean;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  householdId,
  expenseSources,
  accounts,
  categories,
  onAddSubscription,
  isPrivacyMode = false
}) => {
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);

  const handleDelete = async (id: string) => {
    if (!confirm('Bu aboneliği silmek istediğinizden emin misiniz? Gelecek ödemeler artık oluşturulmayacak.')) return;
    try {
      await deleteDoc(doc(db, `households/${householdId}/expenseSources/${id}`));
    } catch (error) {
      console.error('Error deleting subscription:', error);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Abonelikler</h1>
          <p className="text-zinc-400 font-medium mt-1">Düzenli ödemeleriniz ve abonelik planlarınız</p>
        </div>
        <button 
          onClick={onAddSubscription}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Yeni Abonelik Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {expenseSources.map(source => {
          const account = accounts.find(a => a.id === source.sourceAccountId);
          const category = categories.find(c => c.id === source.categoryId);

          return (
            <motion.div 
              key={source.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-zinc-700 transition-all group"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800">
                      <Clock className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-emerald-500 transition-colors">{source.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                          Her Ayın {source.periodDay}. Günü
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(source.id)}
                    className="p-2 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-4 border-t border-zinc-800/50">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Ödeme Tutarı</p>
                      <p className="text-2xl font-bold text-white tracking-tight">
                        {formatWithEquivalent(source.amount, source.currency || 'TRY')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Durum</p>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                        source.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {source.status === 'active' ? 'Aktif' : 'Durduruldu'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Hesap</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium truncate">
                      <Wallet className="w-3 h-3 shrink-0" />
                      {account?.name || 'Bilinmiyor'}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Kategori</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium truncate">
                      <Tag className="w-3 h-3 shrink-0" />
                      {category?.name || 'Diğer'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {expenseSources.length === 0 && (
          <div className="col-span-full text-center py-20 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Abonelik Bulunamadı</h3>
            <p className="text-zinc-400 max-w-xs mx-auto">Henüz düzenli bir ödeme veya abonelik eklemediniz.</p>
          </div>
        )}
      </div>
    </div>
  );
};
