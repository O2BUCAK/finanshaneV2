import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface KVKKConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const KVKKConsentModal: React.FC<KVKKConsentModalProps> = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-zinc-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">KVKK Aydınlatma Metni</h3>
            <p className="text-zinc-400 text-sm">Verilerinizin güvenliği bizim için önemlidir.</p>
          </div>
        </div>
        
        <div className="p-8 overflow-y-auto text-zinc-300 text-sm space-y-4 leading-relaxed">
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, FinansHane olarak, veri sorumlusu sıfatıyla, kişisel verilerinizin aşağıda açıklanan kapsamda işlenebileceğini bildiririz.</p>
          
          <h4 className="text-white font-bold">1. Kişisel Verilerin İşlenme Amacı</h4>
          <p>Kişisel verileriniz; bütçe yönetimi, finansal analizler, hane içi paylaşım ve uygulama hizmetlerinin sunulması amacıyla işlenmektedir.</p>
          
          <h4 className="text-white font-bold">2. Veri Güvenliği ve Saklama</h4>
          <p>Verileriniz güvenli bulut altyapısında (Firebase) şifrelenmiş olarak saklanmakta ve performans için tarayıcınızda (IndexedDB) önbelleğe alınmaktadır. FinansHane, verilerinizi 2026 Türkiye KVKK standartlarına tam uyumlu şekilde korur. Güvenliğiniz için önemli işlemler (giriş, veri dışa aktarma vb.) Güvenlik Günlüğü&apos;nde kayıt altına alınır.</p>
          
          <h4 className="text-white font-bold">3. Veri Sahibi Hakları</h4>
          <p>Dilediğiniz zaman uygulama ayarlarından tüm verilerinizi silebilir veya dışa aktarabilirsiniz. Verileriniz üzerinde tam kontrol sahibisiniz.</p>
          <p>Dilediğiniz zaman verilerinizin silinmesini talep edebilir, verilerinizi dışa aktarabilir veya işlenmesine itiraz edebilirsiniz. Ayarlar bölümünden &quot;Verilerimi Sil&quot; seçeneği ile tüm verilerinizi kalıcı olarak silebilirsiniz.</p>
          
          <p className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 italic">
            &quot;Uygulamayı kullanmaya devam ederek, kişisel verilerinizin bu metin çerçevesinde işlenmesini kabul etmiş sayılırsınız.&quot;
          </p>
        </div>
        
        <div className="p-8 border-t border-zinc-800 bg-zinc-950/50">
          <button 
            onClick={onAccept}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
          >
            Okudum, Onaylıyorum
          </button>
        </div>
      </motion.div>
    </div>
  );
};
