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
import { ConfirmModal } from './ConfirmModal';
import { useState } from 'react';

interface SubscriptionsViewProps {
  householdId: string;
  expenseSources: any[];
  accounts: Account[];
  categories: Account[];
  members?: Record<string, any>;
  onAddSubscription: () => void;
  isPrivacyMode?: boolean;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  householdId,
  expenseSources,
  accounts,
  categories,
  members,
  onAddSubscription,
  isPrivacyMode = false
}) => {
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<string>('');

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `households/${householdId}/expenseSources/${id}`));
    } catch (error) {
      console.error('Error deleting subscription:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {expenseSources.map(source => {
          const account = accounts.find(a => a.id === source.sourceAccountId);
          const category = categories.find(c => c.id === source.categoryId);

          return (
            <motion.div 
              key={source.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="corporate-card overflow-hidden group"
            >
              <div className="p-8 space-y-6">
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
                        {source.ownerId && members?.[source.ownerId] && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
                            {members[source.ownerId].displayName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setDeleteConfirmId(source.id);
                      setDeleteConfirmTitle('Aboneliği Sil');
                      setDeleteConfirmMessage(`${source.name} aboneliğini silmek istediğinizden emin misiniz? Gelecek ödemeler artık oluşturulmayacak.`);
                    }}
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
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                      {source.categoryId === 'transfer' ? 'Hedef Hesap' : 'Kategori'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium truncate">
                      {source.categoryId === 'transfer' ? (
                        <>
                          <ArrowRightLeft className="w-3 h-3 shrink-0" />
                          {accounts.find(a => a.id === source.targetAccountId)?.name || 'Bilinmiyor'}
                        </>
                      ) : (
                        <>
                          <Tag className="w-3 h-3 shrink-0" />
                          {category?.name || 'Diğer'}
                        </>
                      )}
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

      <ConfirmModal 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) handleDelete(deleteConfirmId);
        }}
        title={deleteConfirmTitle}
        message={deleteConfirmMessage}
      />
    </div>
  );
};
