import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Users, Receipt, ArrowRight, Check, X, Trash2, Calculator, ChevronRight, ArrowLeft, AlertCircle, ArrowRightLeft, Share2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SharedBudget, SharedBudgetParticipant, SharedBudgetExpense, UserProfile } from '../types';
import { useCollection } from '../hooks/useFirestore';
import { localDB } from '../db';
import { formatAmount, parseAmount, cleanAmountInput } from '../utils/formatters';
import { createSharedBudget, updateSharedBudget, deleteSharedBudget } from '../lib/sharedBudgets';
import { useAuth } from '../hooks/useAuth';
import { 
  db, 
  query, 
  collectionGroup, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion 
} from '../lib/firebase';

interface SharedBudgetsProps {
  householdId?: string;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SharedBudgets: React.FC<SharedBudgetsProps> = ({ householdId, showNotification }) => {
  const { profile } = useAuth();
  const { data: householdBudgets, loading: householdLoading } = useCollection<SharedBudget>(
    householdId ? `households/${householdId}/sharedBudgets` : ''
  );

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showNotification) {
      showNotification(msg, type);
    } else {
      alert(msg);
    }
  };

  const [joinedBudgets, setJoinedBudgets] = useState<SharedBudget[]>([]);
  const [joinedLoading, setJoinedLoading] = useState(false);

  // Fetch joined budgets
  useEffect(() => {
    if (!profile?.joinedBudgetIds || profile.joinedBudgetIds.length === 0) {
      setJoinedBudgets([]);
      return;
    }

    const fetchJoined = async () => {
      setJoinedLoading(true);
      try {
        const budgets = await localDB.sharedBudgets
          .where('id')
          .anyOf(profile.joinedBudgetIds)
          .toArray();
        setJoinedBudgets(budgets as SharedBudget[]);
      } catch (error) {
        console.error('Error fetching joined budgets:', error);
      } finally {
        setJoinedLoading(false);
      }
    };

    fetchJoined();
  }, [profile?.joinedBudgetIds]);

  const budgets = useMemo(() => {
    const all = [...householdBudgets];
    joinedBudgets.forEach(jb => {
      if (!all.find(b => b.id === jb.id)) {
        all.push(jb);
      }
    });
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [householdBudgets, joinedBudgets]);

  const loading = householdLoading || joinedLoading;

  const [selectedBudget, setSelectedBudget] = useState<SharedBudget | null>(null);

  // Update selected budget when data changes
  useEffect(() => {
    if (selectedBudget && budgets && budgets.length > 0) {
      const updated = budgets.find(b => b.id === selectedBudget.id);
      if (updated) {
        setSelectedBudget(updated);
        
        // Generate missing join code for older budgets
        if (!updated.joinCode && householdId) {
          const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          updateSharedBudget(householdId, updated.id, { joinCode });
        }
      }
    }
  }, [budgets, householdId]);

  // Modals state
  const [isNewBudgetModalOpen, setIsNewBudgetModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

  // New Budget Form
  const [newBudgetName, setNewBudgetName] = useState('');

  // New Participant Form
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantAdults, setNewParticipantAdults] = useState(1);
  const [newParticipantChildren, setNewParticipantChildren] = useState(0);
  const [newParticipantElderly, setNewParticipantElderly] = useState(0);

  // New Expense Form
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayer, setExpensePayer] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState<'equal' | 'by_weight' | 'exact'>('by_weight');
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [expenseParticipants, setExpenseParticipants] = useState<string[]>([]);

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim() || isJoining || !profile) return;

    setIsJoining(true);
    try {
      const q = query(collectionGroup(db, 'sharedBudgets'), where('joinCode', '==', joinCodeInput.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        notify("Geçersiz katılım kodu.", 'error');
        return;
      }

      const budgetDoc = snap.docs[0];
      const budgetData = budgetDoc.data() as SharedBudget;
      const budgetId = budgetDoc.id;

      // Check if already joined
      if (profile.joinedBudgetIds?.includes(budgetId) || householdBudgets.find(b => b.id === budgetId)) {
        notify("Bu etkinliğe zaten katıldınız.", 'info');
        setIsJoinModalOpen(false);
        setJoinCodeInput('');
        return;
      }

      // Add to user profile
      const userRef = doc(db, 'users', profile.id);
      await updateDoc(userRef, {
        joinedBudgetIds: arrayUnion(budgetId)
      });

      // Add as participant if not already there
      if (!budgetData.participants.find(p => p.id === profile.id)) {
        const role = profile.role || 'adult';
        const weight = role === 'child' || role === 'elderly' ? 0.5 : 1;
        const newParticipant: SharedBudgetParticipant = {
          id: profile.id,
          name: profile.fullName,
          weight,
          adultCount: role === 'adult' ? 1 : 0,
          childCount: role === 'child' ? 1 : 0,
          elderlyCount: role === 'elderly' ? 1 : 0
        };
        const householdPath = budgetDoc.ref.parent.parent?.path;
        if (householdPath) {
          const householdIdFromPath = householdPath.split('/').pop();
          if (householdIdFromPath) {
            await updateSharedBudget(householdIdFromPath, budgetId, {
              participants: [...budgetData.participants, newParticipant]
            });
          }
        }
      }

      notify("Etkinliğe başarıyla katıldınız!", 'success');
      setIsJoinModalOpen(false);
      setJoinCodeInput('');
    } catch (error) {
      console.error("Error joining budget:", error);
      notify("Etkinliğe katılırken bir hata oluştu.", 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetName.trim() || isCreating) return;

    if (!householdId) {
      notify("Hane bilgisi bulunamadı. Lütfen sayfayı yenileyin.", 'error');
      return;
    }

    setIsCreating(true);
    try {
      const newBudget = await createSharedBudget(householdId, {
        name: newBudgetName,
        date: new Date(),
        participants: [],
        expenses: [],
        isSettled: false,
      });

      setNewBudgetName('');
      setIsNewBudgetModalOpen(false);
      setSelectedBudget(newBudget as SharedBudget);
      notify("Etkinlik başarıyla oluşturuldu.", 'success');
    } catch (error) {
      console.error("Error creating budget:", error);
      notify("Etkinlik oluşturulurken bir hata oluştu.", 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !newParticipantName.trim() || !householdId) return;

    const weight = newParticipantAdults + (newParticipantChildren * 0.5) + (newParticipantElderly * 0.5);
    if (weight <= 0) return;

    const newParticipant: SharedBudgetParticipant = { 
      id: Date.now().toString(), 
      name: newParticipantName, 
      weight,
      adultCount: newParticipantAdults,
      childCount: newParticipantChildren,
      elderlyCount: newParticipantElderly
    };
    const updatedParticipants = [...selectedBudget.participants, newParticipant];

    try {
      await updateSharedBudget(householdId, selectedBudget.id, { participants: updatedParticipants });
      setNewParticipantName('');
      setNewParticipantAdults(1);
      setNewParticipantChildren(0);
      setNewParticipantElderly(0);
      setIsAddParticipantModalOpen(false);
    } catch (error) {
      console.error("Error adding participant:", error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudget || !expenseDesc.trim() || !expenseAmount || !expensePayer || !householdId) return;

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newExpense: SharedBudgetExpense = {
      id: Date.now().toString(),
      description: expenseDesc,
      amount,
      paidBy: expensePayer,
      splitType: expenseSplitType,
      date: new Date(),
      ...(expenseSplitType === 'exact' ? { exactAmounts } : {}),
      ...(expenseParticipants.length > 0 ? { participantIds: expenseParticipants } : {})
    };

    const updatedExpenses = [...selectedBudget.expenses, newExpense];

    try {
      await updateSharedBudget(householdId, selectedBudget.id, { expenses: updatedExpenses });
      setExpenseDesc('');
      setExpenseAmount('');
      setExpensePayer('');
      setExpenseSplitType('by_weight');
      setExactAmounts({});
      setExpenseParticipants([]);
      setIsAddExpenseModalOpen(false);
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!selectedBudget || !householdId) return;
    const updatedExpenses = selectedBudget.expenses.filter(e => e.id !== expenseId);
    try {
      await updateSharedBudget(householdId, selectedBudget.id, { expenses: updatedExpenses });
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!selectedBudget || !householdId) return;
    const updatedParticipants = selectedBudget.participants.filter(p => p.id !== participantId);
    const updatedExpenses = selectedBudget.expenses.filter(e => e.paidBy !== participantId); // Also remove their expenses for simplicity
    
    try {
      await updateSharedBudget(householdId, selectedBudget.id, { 
        participants: updatedParticipants,
        expenses: updatedExpenses
      });
    } catch (error) {
      console.error("Error deleting participant:", error);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!householdId) return;
    setBudgetToDelete(budgetId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteBudget = async () => {
    if (!householdId || !budgetToDelete) return;
    try {
      await deleteSharedBudget(householdId, budgetToDelete);
      if (selectedBudget?.id === budgetToDelete) {
        setSelectedBudget(null);
      }
      setIsDeleteConfirmOpen(false);
      setBudgetToDelete(null);
    } catch (error) {
      console.error("Error deleting budget:", error);
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    if (!selectedBudget) return null;

    const balances: Record<string, { paid: number; owed: number; net: number }> = {};
    selectedBudget.participants.forEach(p => {
      balances[p.id] = { paid: 0, owed: 0, net: 0 };
    });

    const totalWeight = selectedBudget.participants.reduce((sum, p) => sum + p.weight, 0);

    selectedBudget.expenses.forEach(exp => {
      if (balances[exp.paidBy]) {
        balances[exp.paidBy].paid += exp.amount;
      }

      // Determine which participants share this expense
      const sharingParticipants = exp.participantIds && exp.participantIds.length > 0
        ? selectedBudget.participants.filter(p => exp.participantIds!.includes(p.id))
        : selectedBudget.participants;

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

    // Calculate net
    Object.keys(balances).forEach(id => {
      balances[id].net = balances[id].paid - balances[id].owed;
    });

    // Settlements
    const debtors = Object.entries(balances)
      .filter(([_, b]) => b.net < -0.01)
      .map(([id, b]) => ({ id, amount: Math.abs(b.net) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([_, b]) => b.net > 0.01)
      .map(([id, b]) => ({ id, amount: b.net }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: { from: string; to: string; amount: number }[] = [];

    let i = 0; // debtors index
    let j = 0; // creditors index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amount = Math.min(debtor.amount, creditor.amount);
      
      if (amount > 0.01) {
        settlements.push({
          from: debtor.id,
          to: creditor.id,
          amount
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return { balances, settlements };
  }, [selectedBudget]);

  if (selectedBudget) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedBudget(null)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-bold">{selectedBudget.name}</h2>
              {selectedBudget.joinCode && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Katılım Kodu:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {selectedBudget.joinCode}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBudget.joinCode!);
                        notify("Katılım kodu kopyalandı!", 'success');
                      }}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors"
                      title="Kodu Kopyala"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {navigator.share ? (
                      <button 
                        onClick={() => {
                          const shareUrl = `${window.location.origin}${window.location.pathname}?group=${selectedBudget.joinCode}`;
                          navigator.share({
                            title: `${selectedBudget.name} - Paylaşılan Grup`,
                            text: `${selectedBudget.name} etkinliğinin detaylarını görmek için bu bağlantıyı kullanabilirsiniz.`,
                            url: shareUrl
                          }).catch(console.error);
                        }}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors"
                        title="Paylaş"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          const shareUrl = `${window.location.origin}${window.location.pathname}?group=${selectedBudget.joinCode}`;
                          navigator.clipboard.writeText(shareUrl);
                          notify("Paylaşım linki kopyalandı!", 'success');
                        }}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors"
                        title="Linki Kopyala"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <p className="text-zinc-300">{selectedBudget.date ? new Date(selectedBudget.date).toLocaleDateString('tr-TR') : '-'}</p>
            </div>
          </div>
          <button 
            onClick={() => handleDeleteBudget(selectedBudget.id)}
            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
            title="Bütçeyi Sil"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Participants */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Kişiler
              </h3>
              <button 
                onClick={() => setIsAddParticipantModalOpen(true)}
                className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {selectedBudget.participants.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.adultCount ? <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.adultCount} Yetişkin</span> : null}
                      {p.childCount ? <span className="text-[10px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.childCount} Çocuk</span> : null}
                      {p.elderlyCount ? <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.elderlyCount} Yaşlı</span> : null}
                      {!p.adultCount && !p.childCount && !p.elderlyCount && (
                        <span className="text-[10px] bg-zinc-500/10 text-zinc-400 px-1.5 py-0.5 rounded-md font-bold uppercase">{p.weight} Kişi</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteParticipant(p.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {selectedBudget.participants.length === 0 && (
                <p className="text-sm text-zinc-300 text-center py-4">Henüz kişi eklenmedi.</p>
              )}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                Harcamalar
              </h3>
              <button 
                onClick={() => {
                  setExpenseDesc('');
                  setExpenseAmount('');
                  setExpensePayer(selectedBudget.participants[0]?.id || '');
                  setExpenseSplitType('by_weight');
                  setExactAmounts({});
                  setExpenseParticipants(selectedBudget.participants.map(p => p.id));
                  setIsAddExpenseModalOpen(true);
                }}
                disabled={selectedBudget.participants.length === 0}
                className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Yeni Harcama
              </button>
            </div>

            <div className="space-y-3">
              {selectedBudget.expenses.map(exp => {
                const payer = selectedBudget.participants.find(p => p.id === exp.paidBy);
                
                // Calculate shares for this specific expense
                const sharingParticipants = exp.participantIds && exp.participantIds.length > 0
                  ? selectedBudget.participants.filter(p => exp.participantIds!.includes(p.id))
                  : selectedBudget.participants;

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
                  <div key={exp.id} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{exp.description}</p>
                        <p className="text-sm text-zinc-100">
                          <span className="text-emerald-500 font-medium">{payer?.name}</span> ödedi
                          <span className="mx-2">•</span>
                          {exp.splitType === 'equal' ? 'Eşit Bölüşüm' : exp.splitType === 'by_weight' ? 'Kişi Sayısına Göre' : 'Özel Bölüşüm'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold">{exp.amount.toLocaleString('tr-TR')} ₺</span>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Share Summary */}
                    <div className="pt-3 border-t border-zinc-800/50">
                      <p className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-2">Bölüşüm Özeti</p>
                      <div className="flex flex-wrap gap-2">
                        {shares.map((s, idx) => (
                          <div key={idx} className="bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-800/50 flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-100">{s.name}:</span>
                            <span className="text-xs font-bold text-white">{s.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {selectedBudget.expenses.length === 0 && (
                <p className="text-sm text-zinc-300 text-center py-8">Henüz harcama eklenmedi.</p>
              )}
            </div>
          </div>
        </div>

        {/* Settlements */}
        {selectedBudget.participants.length > 0 && selectedBudget.expenses.length > 0 && calculations && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Calculator className="w-5 h-5 text-purple-500" />
              Hesaplaşma (Kim Kime Ne Kadar Verecek?)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-4">Özet Durum</h4>
                <div className="space-y-3">
                  {selectedBudget.participants.map(p => {
                    const bal = calculations.balances[p.id];
                    return (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                        <span className="font-medium">{p.name}</span>
                        <div className="text-right">
                          <div className={`font-bold ${bal.net > 0 ? 'text-emerald-500' : bal.net < 0 ? 'text-rose-500' : 'text-zinc-300'}`}>
                            {bal.net > 0 ? '+' : ''}{bal.net.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                          </div>
                          <div className="text-xs text-zinc-300">
                            Ödediği: {bal.paid.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ | Payına Düşen: {bal.owed.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-4">Transferler</h4>
                <div className="space-y-3">
                  {calculations.settlements.length > 0 ? calculations.settlements.map((s, i) => {
                    const from = selectedBudget.participants.find(p => p.id === s.from)?.name;
                    const to = selectedBudget.participants.find(p => p.id === s.to)?.name;
                    return (
                      <div key={i} className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-rose-500">{from}</span>
                          <ArrowRight className="w-4 h-4 text-zinc-300" />
                          <span className="font-bold text-emerald-500">{to}</span>
                        </div>
                        <span className="font-bold text-lg">{s.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                      </div>
                    );
                  }) : (
                    <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 text-center font-medium">
                      Herkes ödeşmiş durumda! 🎉
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Participant Modal */}
        {isAddParticipantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Kişi Ekle</h3>
                <button onClick={() => setIsAddParticipantModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-300" />
                </button>
              </div>
              <form onSubmit={handleAddParticipant} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">İsim (Kişi veya Aile)</label>
                  <input
                    type="text"
                    required
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Örn: Ali, Veliler"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Yetişkin</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newParticipantAdults}
                      onChange={(e) => setNewParticipantAdults(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Çocuk</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newParticipantChildren}
                      onChange={(e) => setNewParticipantChildren(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Yaşlı</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newParticipantElderly}
                      onChange={(e) => setNewParticipantElderly(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                  <span className="text-xs text-zinc-300 uppercase font-bold">Hesaplanan Ağırlık: </span>
                  <span className="text-emerald-500 font-bold">{newParticipantAdults + (newParticipantChildren * 0.5) + (newParticipantElderly * 0.5)}</span>
                </div>

                <p className="text-[10px] text-zinc-300 italic">Harcamalar kişi sayısına göre bölüştürülürken yetişkinler 1, çocuklar ve yaşlılar 0.5 birim sayılır.</p>
                
                <button type="submit" disabled={newParticipantAdults + newParticipantChildren + newParticipantElderly === 0} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-2xl hover:bg-emerald-600 transition-colors mt-4 disabled:opacity-50">
                  Ekle
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Expense Modal */}
        {isAddExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
                <h3 className="text-xl font-bold">Harcama Ekle</h3>
                <button onClick={() => setIsAddExpenseModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-300" />
                </button>
              </div>
              <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Açıklama</label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="Örn: Akşam Yemeği, Benzin"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Tutar (₺)</label>
                  <input
                    type="text"
                    required
                    value={formatAmount(expenseAmount)}
                    onChange={(e) => setExpenseAmount(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Kim Ödedi?</label>
                  <select
                    required
                    value={expensePayer}
                    onChange={(e) => setExpensePayer(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white"
                  >
                    <option value="">Seçiniz</option>
                    {selectedBudget.participants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Kimler Paylaşacak?</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedBudget.participants.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (expenseParticipants.includes(p.id)) {
                            setExpenseParticipants(expenseParticipants.filter(id => id !== p.id));
                          } else {
                            setExpenseParticipants([...expenseParticipants, p.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          expenseParticipants.includes(p.id)
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {expenseParticipants.length === 0 && (
                    <p className="text-[10px] text-rose-500">En az bir kişi seçmelisiniz.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Nasıl Bölüşülecek?</label>
                  <select
                    value={expenseSplitType}
                    onChange={(e) => setExpenseSplitType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white"
                  >
                    <option value="by_weight">Kişi Sayısına (Ağırlığa) Göre Orantılı</option>
                    <option value="equal">Herkese Eşit</option>
                    <option value="exact">Özel Tutar (Kim ne kadar yedi?)</option>
                  </select>
                </div>

                {expenseSplitType === 'exact' && (
                  <div className="space-y-3 pt-4 border-t border-zinc-800">
                    <p className="text-sm font-medium text-zinc-300 mb-2">Kim ne kadarlık harcama yaptı?</p>
                    {selectedBudget.participants.filter(p => expenseParticipants.includes(p.id)).map(p => (
                      <div key={p.id} className="flex items-center gap-4">
                        <span className="flex-1 text-sm">{p.name}</span>
                        <input
                          type="text"
                          value={formatAmount(exactAmounts[p.id] || '')}
                          onChange={(e) => setExactAmounts({ ...exactAmounts, [p.id]: parseFloat(parseAmount(cleanAmountInput(e.target.value))) || 0 })}
                          placeholder="0,00"
                          className="w-32 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    ))}
                    {/* Validation helper */}
                    {(() => {
                      const totalExact = Object.values(exactAmounts).reduce((a, b) => a + b, 0);
                      const diff = parseFloat(expenseAmount || '0') - totalExact;
                      const hasRemaining = Math.abs(diff) > 0.01;
                      
                      const distributeRemaining = () => {
                        const total = parseFloat(expenseAmount || '0');
                        if (isNaN(total) || total <= 0) return;
                        
                        // Find participants who have 0 or no amount entered
                        const remainingParticipants = expenseParticipants.filter(id => !exactAmounts[id] || exactAmounts[id] === 0);
                        
                        if (remainingParticipants.length === 0) return;
                        
                        const currentTotal = expenseParticipants.reduce((sum, id) => sum + (exactAmounts[id] || 0), 0);
                        const remaining = total - currentTotal;
                        
                        if (remaining <= 0) return;
                        
                        const perPerson = remaining / remainingParticipants.length;
                        const newExactAmounts = { ...exactAmounts };
                        remainingParticipants.forEach(id => {
                          newExactAmounts[id] = perPerson;
                        });
                        setExactAmounts(newExactAmounts);
                      };

                      return (
                        <div className="mt-4 space-y-2">
                          <div className={`text-xs font-bold flex items-center justify-between ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span>{Math.abs(diff) < 0.01 ? 'Tutarlar eşleşiyor.' : `Kalan fark: ${diff.toLocaleString('tr-TR')} ₺`}</span>
                            {hasRemaining && diff > 0 && expenseParticipants.some(id => !exactAmounts[id] || exactAmounts[id] === 0) && (
                              <button
                                type="button"
                                onClick={distributeRemaining}
                                className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-2 py-1 rounded-lg transition-colors uppercase font-bold"
                              >
                                Kalanı Dağıt
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={
                    !expenseDesc.trim() || 
                    !expenseAmount || 
                    !expensePayer || 
                    expenseParticipants.length === 0 ||
                    (expenseSplitType === 'exact' && (() => {
                      const totalExact = expenseParticipants.reduce((sum, id) => sum + (exactAmounts[id] || 0), 0);
                      return Math.abs(parseFloat(expenseAmount || '0') - totalExact) > 0.01;
                    })())
                  }
                  className="w-full bg-blue-500 text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Harcamayı Ekle
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Grup Harcamaları</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Arkadaşlarınızla veya ailenizle ortak harcamaları kolayca bölüşün.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all text-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Koda Katıl
          </button>
          <button 
            onClick={() => setIsNewBudgetModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Etkinlik</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(budget => (
            <div 
              key={budget.id} 
              onClick={() => setSelectedBudget(budget)}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl cursor-pointer hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-zinc-800 rounded-2xl group-hover:bg-emerald-500/10 transition-colors">
                  <Users className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="flex flex-col items-end">
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors mb-2" />
                  {budget.joinCode && (
                    <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {budget.joinCode}
                    </span>
                  )}
                </div>
              </div>
              <h4 className="text-xl font-bold mb-1">{budget.name}</h4>
              <p className="text-zinc-400 text-sm mb-4">{budget.date ? new Date(budget.date).toLocaleDateString('tr-TR') : '-'}</p>
              
              <div className="flex items-center gap-4 text-sm text-zinc-300">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {budget.participants.length} Kişi</span>
                <span className="flex items-center gap-1"><Receipt className="w-4 h-4" /> {budget.expenses.length} Harcama</span>
              </div>
            </div>
          ))}

          {budgets.length === 0 && (
            <div className="col-span-full text-center py-12 border-2 border-dashed border-zinc-800 rounded-3xl">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h4 className="text-xl font-bold mb-2">Henüz Etkinlik Yok</h4>
              <p className="text-zinc-400 mb-6">Tatiller, yemekler veya ortak masraflar için yeni bir etkinlik oluşturun.</p>
              <button 
                onClick={() => setIsNewBudgetModalOpen(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl inline-flex items-center gap-2 font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Etkinliği Oluştur</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calculation Note */}
      <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
          <span className="text-emerald-500 font-bold">NOT:</span> Grup hesaplamalarında adaletli bölüşüm için yetişkinler tam (1.0), çocuklar ve yaşlılar yarım (0.5) kişi olarak sayılır. Bu kural hem "Kişi Sayısına Göre" hem de "Herkese Eşit" bölüşüm seçeneklerinde geçerlidir.
        </p>
      </div>

      {/* New Budget Modal */}
      {isNewBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Yeni Etkinlik</h3>
              <button onClick={() => setIsNewBudgetModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="w-5 h-5 text-zinc-300" />
              </button>
            </div>
            <form onSubmit={handleCreateBudget} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Etkinlik Adı</label>
                <input
                  type="text"
                  required
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="Örn: Hafta Sonu Tatili, Akşam Yemeği"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button 
                type="submit" 
                disabled={isCreating}
                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-2xl hover:bg-emerald-600 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Oluşturuluyor...</span>
                  </>
                ) : (
                  'Oluştur'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Koda Katıl</h3>
                <button onClick={() => setIsJoinModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-zinc-300" />
                </button>
              </div>
              <form onSubmit={handleJoinWithCode} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Katılım Kodu</label>
                  <input
                    type="text"
                    required
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Örn: AB12CD"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 mt-4 disabled:opacity-50"
                >
                  {isJoining ? 'Katılınıyor...' : 'Etkinliğe Katıl'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <h3 className="text-xl font-bold text-white mb-2">Bütçeyi Sil?</h3>
              <p className="text-zinc-400 mb-6">Bu bütçeyi ve içindeki tüm harcamaları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                >
                  İptal
                </button>
                <button 
                  onClick={confirmDeleteBudget}
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
