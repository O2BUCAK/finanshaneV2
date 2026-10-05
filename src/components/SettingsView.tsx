import React from 'react';
import { 
  ShieldCheck, 
  Shield, 
  Download, 
  Trash2, 
  Save, 
  ChevronDown, 
  Mail, 
  Copy, 
  ArrowUpRight, 
  LogOut 
} from 'lucide-react';
import { Household, UserProfile } from '../types';
import { HouseholdMembers } from './HouseholdMembers';

interface SettingsViewProps {
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  } | null;
  profile: UserProfile | null;
  household: Household | null;
  householdName: string;
  setHouseholdName: (val: string) => void;
  householdCurrency: string;
  setHouseholdCurrency: (val: string) => void;
  isUpdatingHousehold: boolean;
  handleUpdateHousehold: () => void;
  setIsAuditModalOpen: (open: boolean) => void;
  handleExportData: () => void;
  setIsDeleteAllDataConfirmOpen: (open: boolean) => void;
  handleLogout: () => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  profile,
  household,
  householdName,
  setHouseholdName,
  householdCurrency,
  setHouseholdCurrency,
  isUpdatingHousehold,
  handleUpdateHousehold,
  setIsAuditModalOpen,
  handleExportData,
  setIsDeleteAllDataConfirmOpen,
  handleLogout,
  showNotification,
}) => {
  return (
    <div className="max-w-2xl space-y-8">
      {/* 1. Profil Ayarları */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-6">Profil Ayarları</h3>
        <div className="flex items-center gap-6 mb-8">
          <img 
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'User'}`} 
            className="w-20 h-20 rounded-2xl border-2 border-zinc-800" 
            alt="Avatar" 
          />
          <div>
            <h4 className="text-lg font-bold">{user?.displayName || 'Kullanıcı'}</h4>
            <p className="text-zinc-300">{user?.email}</p>
            {profile?.isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 uppercase tracking-wider mt-1 inline-block">
                Yönetici
              </span>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Ad Soyad</label>
            <input 
              type="text" 
              defaultValue={user?.displayName || ''} 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">E-posta</label>
            <input 
              type="email" 
              disabled
              defaultValue={user?.email || ''} 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* 2. KVKK ve Bilgi Güvenliği */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-500" /> KVKK ve Bilgi Güvenliği
        </h3>
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mb-6">
          <p className="text-sm text-emerald-200/80 leading-relaxed">
            <strong>Güvenlik Notu:</strong> FinansHane, verilerinizi güvenli bir bulut altyapısında (Firebase) 
            şifrelenmiş olarak saklar ve hızlı erişim için yerel olarak önbelleğe alır. Tüm hassas verileriniz 
            2026 Türkiye KVKK standartlarına tam uyumlu şekilde korunmaktadır.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div>
              <h4 className="font-bold text-sm">Güvenlik Günlükleri</h4>
              <p className="text-xs text-zinc-300">Son 50 güvenlik işlemini görüntüleyin.</p>
            </div>
            <button 
              onClick={() => setIsAuditModalOpen(true)}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all text-zinc-400"
              title="Güvenlik Günlüklerini Aç"
            >
              <Shield className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div>
              <h4 className="font-bold text-sm">Verilerimi Dışa Aktar</h4>
              <p className="text-xs text-zinc-300">Tüm finansal verilerinizi JSON formatında indirin.</p>
            </div>
            <button 
              onClick={handleExportData}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all text-emerald-500"
              title="Verileri Dışa Aktar"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
            <div>
              <h4 className="font-bold text-sm text-rose-500">Hesabımı ve Verilerimi Sil</h4>
              <p className="text-xs text-zinc-300">Tüm verileriniz kalıcı olarak cihazınızdan silinecektir.</p>
            </div>
            <button 
              onClick={() => setIsDeleteAllDataConfirmOpen(true)}
              className="p-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-xl transition-all text-rose-500"
              title="Tüm Verileri Sil"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Hane Ayarları */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Hane Ayarları</h3>
          {household && user && household.ownerId === user.uid && (
            <button
              onClick={handleUpdateHousehold}
              disabled={isUpdatingHousehold || !householdName.trim()}
              className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpdatingHousehold ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Kaydet
            </button>
          )}
        </div>
        <div className="space-y-4 mb-8">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Hane Adı</label>
            <input 
              type="text" 
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              disabled={household?.ownerId !== user?.uid}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Para Birimi</label>
            <div className="relative">
              <select 
                value={householdCurrency}
                onChange={(e) => setHouseholdCurrency(e.target.value)}
                disabled={household?.ownerId !== user?.uid}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none disabled:opacity-50"
              >
                <option value="TRY">Türk Lirası (₺)</option>
                <option value="USD">Amerikan Doları ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {household && user && household.ownerId === user.uid && (
          <div className="flex justify-end mb-8">
            <button
              onClick={handleUpdateHousehold}
              disabled={isUpdatingHousehold || !householdName.trim()}
              className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full md:w-auto justify-center shadow-lg shadow-emerald-500/20"
            >
              {isUpdatingHousehold ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Hane Ayarlarını Kaydet
            </button>
          </div>
        )}

        {household && user && (
          <HouseholdMembers 
            household={household} 
            currentUserId={user.uid} 
            showNotification={showNotification}
          />
        )}
      </div>

      {/* 4. Öneri, İstek ve Görüşler İletişim Kartı */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-500" /> Öneri, İstek ve Görüşler
        </h3>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          FinansHane deneyiminizi iyileştirmemiz için her türlü görüş, özellik talebi veya önerinizi doğrudan iletebilirsiniz.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-zinc-950 border border-zinc-800 rounded-2xl gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-medium">Doğrudan İletişim E-Postası</div>
              <div className="text-sm font-semibold text-white font-mono">ersin@ozbucak.com.tr</div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('ersin@ozbucak.com.tr');
                showNotification('E-posta adresi panoya kopyalandı.', 'success');
              }}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-800"
            >
              <Copy className="w-3.5 h-3.5" />
              Kopyala
            </button>
            <a 
              href="mailto:ersin@ozbucak.com.tr?subject=FinansHane%20%C3%96neri%2C%20%C4%B0stek%20ve%20G%C3%B6r%C3%BC%C5%9Fler"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Mail Gönder
            </a>
          </div>
        </div>
      </div>

      {/* 5. Oturumu Kapat */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold"
        >
          <LogOut className="w-5 h-5" />
          <span>Oturumu Kapat</span>
        </button>
      </div>
    </div>
  );
};
