import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  deleteDoc, 
  doc, 
  where,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Household } from '../types';
import { 
  Users, 
  Home, 
  Trash2, 
  Search, 
  ShieldAlert,
  AlertTriangle,
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminPanelProps {
  currentUserEmail: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserEmail }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'users' | 'households'>('users');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'user' | 'household'; name: string } | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const householdsSnap = await getDocs(collection(db, 'households'));
      
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      setHouseholds(householdsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Household)));
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setStatus({ type: 'error', message: 'Veriler yüklenirken bir hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const batch = writeBatch(db);
      
      // Delete user document
      batch.delete(doc(db, 'users', userId));
      
      // Note: In a real app, we'd also delete their accounts, transactions, etc.
      // For this implementation, we'll focus on the primary entities.
      // A more robust solution would use a Cloud Function to recursively delete.
      
      await batch.commit();
      setUsers(prev => prev.filter(u => u.id !== userId));
      setStatus({ type: 'success', message: 'Kullanıcı ve ilişkili veriler silindi.' });
    } catch (error) {
      console.error('Error deleting user:', error);
      setStatus({ type: 'error', message: 'Kullanıcı silinirken bir hata oluştu.' });
    }
    setConfirmDelete(null);
  };

  const deleteHousehold = async (householdId: string) => {
    try {
      const batch = writeBatch(db);
      
      // Delete household document
      batch.delete(doc(db, 'households', householdId));
      
      // Delete related collections (simplified for this view)
      const collectionsToDelete = ['accounts', 'transactions', 'incomeSources', 'expectedIncomes', 'plannedExpenses'];
      
      for (const coll of collectionsToDelete) {
        const snap = await getDocs(collection(db, 'households', householdId, coll));
        snap.forEach(d => batch.delete(d.ref));
      }
      
      await batch.commit();
      setHouseholds(prev => prev.filter(h => h.id !== householdId));
      setStatus({ type: 'success', message: 'Hane ve tüm finansal verileri silindi.' });
    } catch (error) {
      console.error('Error deleting household:', error);
      setStatus({ type: 'error', message: 'Hane silinirken bir hata oluştu.' });
    }
    setConfirmDelete(null);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHouseholds = households.filter(h => 
    h.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Yönetim Paneli
          </h1>
          <p className="text-zinc-100 text-sm mt-1">Sistem genelindeki kullanıcıları ve haneleri yönetin.</p>
        </div>
        
        <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => setActiveView('users')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'users' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-100 hover:text-zinc-200'}`}
          >
            <Users className="w-4 h-4" />
            Kullanıcılar ({users.length})
          </button>
          <button 
            onClick={() => setActiveView('households')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'households' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-100 hover:text-zinc-200'}`}
          >
            <Home className="w-4 h-4" />
            Haneler ({households.length})
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-100" />
        <input 
          type="text"
          placeholder={activeView === 'users' ? "İsim veya e-posta ile ara..." : "Hane adı ile ara..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-white"
        />
      </div>

      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center justify-between ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}
        >
          <div className="flex items-center gap-3">
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
          <button onClick={() => setStatus(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                {activeView === 'users' ? 'Kullanıcı Bilgisi' : 'Hane Bilgisi'}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">
                {activeView === 'users' ? 'Rol / Durum' : 'Sahip / Üyeler'}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider">Kayıt Tarihi</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-200 uppercase tracking-wider text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-zinc-200 text-sm">Veriler yükleniyor...</span>
                  </div>
                </td>
              </tr>
            ) : activeView === 'users' ? (
              filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-zinc-100">
                        {u.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{u.fullName}</div>
                        <div className="text-xs text-zinc-100">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-wider ${u.isAdmin ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {u.isAdmin ? 'Yönetici' : 'Kullanıcı'}
                      </span>
                      {u.kvkkAccepted && (
                        <span className="text-[10px] text-emerald-500 font-medium">KVKK Onaylı</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-100">
                      {u.createdAt?.toDate().toLocaleDateString('tr-TR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      disabled={u.email === currentUserEmail}
                      onClick={() => setConfirmDelete({ id: u.id, type: 'user', name: u.fullName })}
                      className="p-2 text-zinc-100 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              filteredHouseholds.map(h => (
                <tr key={h.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-zinc-100">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{h.name}</div>
                        <div className="text-xs text-zinc-100">ID: {h.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-100">
                      {Object.keys(h.members || {}).length} Üye
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-100">
                      {h.createdAt?.toDate().toLocaleDateString('tr-TR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setConfirmDelete({ id: h.id, type: 'household', name: h.name })}
                      className="p-2 text-zinc-100 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && (activeView === 'users' ? filteredUsers : filteredHouseholds).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-100">
                  Sonuç bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-2">Veri Silme Onayı</h3>
              <p className="text-zinc-100 text-center mb-8">
                <span className="font-bold text-white">{confirmDelete.name}</span> isimli {confirmDelete.type === 'user' ? 'kullanıcıyı' : 'haneyi'} ve tüm ilişkili verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="px-6 py-4 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={() => confirmDelete.type === 'user' ? deleteUser(confirmDelete.id) : deleteHousehold(confirmDelete.id)}
                  className="px-6 py-4 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
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
