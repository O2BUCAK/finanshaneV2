import React, { useState, useMemo } from 'react';
import { 
  Wallet, ShieldCheck, Users, ArrowRight, Check, HelpCircle, 
  ChevronDown, Search, Calculator, Shield, Sparkles, TrendingUp,
  Percent, ArrowUpRight, DollarSign, Euro, Coins, Lock, Star, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// SEO Meta & Structured Data Component
interface SeoMetaProps {
  title: string;
  description: string;
  keywords: string;
}

const SeoMeta: React.FC<SeoMetaProps> = ({ title, description, keywords }) => {
  React.useEffect(() => {
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

    // Ingest Structured Data (JSON-LD)
    let scriptTag = document.getElementById('json-ld-seo') as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'json-ld-seo';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "FinansHane",
      "operatingSystem": "All",
      "applicationCategory": "FinanceApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "TRY"
      },
      "description": description,
      "featureList": [
        "Çift Kayıtlı Ev Muhasebesi",
        "Hane İçi Ortak Bütçe",
        "KVKK ve Bilgi Güvenliği Uyumlu",
        "Gider ve Gelir Tahminleme",
        "Kripto ve Akbil Takibi"
      ],
      "author": {
        "@type": "Organization",
        "name": "FinansHane"
      }
    };
    scriptTag.textContent = JSON.stringify(jsonLd);

    return () => {
      // Keep cleanup minimal to prevent flickering
    };
  }, [title, description, keywords]);

  return null;
};

interface SaasLandingProps {
  onViewChange: (view: 'landing' | 'login' | 'register') => void;
}

export const SaasLanding: React.FC<SaasLandingProps> = ({ onViewChange }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [faqSearch, setFaqSearch] = useState('');
  
  // Interactive Calculator State
  const [calcIncome, setCalcIncome] = useState<number>(35000);
  const [calcRent, setCalcRent] = useState<number>(12000);
  const [calcFood, setCalcFood] = useState<number>(6000);
  const [calcOther, setCalcOther] = useState<number>(5000);

  const calcTotalExpenses = calcRent + calcFood + calcOther;
  const calcSavings = calcIncome - calcTotalExpenses;
  const calcSavingsRatio = calcIncome > 0 ? (calcSavings / calcIncome) * 100 : 0;

  const budgetGrade = useMemo(() => {
    if (calcSavingsRatio >= 30) return { label: 'Mükemmel Finansal Sağlık', color: 'text-emerald-400', desc: 'Gelirinizin %30\'undan fazlasını biriktiriyorsunuz. 2026 ekonomik koşullarında harika bir tasarruf oranı!' };
    if (calcSavingsRatio >= 15) return { label: 'İyi ve Dengeli Bütçe', color: 'text-amber-400', desc: 'Tasarruf oranınız standartların üzerinde. Güvenli limandasınız fakat beklenmedik harcamalara dikkat edin.' };
    if (calcSavingsRatio > 0) return { label: 'Sınırda Finansal Durum', color: 'text-orange-400', desc: 'Harcamalarınız gelirinizle neredeyse başa baş. Bütçenizi kontrol altına alıp gereksiz abonelikleri kısmalısınız.' };
    return { label: 'Riskli / Açık Veren Bütçe', color: 'text-rose-400', desc: 'Giderleriniz gelirinizi aşıyor ya da ucu ucuna yetiyor. Borç sarmalına girmemek için FinansHane\'nin bütçe planlamasını kullanmalısınız.' };
  }, [calcSavingsRatio]);

  const faqs = [
    {
      q: "FinansHane bütçe takip uygulaması güvenli mi?",
      a: "Evet, son derece güvenlidir. Tüm verileriniz bulut veri tabanlarında (Firebase Firestore) modern şifreleme yöntemleriyle saklanır. Finansal verileriniz kesinlikle üçüncü şahıslarla paylaşılmaz veya analiz amaçlı satılmaz. Bilgi güvenliği bizim en yüksek önceliğimizdir."
    },
    {
      q: "FinansHane 2026 Türkiye KVKK yasalarına uygun mu?",
      a: "Kesinlikle. Uygulamamız 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ile tam uyumludur. Kullanıcılarımızın rızası dışında hiçbir işlem yapılmaz. İstediğiniz an verilerinizi tamamen sıfırlayabilir, dışa aktarabilir ya da hesabınızı kalıcı olarak silebilirsiniz."
    },
    {
      q: "FinansHane gerçekten tamamen ücretsiz mi? Herhangi bir gizli ücret veya abonelik var mı?",
      a: "Evet, FinansHane'deki tüm özellikler istisnasız tüm kullanıcılarımız için %100 ve ömür boyu ücretsizdir. Banka ekstre yükleme, çift kayıtlı muhasebe, ortak hane bütçesi, AiAdvisor yapay zeka analizleri ve Excel/PDF raporları için hiçbir abonelik ücreti, gizli masraf veya ücretli sürüm ayrımı yoktur."
    },
    {
      q: "Çift kayıtlı muhasebe sistemi nedir, bana ne fayda sağlar?",
      a: "Çift kayıtlı muhasebe (Double-Entry Ledger), her harcama ve gelirin bir hesaptan çıkıp diğerine girmesidir (örn. Maaş hesabından Nakit hesabına aktarım veya Kredi Kartından Gıda kategorisine harcama). Bu sayede bütçenizde hiçbir kuruş kaybolmaz ve gerçek hane varlığınız kuruşu kuruşuna doğru hesaplanır."
    },
    {
      q: "Kripto varlıkları ve Akbil (İstanbulkart) gibi yerel kartlarımı takip edebilir miyim?",
      a: "Evet. FinansHane modern Türkiye hane yapısına uygun olarak tasarlanmıştır. Akbil yüklemelerinizi, aboneliklerinizi, nakit, banka hesaplarınızı ve kripto varlıklarınızı tek bir ekrandan eş zamanlı olarak yönetebilirsiniz."
    },
    {
      q: "Ortak bütçe kullanımını nasıl yapıyoruz?",
      a: "Hane halkı üyelerini bütçenize e-posta ile davet ederek ortak hesapları yönetebilirsiniz. Herkes kendi telefonundan/tarayıcısından işlemleri girdiğinde ortak bütçe anında güncellenir. Bu, aile içi şeffaflığı ve bütçe disiplinini artırır."
    }
  ];

  const filteredFaqs = faqs.filter(
    item => item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
            item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased overflow-x-hidden">
      {/* SEO META TAGS - public landing, login and register SEO target */}
      <SeoMeta 
        title="FinansHane | Türkiye'nin En Gelişmiş Ücretsiz Ev Bütçesi Takip Sistemi"
        description="FinansHane ile bütçenizi, harcamalarınızı ve borçlarınızı çift kayıtlı muhasebe gücüyle takip edin. 2026 KVKK uyumlu, güvenli ve ömür boyu ücretsiz aile bütçe yönetim aracı."
        keywords="ev bütçesi takip, aile bütçesi programı, ücretsiz bütçe takip uygulaması, KVKK uyumlu finans, çift kayıtlı muhasebe ev bütçesi, gelir gider tablosu, bütçe yönetimi saas, tasarruf hesaplama"
      />

      {/* Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none blur-3xl z-0" />
      <div className="absolute top-[800px] -right-20 w-[400px] h-[400px] bg-emerald-500/5 rounded-full pointer-events-none blur-3xl z-0" />

      {/* 1. Header / Navbar */}
      <header className="relative z-10 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="font-sans font-bold text-lg tracking-tight text-white">FinansHane</span>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#ozellikler" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#güvenlik" className="hover:text-white transition-colors">Güvenlik ve KVKK</a>
            <a href="#hesaplayici" className="hover:text-white transition-colors">Bütçe Analizi</a>
            <a href="#ucretsiz" className="hover:text-white transition-colors">Tamamen Ücretsiz</a>
            <a href="#sss" className="hover:text-white transition-colors">Sıkça Sorulanlar</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => onViewChange('login')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all min-h-[44px]"
              id="nav-login-btn"
            >
              Giriş Yap
            </button>
            <button 
              onClick={() => onViewChange('register')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 min-h-[44px] flex items-center gap-1.5"
              id="nav-register-btn"
            >
              Kayıt Ol <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* 2. Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-28 pb-20 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" /> 2026 Model Akıllı Ev Bütçesi
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto"
          >
            Ev Bütçenizi Profesyonel <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Muhasebe Hassasiyetiyle</span> Yönetin
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-zinc-400 text-base md:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            FinansHane; bütçe planlama, borç-alacak dengesi ve hane halkı ortak kullanımı için tasarlanmış, 2026 Türkiye vergilendirme ve KVKK yasalarıyla tam uyumlu, çift kayıtlı ilk akıllı aile finans platformudur.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button 
              onClick={() => onViewChange('register')}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/25 flex items-center justify-center gap-2 text-base min-h-[48px]"
              id="hero-start-btn"
            >
              Hemen Ücretsiz Başlayın <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                const el = document.getElementById('hesaplayici');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-2xl font-semibold transition-all border border-zinc-800 flex items-center justify-center gap-2 text-base min-h-[48px]"
            >
              <Calculator className="w-5 h-5 text-emerald-500" /> Bütçeni Test Et
            </button>
          </motion.div>

          {/* Interactive Mockup Dashboard built in Tailwind */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="pt-12 max-w-5xl mx-auto relative"
          >
            <div className="absolute inset-0 bg-emerald-500/5 rounded-[32px] filter blur-xl pointer-events-none" />
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-[32px] shadow-2xl overflow-hidden p-3 md:p-6 text-left">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                  <span className="text-xs text-zinc-500 ml-2 font-mono">finanshane.com/dashboard</span>
                </div>
                <div className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> KVKK Aktif
                </div>
              </div>

              {/* Grid content representing dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Net Worth Card */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Toplam Hane Varlığı</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">142,450.00 ₺</div>
                  <div className="mt-3 flex gap-2">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold font-mono">USD Eşdeğeri: $4,380.00</span>
                  </div>
                </div>
                
                {/* Active Budget Progress Card */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Temmuz 2026 Gider Bütçesi</span>
                    <span className="text-xs font-bold text-rose-400">%64</span>
                  </div>
                  <div className="text-2xl font-black text-white mt-1">21,400.00 ₺ / 33,000.00 ₺</div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 mt-3 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '64%' }} />
                  </div>
                </div>

                {/* Hane Halkı Üyeleri Card */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Hane Halkı (Ortak Kullanım)</span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-emerald-400">EÖ</div>
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-sky-400">SÖ</div>
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-amber-400">MÖ</div>
                    <div className="text-xs text-zinc-400 ml-1 font-semibold">+3 Üye Aktif</div>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-2">Herkes kendi cihazından anında bütçe girebilir.</div>
                </div>
              </div>

              {/* Transactions List Preview */}
              <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl mt-4 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 block">Son İşlemler</span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <div>
                        <p className="font-bold">Kira Ödemesi (Ev Sahibi Ahmet Bey)</p>
                        <p className="text-[10px] text-zinc-500">Ziraat Bankası Hesabı → Kira Kategorisi</p>
                      </div>
                    </div>
                    <span className="font-bold text-rose-400">-12,000.00 ₺</span>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div>
                        <p className="font-bold">Temmuz Maaş Ödemesi</p>
                        <p className="text-[10px] text-zinc-500">Şirket A.Ş. → Garanti Bankası Hesabı</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-400">+45,000.00 ₺</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* 3. Features Bento Grid (Özellikler) */}
        <section id="ozellikler" className="py-24 border-t border-zinc-900 bg-zinc-950/20">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">SaaS Özellikleri</h2>
              <p className="text-3xl md:text-5xl font-black tracking-tight text-white">Bütçe Yönetiminde İhtiyacınız Olan Tüm Araçlar Tek Bir Yerde</p>
              <p className="text-zinc-400 text-sm md:text-base">FinansHane, sıradan bütçe programlarının ötesinde, profesyonel kurumsal muhasebe mantığını evinize getirir. İşte sizi başarıya ulaştıracak özellikler:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">%100 KVKK ve Veri Güvenliği</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  2026 Türkiye veri koruma yasalarına tamamen uygun yapı. Verileriniz şifrelenmiş olarak güvenli sunucularda barındırılır. İstediğiniz an verilerinizi indirebilir veya tamamen silebilirsiniz.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Users className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Hane Halkı Ortak Bütçesi</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Tüm aile üyelerini ortak bütçenize davet edin. Herkes kendi harcamasını eklesin, ay sonunda hane içinde borç-alacak dengesi otomatik hesaplansın.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Çift Kayıtlı Ev Muhasebesi</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Paranın nereye gittiğini tam olarak görün. Borç ödemeleri, kart transferleri, nakit çekimleri ve döviz birikimleri kuruşu kuruşuna doğru işlenir.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Calculator className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Abonelik & Fatura Planlayıcı</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Netlix, Spotify, Kira gibi düzenli ödemelerinizin vadelerini önceden görün. Geciken veya yaklaşan faturalar için sistem bütçe planlamasında yer ayırır.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Coins className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Çoklu Para Birimi ve Döviz Eşdeğeri</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  TRY, USD ve EUR birimleriyle işlem yapın. Güncel Merkez Bankası kurları ile tüm hesaplarınızın toplam değerini anında Türk Lirası cinsinden izleyin.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4 hover:border-zinc-700 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Lock className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white">Gelişmiş Bilgi Güvenliği</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Şifrelenmiş Firestore veri tabanı, iki adımlı güvenlik doğrulaması, anlık işlem günlükleri (Audit Logs) ile verileriniz banka standartlarında korunmaktadır.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Interactive Budget Health Calculator (Bütçe Hesaplayıcı) */}
        <section id="hesaplayici" className="py-24 border-t border-zinc-900 bg-zinc-900/10">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                <Percent className="w-3.5 h-3.5" /> İnteraktif Analiz Aracı
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Finansal Sağlık Oranınızı Anında Hesaplayın</h2>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                Aşağıdaki basit alanları doldurarak bütçenizin tasarruf oranını ve 2026 şartlarına göre bütçe notunuzu görün. FinansHane uygulamasına katıldığınızda bu analizler her işlem için otomatik ve kuruşu kuruşuna grafiklerle yapılır.
              </p>
              
              {/* Dynamic Budged Grade Display */}
              <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Mevcut Durumunuz</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">% {calcSavingsRatio.toFixed(1)} Tasarruf</span>
                </div>
                <h4 className={`text-lg font-black ${budgetGrade.color}`}>{budgetGrade.label}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">{budgetGrade.desc}</p>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6">
              <h3 className="text-xl font-bold text-white border-b border-zinc-800 pb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-500" /> Bütçe Sihirbazı (Aylık)
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Aylık Hane Geliri (TL)</label>
                    <span className="text-xs font-bold text-white">{calcIncome.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <input 
                    type="range" 
                    min="15000" 
                    max="150000" 
                    step="1000"
                    value={calcIncome}
                    onChange={(e) => setCalcIncome(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ev Kirası veya Kredi Ödemesi (TL)</label>
                    <span className="text-xs font-bold text-white">{calcRent.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="60000" 
                    step="500"
                    value={calcRent}
                    onChange={(e) => setCalcRent(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mutfak, Faturalar ve Yaşam Gideri (TL)</label>
                    <span className="text-xs font-bold text-white">{calcFood.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <input 
                    type="range" 
                    min="1000" 
                    max="30000" 
                    step="500"
                    value={calcFood}
                    onChange={(e) => setCalcFood(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Diğer Kişisel Harcamalar ve Ulaşım (TL)</label>
                    <span className="text-xs font-bold text-white">{calcOther.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="25000" 
                    step="500"
                    value={calcOther}
                    onChange={(e) => setCalcOther(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-6 grid grid-cols-2 gap-4 text-center">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Toplam Giderler</span>
                  <span className="text-base font-extrabold text-rose-400">{calcTotalExpenses.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Net Aylık Tasarruf</span>
                  <span className={`text-base font-extrabold ${calcSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {calcSavings.toLocaleString('tr-TR')} ₺
                  </span>
                </div>
              </div>

              <button 
                onClick={() => onViewChange('register')}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 text-sm flex items-center justify-center gap-2"
              >
                Bu Bütçeyi FinansHane'de Planla <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 5. Security & Compliance Section (Güvenlik ve KVKK) */}
        <section id="güvenlik" className="py-24 border-t border-zinc-900 bg-zinc-950/40">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative order-last md:order-first">
              <div className="absolute inset-0 bg-emerald-500/5 rounded-[32px] filter blur-xl pointer-events-none" />
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 space-y-6">
                <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Güvenlik ve KVKK Taahhüdü</h4>
                    <p className="text-xs text-zinc-400">Yasal mevzuata %100 uyumluluk</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
                  <div className="flex gap-3">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p><strong>Yüksek Veri Güvenliği:</strong> Veritabanımız (Firebase) şifreli ve korumalı bulut mimarisinde barındırılır. Finansal işlemleriniz yalnızca sizin hane üyelerinize açıktır.</p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p><strong>6698 Sayılı Kanun Uyumu:</strong> Girişte açık rızanız alınır. Kişisel verilerinizin işlenme amaçları, KVKK aydınlatma metnimizde şeffafça ilan edilmiştir.</p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p><strong>Veri Taşınabilirliği & Silme Hakkı:</strong> Tek bir tıklamayla tüm verilerinizi JSON formatında dışa aktarabilir ya da sunucularımızdan kalıcı olarak imha edebilirsiniz.</p>
                  </div>
                  <div className="flex gap-3">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p><strong>Yönetici İşlem Günlükleri (Audit):</strong> Kimin ne zaman hangi hesabı eklediği ya da değiştirdiği güvenlik logları altında toplanır. İç denetim tam sağlanır.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Kişisel Verilerin Korunması</h2>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                Finansal Verileriniz <br />
                Bize Değil, Size Ait
              </h3>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
                2026 Türkiye yasalarına ve güncel siber güvenlik standartlarına tam uyumlu altyapımız sayesinde hiçbir veriniz habersiz işlenmez. Reklam ağlarına veya finans kurumlarına satış yapmayız. SaaS modelimiz tamamen kullanıcı deneyimini ve gizliliğini temel alır.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => onViewChange('register')}
                  className="px-6 py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 min-h-[44px]"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> KVKK Uyumlu Kayıt Ol
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Free & Transparent Guarantee Section */}
        <section id="ucretsiz" className="py-24 border-t border-zinc-900 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Şeffaf & Açık Model</h2>
              <p className="text-3xl md:text-5xl font-black tracking-tight text-white">Gizli Ücret Yok, %100 Tamamen Ücretsiz</p>
              <p className="text-zinc-400 text-sm md:text-base">FinansHane'de hiçbir yapay kısıtlama, gizli tarife veya ücretli abonelik paketi yoktur. Tüm muhasebe, banka ekstre aktarımı ve yapay zeka analiz özellikleri herkes için ömür boyu sınırsız ve ücretsizdir.</p>
            </div>

            <div className="max-w-3xl mx-auto">
              {/* Single Comprehensive Free Plan Card */}
              <div className="bg-zinc-900/90 border-2 border-emerald-500/50 p-8 sm:p-10 rounded-3xl space-y-8 relative shadow-2xl shadow-emerald-950/30">
                <div className="absolute -top-4 left-8 bg-emerald-500 text-white px-4 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest shadow-lg shadow-emerald-500/25">
                  Ömür Boyu Tamamen Ücretsiz
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white">Eksiksiz Ev & Aile Bütçesi</h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">Tüm kurumsal muhasebe ve analiz araçları dahil</p>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black text-emerald-400">0 ₺</span>
                    <span className="text-xs text-zinc-500 font-bold">/ sınırsız kullanım</span>
                  </div>
                </div>

                <hr className="border-zinc-800" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6 text-xs sm:text-sm text-zinc-200">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Sınırsız Gelir-Gider & Çift Kayıtlı İşlem
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Banka Ekstre & Döküm İçe Aktarma (CSV/Excel)
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Ortak Hane Bütçesi & Eşzamanlı Aile Üyeliği
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Nakit, Banka, Kredi Kartı & Akbil Hesapları
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> AiAdvisor: Yapay Zeka Tasarruf Danışmanı
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Canlı Altın, Döviz ve Kripto Kur Takibi
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Gider Bütçeleme, Hedefler & Limit Uyarıları
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> PDF / Excel Rapor Dışa Aktarma
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> Düzenli Abonelik & Fatura Takibi
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" /> %100 KVKK Uyumlu & Güvenli Bulut Altyapısı
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => onViewChange('register')}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 text-base min-h-[48px] flex items-center justify-center gap-2"
                  >
                    Hemen Ücretsiz Başla <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="text-center text-[11px] text-zinc-500 mt-2.5">Kredi kartı gerekmez • Kurulum gerektirmez • Anında kullanıma hazır</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. FAQ Section (Sıkça Sorulan Sorular) */}
        <section id="sss" className="py-24 border-t border-zinc-900 bg-zinc-950/10">
          <div className="max-w-4xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Merak Edilenler</h2>
              <p className="text-3xl md:text-5xl font-black text-white tracking-tight">Sıkça Sorulan Sorular</p>
              <p className="text-zinc-400 text-sm max-w-2xl mx-auto">
                FinansHane bütçe takip platformu, veri işleme, KVKK ve muhasebe altyapısı hakkında en çok merak edilen konular.
              </p>
            </div>

            {/* Search FAQ */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="SSS içerisinde arayın..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm text-white placeholder-zinc-500 min-h-[44px]"
              />
            </div>

            {/* FAQ Items */}
            <div className="space-y-4">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((item, idx) => {
                  const isOpen = activeFaq === idx;
                  return (
                    <div 
                      key={idx} 
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setActiveFaq(isOpen ? null : idx)}
                        className="w-full p-6 text-left flex justify-between items-center gap-4 text-white hover:text-emerald-400 transition-colors min-h-[44px]"
                      >
                        <span className="font-bold text-sm md:text-base flex items-center gap-2.5">
                          <HelpCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                          {item.q}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-zinc-800"
                          >
                            <div className="p-6 text-sm text-zinc-400 leading-relaxed bg-zinc-950/20">
                              {item.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-8 text-zinc-500 text-sm">
                  Aramanıza uygun soru bulunamadı.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 8. Call To Action Footer */}
        <section className="py-24 border-t border-zinc-900 bg-gradient-to-b from-zinc-950 to-zinc-900 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 space-y-8 relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Hemen Bugün Bütçenizin Kontrolünü Alın</h2>
            <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Aile içinde borç tartışmalarına, kayıp harcamalara ve belirsiz fatura dönemlerine son verin. Türkiye'nin çift kayıtlı ilk akıllı ev bütçe platformunu ücretsiz kullanın.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onViewChange('register')}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 text-base min-h-[48px]"
              >
                Hemen Ücretsiz Başla <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => onViewChange('login')}
                className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-2xl font-semibold transition-all border border-zinc-800 flex items-center justify-center gap-2 text-base min-h-[48px]"
              >
                Mevcut Hesaba Giriş Yap
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12 relative z-10 text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
          <div className="space-y-3">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="font-sans font-bold text-base tracking-tight text-white">FinansHane</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              2026 Türkiye standartlarında ev, aile ve kişisel bütçenizi yönetmeniz için tasarlanmış kurumsal kalitede bütçe takip SaaS platformu.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-400 font-medium">
            <a href="#ozellikler" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#güvenlik" className="hover:text-white transition-colors">KVKK Güvenliği</a>
            <a href="#ucretsiz" className="hover:text-white transition-colors">Tamamen Ücretsiz</a>
            <a href="#sss" className="hover:text-white transition-colors">Destek & SSS</a>
            <a 
              href="mailto:ersin@ozbucak.com.tr?subject=FinansHane%20%C3%96neri%2C%20%C4%B0stek%20ve%20G%C3%B6r%C3%BC%C5%9Fler" 
              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Öneri & İletişim</span>
            </a>
          </div>

          <div className="space-y-2 text-xs text-center md:text-right">
            <p className="text-zinc-400">&copy; 2026 FinansHane. Tüm Hakları Saklıdır.</p>
            <p className="text-zinc-500 text-[11px]">
              Öneri, istek ve görüşleriniz için: <a href="mailto:ersin@ozbucak.com.tr" className="text-emerald-400 hover:underline font-mono">ersin@ozbucak.com.tr</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
