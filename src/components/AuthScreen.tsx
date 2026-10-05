import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, AlertCircle, ArrowUpRight } from 'lucide-react';
import { localDB } from '../db';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { KVKKConsentModal } from './KVKKConsentModal';

interface AuthScreenProps {
  initialView?: 'login' | 'register';
  onViewChange: (view: 'landing' | 'app') => void;
  login: (email: string, name: string, kvkkAccepted: boolean) => Promise<void>;
  loginWithGoogle: (kvkkAccepted: boolean) => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialView = 'login',
  onViewChange,
  login,
  loginWithGoogle
}) => {
  const [view, setView] = useState<'login' | 'register'>(initialView);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [isKvkkModalOpen, setIsKvkkModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(initialView);
    setError(null);
  }, [initialView]);

  // Dynamic SEO Tags based on active view
  useEffect(() => {
    const title = view === 'login' 
      ? 'Giriş Yap | FinansHane Ev Bütçesi Takip Sistemi' 
      : 'Kayıt Ol | FinansHane Ev Bütçesi Takip Sistemi';
    const description = view === 'login'
      ? 'FinansHane hesabınıza güvenle giriş yapın ve ev bütçenizi yönetmeye hemen devam edin. %100 KVKK uyumlu.'
      : 'Ücretsiz FinansHane hesabı açın. Çift kayıtlı aile bütçesi, ortak hane halkı paylaşımı ve harcama planlama özellikleri ile bütçenizi düzene sokun.';
    const keywords = view === 'login'
      ? 'finanshane giriş, bütçe takip giriş, üye girişi, ev bütçesi yönetim paneli'
      : 'finanshane kayıt ol, bütçe takip üye ol, ücretsiz hesap aç, aile bütçe kaydı';

    document.title = title;
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);
  }, [view]);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (view === 'register') {
      if (!kvkkAccepted) {
        setError("Lütfen KVKK Aydınlatma Metni'ni onaylayın.");
        return;
      }
      setIsLoggingIn(true);
      try {
        await login(email, name, kvkkAccepted);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Kayıt sırasında hata oluştu.';
        setError(message);
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      // Login View (Only E-mail needed)
      setIsLoggingIn(true);
      try {
        const existingUsers = await localDB.users.where('email').equalsIgnoreCase(email).toArray();
        if (existingUsers.length > 0) {
          const u = existingUsers[0];
          await login(u.email, u.fullName, true);
        } else {
          let foundInFirestore = false;
          try {
            const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              const uDoc = querySnap.docs[0];
              const uData = uDoc.data();
              await login(uData.email, uData.fullName, true);
              foundInFirestore = true;
            }
          } catch (fErr) {
            console.error('Firestore user lookup error:', fErr);
          }

          if (!foundInFirestore) {
            setError('Bu e-posta adresiyle kayıtlı bir hesap bulunamadı. Lütfen "Kayıt Ol" sekmesinden yeni hesap oluşturun.');
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Giriş yapılamadı.';
        setError(message);
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle(true);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Giriş penceresi kapatıldı veya önizleme ortamı tarafından engellendi. Lütfen tekrar deneyin veya "Yerel E-posta" seçeneğini kullanın.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Ağ hatası oluştu. Bu durum genellikle tarayıcının önizleme penceresini (iframe) engellemesinden kaynaklanır. Lütfen uygulamayı yeni bir sekmede açarak deneyin veya "Yerel E-posta" seçeneğini kullanın.');
      } else {
        setError(err?.message || 'Google ile giriş yapılamadı.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative">
      {/* Decorative Blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={() => onViewChange('landing')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-all hover:bg-zinc-800 min-h-[44px]"
      >
        ← Tanıtım Sayfasına Dön
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-emerald-500/10 rounded-3xl mb-2 border border-emerald-500/20">
            <Wallet className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">FinansHane</h1>
          <p className="text-zinc-400 text-xs md:text-sm">
            {view === 'login' 
              ? 'Güvenli ve şifreli ev finansal yönetim sistemi' 
              : 'Ücretsiz aile bütçe takibine hemen katılın'}
          </p>
        </div>

        <div className="space-y-6 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl backdrop-blur-sm">
          {/* Subview Tabs */}
          <div className="grid grid-cols-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-center text-xs font-bold">
            <button 
              onClick={() => setView('login')}
              className={`py-2.5 rounded-lg transition-all min-h-[38px] ${view === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Giriş Yap
            </button>
            <button 
              onClick={() => setView('register')}
              className={`py-2.5 rounded-lg transition-all min-h-[38px] ${view === 'register' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Yeni Kayıt
            </button>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs flex items-center gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google SSO Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Google ile Devam Et</span>
          </button>

          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="w-full flex items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-400 text-[10px] font-medium transition-all min-h-[30px]"
          >
            <ArrowUpRight className="w-3 h-3" />
            Sorun mu yaşıyorsunuz? Yeni sekmede açın
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
              <span className="bg-[#121214] px-3.5 text-zinc-500 font-bold">Veya E-posta ile Devam Et</span>
            </div>
          </div>

          <form onSubmit={handleLocalSubmit} className="space-y-4">
            {view === 'register' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-zinc-700 text-sm min-h-[44px]"
                  placeholder="Adınız Soyadınız"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">E-posta Adresi</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-zinc-700 text-sm min-h-[44px]"
                placeholder="ornek@e-posta.com"
              />
            </div>

            {view === 'register' && (
              <div className="flex items-start gap-3 py-2">
                <div className="flex items-center h-5">
                  <input
                    id="kvkk"
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={(e) => setKvkkAccepted(e.target.checked)}
                    className="w-4 h-4 bg-zinc-950 border-zinc-800 rounded text-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
                <label htmlFor="kvkk" className="text-xs text-zinc-400 leading-relaxed select-none">
                  <button 
                    type="button"
                    onClick={() => setIsKvkkModalOpen(true)}
                    className="text-emerald-500 hover:underline font-bold"
                  >
                    KVKK Aydınlatma Metni
                  </button>
                  &apos;ni okudum ve verilerimin güvenli şekilde işlenmesini onaylıyorum.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 min-h-[44px]"
            >
              {isLoggingIn 
                ? 'İşlem Sürüyor...' 
                : view === 'login' 
                  ? 'Giriş Yap' 
                  : 'Kayıt Ol ve Başla'}
            </button>
          </form>

          {/* Bottom toggle advice */}
          <div className="text-center pt-2">
            {view === 'login' ? (
              <button 
                onClick={() => setView('register')}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Hesabınız yok mu? <span className="text-emerald-500 font-bold hover:underline">Yeni kayıt oluşturun →</span>
              </button>
            ) : (
              <button 
                onClick={() => setView('login')}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Zaten hesabınız var mı? <span className="text-emerald-500 font-bold hover:underline">Giriş yapın →</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <KVKKConsentModal 
        isOpen={isKvkkModalOpen} 
        onAccept={() => {
          setKvkkAccepted(true);
          setIsKvkkModalOpen(false);
        }} 
      />
    </div>
  );
};
