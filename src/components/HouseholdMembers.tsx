import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, User as UserIcon, Baby, MoreVertical, Mail, Check, X, ArrowRightLeft, Heart, UserCheck, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { localDB } from '../db';
import { Household, JoinRequest } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { db, doc, updateDoc, collection, query, where, onSnapshot, setDoc } from '../lib/firebase';

interface HouseholdMembersProps {
  household: Household;
  currentUserId: string;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HouseholdMembers: React.FC<HouseholdMembersProps> = ({ household, currentUserId, showNotification }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberType, setNewMemberType] = useState<'adult' | 'child' | 'elderly' | 'other'>('adult');
  const [loading, setLoading] = useState(false);

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedRealMemberId, setSelectedRealMemberId] = useState<string | null>(null);
  const [selectedVirtualMemberId, setSelectedVirtualMemberId] = useState<string | null>(null);

  const [copySuccess, setCopySuccess] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(false);
  
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'member' | 'refresh_code';
    title: string;
    message: string;
  } | null>(null);

  const isOwner = household.ownerId === currentUserId;

  useEffect(() => {
    if (!isOwner) return;
    
    const q = query(
      collection(db, 'joinRequests'),
      where('householdId', '==', household.id),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const requests = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as JoinRequest));
      setJoinRequests(requests);
    });
    
    return () => unsubscribe();
  }, [household.id, isOwner]);

  const handleCopyCode = () => {
    if (household.joinCode) {
      navigator.clipboard.writeText(household.joinCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleRefreshCode = async () => {
    if (!isOwner || refreshingCode) return;

    setRefreshingCode(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Update Firestore
      await updateDoc(doc(db, 'households', household.id), { joinCode: newCode });
      
      // Update LocalDB
      await localDB.households.update(household.id, { joinCode: newCode });
    } catch (error) {
      console.error('Error refreshing join code:', error);
    } finally {
      setRefreshingCode(false);
    }
  };

  const handleApproveRequest = async (requestId: string, virtualMemberId?: string) => {
    if (!isOwner || loading) return;
    setLoading(true);
    try {
      const request = joinRequests.find(r => r.id === requestId);
      if (!request) return;

      const updatedMembers = { ...household.members };
      const memberData = {
        role: 'member' as const,
        type: 'adult' as const,
        salaryVisible: true,
        displayName: request.displayName,
        email: request.email
      };

      if (virtualMemberId && updatedMembers[virtualMemberId]) {
        // Match with virtual member
        const virtual = updatedMembers[virtualMemberId];
        updatedMembers[request.userId] = {
          ...memberData,
          type: virtual.type,
          salaryVisible: virtual.salaryVisible
        };
        delete updatedMembers[virtualMemberId];
      } else {
        // Add as new member
        updatedMembers[request.userId] = memberData;
      }

      // Update Household
      await updateDoc(doc(db, 'households', household.id), { members: updatedMembers });
      
      // Update Join Request
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'approved' });
      
      // Sync local
      await localDB.households.update(household.id, { members: updatedMembers });

      if (showNotification) showNotification('İstek onaylandı.', 'success');
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Approve error:', error);
      if (showNotification) showNotification('Onaylama sırasında hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!isOwner || loading) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'rejected' });
      if (showNotification) showNotification('İstek reddedildi.', 'info');
    } catch (error) {
      console.error('Reject error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeMembers = async () => {
    if (!isOwner || !selectedRealMemberId || !selectedVirtualMemberId || loading) return;
    
    setLoading(true);
    try {
      const updatedMembers = { ...household.members };
      const virtualMember = updatedMembers[selectedVirtualMemberId];
      const realMember = updatedMembers[selectedRealMemberId];
      
      updatedMembers[selectedRealMemberId] = {
        ...realMember,
        type: virtualMember.type,
        salaryVisible: virtualMember.salaryVisible,
      };
      
      delete updatedMembers[selectedVirtualMemberId];
      
      await localDB.households.update(household.id, { members: updatedMembers });
      
      setIsMergeModalOpen(false);
      setSelectedRealMemberId(null);
      setSelectedVirtualMemberId(null);
      if (showNotification) {
        showNotification('Bireyler başarıyla eşleştirildi.', 'success');
      }
    } catch (error) {
      console.error('Error merging members:', error);
      if (showNotification) {
        showNotification('Eşleştirme sırasında bir hata oluştu.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || loading) return;

    setLoading(true);
    try {
      const virtualId = `virtual-${Date.now()}`;
      
      const updatedMembers = {
        ...household.members,
        [virtualId]: {
          role: 'member',
          type: newMemberType,
          salaryVisible: true,
          displayName: newMemberName,
          email: newMemberEmail || '',
        }
      };

      await localDB.households.update(household.id, { members: updatedMembers as any });
      setIsAddModalOpen(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberType('adult');
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isOwner || memberId === currentUserId) return;

    try {
      const updatedMembers = { ...household.members };
      delete updatedMembers[memberId];
      await localDB.households.update(household.id, { members: updatedMembers });
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleToggleSalaryVisibility = async (memberId: string) => {
    if (!isOwner && memberId !== currentUserId) return;

    try {
      const updatedMembers = {
        ...household.members,
        [memberId]: {
          ...household.members[memberId],
          salaryVisible: !household.members[memberId].salaryVisible
        }
      };
      await localDB.households.update(household.id, { members: updatedMembers });
    } catch (error) {
      console.error('Error toggling salary visibility:', error);
    }
  };

  const handleChangeMemberType = async (memberId: string, newType: 'adult' | 'child' | 'elderly' | 'other') => {
    if (!isOwner) return;
    try {
      const updatedMembers = {
        ...household.members,
        [memberId]: {
          ...household.members[memberId],
          type: newType
        }
      };
      await localDB.households.update(household.id, { members: updatedMembers });
    } catch (error) {
      console.error('Error changing member type:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card/50 p-6 rounded-3xl border border-border">
        <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Users className="w-6 h-6 text-primary" />
          Hane Bireyleri
        </h3>
        <div className="flex items-center gap-3">
          {isOwner && household.joinCode && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Katılım Kodu:</span>
              <span className="text-sm font-mono font-bold text-primary">{household.joinCode}</span>
              <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
                <button 
                  onClick={handleCopyCode}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary"
                  title="Kodu Kopyala"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Mail className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => setDeleteConfirm({
                    id: 'refresh',
                    type: 'refresh_code',
                    title: 'Kodu Yenile?',
                    message: 'Yeni bir katılım kodu oluşturmak istediğinize emin misiniz? Eski kod artık çalışmayacaktır.'
                  })}
                  disabled={refreshingCode}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
                  title="Kodu Yenile"
                >
                  <ArrowRightLeft className={`w-3.5 h-3.5 ${refreshingCode ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )}
          {isOwner && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all text-sm shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Birey Ekle
            </button>
          )}
        </div>
      </div>

      {isOwner && household.joinCode && (
        <div className="md:hidden p-4 bg-card border border-border rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Katılım Kodu</span>
            <span className="text-lg font-mono font-bold text-primary tracking-widest">{household.joinCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopyCode}
              className="p-2 bg-muted rounded-xl transition-colors text-muted-foreground"
              title="Kodu Kopyala"
            >
              {copySuccess ? <Check className="w-5 h-5 text-emerald-500" /> : <Mail className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setDeleteConfirm({
                id: 'refresh',
                type: 'refresh_code',
                title: 'Kodu Yenile?',
                message: 'Yeni bir katılım kodu oluşturmak istediğinize emin misiniz? Eski kod artık çalışmayacaktır.'
              })}
              disabled={refreshingCode}
              className="p-2 bg-muted rounded-xl transition-colors text-muted-foreground disabled:opacity-50"
              title="Kodu Yenile"
            >
              <ArrowRightLeft className={`w-5 h-5 ${refreshingCode ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {isOwner && joinRequests.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            Bekleyen Katılım İstekleri
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {joinRequests.map(request => (
              <div key={request.id} className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-foreground">{request.displayName}</h5>
                  <p className="text-xs text-muted-foreground">{request.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                    title="Reddet"
                  >
                    <UserX className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsApproveModalOpen(true);
                    }}
                    className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-colors"
                    title="Onayla"
                  >
                    <UserCheck className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(household.members).map(([id, member]) => (
          <div key={id} className="bg-card border border-border p-5 rounded-3xl flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${
                member.type === 'adult' ? 'bg-blue-500/10 text-blue-500' :
                member.type === 'child' ? 'bg-purple-500/10 text-purple-500' :
                member.type === 'elderly' ? 'bg-destructive/10 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
                {member.type === 'adult' ? <Shield className="w-6 h-6" /> :
                 member.type === 'child' ? <Baby className="w-6 h-6" /> :
                 member.type === 'elderly' ? <Heart className="w-6 h-6" /> :
                 <UserIcon className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground">{member.displayName}</h4>
                  {id === household.ownerId && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Hane Sahibi</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{member.email || 'E-posta yok'}</p>
                {isOwner && id !== household.ownerId ? (
                  <select
                    value={member.type}
                    onChange={(e) => handleChangeMemberType(id, e.target.value as any)}
                    className="text-[10px] bg-background border border-border text-muted-foreground mt-1 uppercase font-bold tracking-wider rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="adult">Yetişkin</option>
                    <option value="child">Çocuk</option>
                    <option value="elderly">Yaşlı</option>
                    <option value="other">Diğer</option>
                  </select>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">
                    {member.type === 'adult' ? 'Yetişkin' : member.type === 'child' ? 'Çocuk' : member.type === 'elderly' ? 'Yaşlı' : 'Diğer'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwner && id.startsWith('virtual-') && Object.keys(household.members).some(mid => !mid.startsWith('virtual-') && mid !== household.ownerId) && (
                <button
                  onClick={() => {
                    setSelectedVirtualMemberId(id);
                    setIsMergeModalOpen(true);
                  }}
                  className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                  title="Gerçek Kullanıcı ile Eşleştir"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                </button>
              )}
              {isOwner && id !== currentUserId && (
                <button
                  onClick={() => setDeleteConfirm({
                    id,
                    type: 'member',
                    title: 'Bireyi Çıkar?',
                    message: 'Bu üyeyi haneden çıkarmak istediğinize emin misiniz?'
                  })}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  title="Üyeyi Çıkar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isApproveModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">İsteği Onayla</h3>
                <button onClick={() => setIsApproveModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">
                  <span className="font-bold">{selectedRequest.displayName}</span> kullanıcısını haneye eklemek üzeresiniz. 
                  Bu kullanıcıyı mevcut bir taslak birey ile eşleştirmek ister misiniz?
                </p>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eşleştirilecek Taslak Birey (Opsiyonel)</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    <button
                      onClick={() => setSelectedVirtualMemberId(null)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all w-full ${
                        selectedVirtualMemberId === null 
                          ? 'bg-primary/10 border-primary text-foreground' 
                          : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold">Yeni Birey Olarak Ekle</p>
                        <p className="text-xs opacity-60">Eşleştirme yapmadan yeni bir üye oluşturur.</p>
                      </div>
                    </button>

                    {Object.entries(household.members)
                      .filter(([mid]) => mid.startsWith('virtual-'))
                      .map(([mid, m]) => (
                        <button
                          key={mid}
                          onClick={() => setSelectedVirtualMemberId(mid)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all w-full ${
                            selectedVirtualMemberId === mid 
                              ? 'bg-primary/10 border-primary text-foreground' 
                              : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'
                          }`}
                        >
                          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{m.displayName}</p>
                            <p className="text-xs opacity-60">Taslak Birey</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                <button
                  onClick={() => handleApproveRequest(selectedRequest.id, selectedVirtualMemberId || undefined)}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
                >
                  {loading ? 'Onaylanıyor...' : 'Onayla ve Ekle'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMergeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Birey Eşleştir</h3>
                <button onClick={() => setIsMergeModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-foreground">
                  "<span className="text-foreground font-bold">{household.members[selectedVirtualMemberId!]?.displayName}</span>" (Taslak) kaydını hangi gerçek kullanıcı ile eşleştirmek istersiniz?
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gerçek Kullanıcı Seçin</label>
                  <div className="space-y-2">
                    {Object.entries(household.members)
                      .filter(([mid]) => !mid.startsWith('virtual-') && mid !== household.ownerId)
                      .map(([mid, m]) => (
                        <button
                          key={mid}
                          onClick={() => setSelectedRealMemberId(mid)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all w-full ${
                            selectedRealMemberId === mid 
                              ? 'bg-primary/10 border-primary text-foreground' 
                              : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'
                          }`}
                        >
                          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{m.displayName}</p>
                            <p className="text-xs opacity-60">{m.email}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
                <button
                  onClick={handleMergeMembers}
                  disabled={!selectedRealMemberId || loading}
                  className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  {loading ? 'Eşleştiriliyor...' : 'Eşleştirmeyi Tamamla'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-xl font-bold text-foreground">Yeni Birey Ekle</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleAddMember} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ad Soyad</label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Örn: Ayşe Yılmaz"
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-posta (Opsiyonel)</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Örn: ayse@example.com"
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Birey Tipi</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'adult', label: 'Yetişkin', icon: Shield },
                      { id: 'child', label: 'Çocuk', icon: Baby },
                      { id: 'elderly', label: 'Yaşlı', icon: Heart },
                      { id: 'other', label: 'Diğer', icon: UserIcon },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewMemberType(type.id as any)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                          newMemberType === type.id
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'
                        }`}
                      >
                        <type.icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mt-4 disabled:opacity-50"
                >
                  {loading ? 'Ekleniyor...' : 'Bireyi Ekle'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.type === 'refresh_code') handleRefreshCode();
          if (deleteConfirm.type === 'member') handleRemoveMember(deleteConfirm.id);
        }}
        title={deleteConfirm?.title || ''}
        message={deleteConfirm?.message || ''}
      />
    </div>
  );
};
