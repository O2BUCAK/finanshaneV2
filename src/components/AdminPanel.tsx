import React, { useState, useEffect } from 'react';
import { localDB } from '../db';
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
      const allUsers = await localDB.users.toArray();
      const allHouseholds = await localDB.households.toArray();
      
      setUsers(allUsers as UserProfile[]);
      setHouseholds(allHouseholds as Household[]);
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      setStatus({ type: 'error', message: `Veriler yüklenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}` });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await localDB.users.delete(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setStatus({ type: 'success', message: 'Kullanıcı silindi.' });
    } catch (error) {
      console.error('Error deleting user:', error);
      setStatus({ type: 'error', message: 'Kullanıcı silinirken bir hata oluştu.' });
    }
    setConfirmDelete(null);
  };

  const deleteHousehold = async (householdId: string) => {
    try {
      await localDB.households.delete(householdId);
      // In local DB, we might want to delete related data too
      await localDB.accounts.where('householdId').equals(householdId).delete();
      await localDB.transactions.where('householdId').equals(householdId).delete();
      
      setHouseholds(prev => prev.filter(h => h.id !== householdId));
      setStatus({ type: 'success', message: 'Hane ve ilişkili verileri silindi.' });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/50 p-6 rounded-3xl border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            Yönetim Paneli (Yerel Veri)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Cihazınızdaki kullanıcıları ve haneleri yönetin.</p>
        </div>
        
        <div className="flex bg-background p-1 rounded-2xl border border-border">
          <button 
            onClick={() => setActiveView('users')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'users' ? 'bg-muted text-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-4 h-4" />
            Kullanıcılar ({users.length})
          </button>
          <button 
            onClick={() => setActiveView('households')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'households' ? 'bg-muted text-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Home className="w-4 h-4" />
            Haneler ({households.length})
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input 
          type="text"
          placeholder={activeView === 'users' ? "İsim veya e-posta ile ara..." : "Hane adı ile ara..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-card border border-border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
        />
      </div>

      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center justify-between ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}
        >
          <div className="flex items-center gap-3">
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
          <button onClick={() => setStatus(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {activeView === 'users' ? 'Kullanıcı Bilgisi' : 'Hane Bilgisi'}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {activeView === 'users' ? 'Rol / Durum' : 'Sahip / Üyeler'}
              </th>
              <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Kayıt Tarihi</th>
              <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-muted-foreground text-sm">Veriler yükleniyor...</span>
                  </div>
                </td>
              </tr>
            ) : activeView === 'users' ? (
              filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-foreground">
                        {u.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit uppercase tracking-wider ${u.isAdmin ? 'bg-destructive/10 text-destructive' : 'bg-blue-500/10 text-blue-500'}`}>
                        {u.isAdmin ? 'Yönetici' : 'Kullanıcı'}
                      </span>
                      {u.kvkkAccepted && (
                        <span className="text-[10px] text-emerald-500 font-medium">KVKK Onaylı</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      disabled={u.email === currentUserEmail}
                      onClick={() => setConfirmDelete({ id: u.id, type: 'user', name: u.fullName })}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              filteredHouseholds.map(h => (
                <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-foreground">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{h.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {h.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(h.members || {}).length} Üye
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-muted-foreground">
                      {h.createdAt ? new Date(h.createdAt).toLocaleDateString('tr-TR') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setConfirmDelete({ id: h.id, type: 'household', name: h.name })}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && (activeView === 'users' ? filteredUsers : filteredHouseholds).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-2 text-foreground">Veri Silme Onayı</h3>
              <p className="text-muted-foreground text-center mb-8">
                <span className="font-bold text-foreground">{confirmDelete.name}</span> isimli {confirmDelete.type === 'user' ? 'kullanıcıyı' : 'haneyi'} ve tüm ilişkili verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="px-6 py-4 rounded-2xl bg-muted text-foreground font-bold hover:bg-muted/80 transition-all"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={() => confirmDelete.type === 'user' ? deleteUser(confirmDelete.id) : deleteHousehold(confirmDelete.id)}
                  className="px-6 py-4 rounded-2xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
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
