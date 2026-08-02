import React, { useState, useEffect } from 'react';
import { 
  Building2, Coins, TrendingUp, Calendar, Search, RefreshCw, 
  Sparkles, ShieldCheck, ArrowUpRight, ArrowDownLeft, Landmark, Wallet, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TurkishApisHubProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFund?: (symbol: string, name: string) => void;
}

export const TurkishApisHub: React.FC<TurkishApisHubProps> = ({ isOpen, onClose, onSelectFund }) => {
  const [activeTab, setActiveTab] = useState<'tcmb' | 'gold' | 'tefas' | 'crypto' | 'macro'>('tcmb');
  const [loading, setLoading] = useState(false);
  const [tcmbRates, setTcmbRates] = useState<any>(null);
  const [goldRates, setGoldRates] = useState<any[]>([]);
  const [cryptoTr, setCryptoTr] = useState<any[]>([]);
  const [macroData, setMacroData] = useState<any>(null);

  // TEFAS search state
  const [tefasSearchCode, setTefasSearchCode] = useState('');
  const [searchedFund, setSearchedFund] = useState<any>(null);
  const [tefasLoading, setTefasLoading] = useState(false);

  const fetchTcmb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tcmb-rates');
      if (res.ok) {
        const json = await res.json();
        setTcmbRates(json.rates);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGold = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gold-rates');
      if (res.ok) {
        const json = await res.json();
        setGoldRates(json.rates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCryptoTr = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crypto-tr');
      if (res.ok) {
        const json = await res.json();
        setCryptoTr(json.tickers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMacro = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/macro-tr');
      if (res.ok) {
        const json = await res.json();
        setMacroData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTefasSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch || tefasSearchCode).toUpperCase().trim();
    if (!code) return;
    setTefasLoading(true);
    try {
      const res = await fetch(`/api/tefas-funds?code=${code}`);
      if (res.ok) {
        const json = await res.json();
        setSearchedFund(json.fund);
      } else {
        setSearchedFund(null);
      }
    } catch (e) {
      console.error(e);
      setSearchedFund(null);
    } finally {
      setTefasLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'tcmb' && !tcmbRates) fetchTcmb();
      if (activeTab === 'gold' && goldRates.length === 0) fetchGold();
      if (activeTab === 'crypto' && cryptoTr.length === 0) fetchCryptoTr();
      if (activeTab === 'macro' && !macroData) fetchMacro();
      if (activeTab === 'tefas' && !searchedFund) handleTefasSearch('AFT');
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const popularTefasCodes = ['AFT', 'TCD', 'MAC', 'IIH', 'GTA', 'YAY', 'ZJL'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Türkiye Açık Finans & Piyasa API'leri Hub
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase">Canlı Entegre</span>
                </h3>
                <p className="text-xs text-zinc-400">TCMB, TEFAS, Kapalıçarşı, BtcTurk & Paribu Açık API Entegrasyonları</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/20 px-6 gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('tcmb')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'tcmb'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Landmark className="w-4 h-4" /> TCMB Resmi Kurlar
            </button>
            <button
              onClick={() => setActiveTab('gold')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'gold'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Coins className="w-4 h-4" /> Kapalıçarşı Altın & Gümüş
            </button>
            <button
              onClick={() => setActiveTab('tefas')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'tefas'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> TEFAS & BES Fonları
            </button>
            <button
              onClick={() => setActiveTab('crypto')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'crypto'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Wallet className="w-4 h-4" /> BtcTurk & Paribu
            </button>
            <button
              onClick={() => setActiveTab('macro')}
              className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'macro'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Calendar className="w-4 h-4" /> Enflasyon & Tatiller
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Tab 1: TCMB XML */}
            {activeTab === 'tcmb' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Türkiye Cumhuriyet Merkez Bankası (TCMB) Günlük Kurlar
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded">today.xml</span>
                    </h4>
                    <p className="text-xs text-zinc-400">Resmi gösterge niteliğindeki Merkez Bankası döviz ve efektif alış/satış kurları</p>
                  </div>
                  <button
                    onClick={fetchTcmb}
                    disabled={loading}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {tcmbRates ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.values(tcmbRates).map((curr: any) => (
                      <div key={curr.code} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-amber-400 text-sm">{curr.code}</span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[140px]">{curr.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-800/50">
                          <div>
                            <span className="text-[10px] text-zinc-500 block uppercase">Döviz Alış</span>
                            <span className="font-bold text-white">₺{curr.forexBuying?.toFixed(4)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block uppercase">Döviz Satış</span>
                            <span className="font-bold text-emerald-400">₺{curr.forexSelling?.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-500 animate-pulse">TCMB kurları yükleniyor...</div>
                )}
              </div>
            )}

            {/* Tab 2: Kapalıçarşı Altın & Gümüş */}
            {activeTab === 'gold' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Kapalıçarşı & Serbest Piyasa Kıymetli Madenler
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded">Canlı</span>
                    </h4>
                    <p className="text-xs text-zinc-400">Gram, Çeyrek, Ata, 22 Ayar Bilezik ve Gram Gümüş fiyatları</p>
                  </div>
                  <button
                    onClick={fetchGold}
                    disabled={loading}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {goldRates.map((gold) => (
                    <div key={gold.code} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">{gold.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          gold.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {gold.changePercent >= 0 ? '+' : ''}{gold.changePercent}%
                        </span>
                      </div>
                      <div className="flex justify-between items-end pt-1">
                        <div>
                          <span className="text-[10px] text-zinc-500 block uppercase">Alış</span>
                          <span className="font-bold text-zinc-300 text-xs">
                            {gold.code === 'ons' ? '$' : '₺'}{gold.buying.toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 block uppercase">Satış</span>
                          <span className="font-black text-amber-400 text-sm">
                            {gold.code === 'ons' ? '$' : '₺'}{gold.selling.toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: TEFAS & BES Fonları */}
            {activeTab === 'tefas' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    TEFAS & Emeklilik (BES) Fon Sorgulama Platformu
                  </h4>
                  <p className="text-xs text-zinc-400">Türkiye Elektronik Fon Alım Satım Platformu resmi canlı fiyat sorgulama</p>
                </div>

                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type="text"
                      value={tefasSearchCode}
                      onChange={(e) => setTefasSearchCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTefasSearch()}
                      placeholder="Fon Kodu Girin (Örn: AFT, TCD, MAC, GTA, ZJL)..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-white uppercase"
                    />
                  </div>
                  <button
                    onClick={() => handleTefasSearch()}
                    disabled={tefasLoading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-colors"
                  >
                    {tefasLoading ? 'Aranıyor...' : 'Sorgula'}
                  </button>
                </div>

                {/* Popular Presets */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-zinc-500 text-[11px] font-medium">Popüler Fonlar:</span>
                  {popularTefasCodes.map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setTefasSearchCode(c);
                        handleTefasSearch(c);
                      }}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-amber-400 font-mono font-bold"
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Fund Result Card */}
                {searchedFund && (
                  <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-mono text-xs font-bold rounded">
                          {searchedFund.code}
                        </span>
                        <h5 className="text-base font-black text-white mt-2">{searchedFund.title}</h5>
                        <p className="text-xs text-zinc-400 mt-1">{searchedFund.category}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-zinc-400 block">Birim Pay Fiyatı</span>
                        <span className="text-2xl font-black text-emerald-400">₺{searchedFund.price.toFixed(4)}</span>
                        <span className={`text-xs font-bold block mt-1 ${
                          searchedFund.dailyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          Günlük Getiri: {searchedFund.dailyReturn >= 0 ? '+' : ''}{searchedFund.dailyReturn}%
                        </span>
                      </div>
                    </div>

                    {onSelectFund && (
                      <button
                        onClick={() => {
                          onSelectFund(searchedFund.code, searchedFund.title);
                          onClose();
                        }}
                        className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl border border-zinc-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        Bu Fonu Varlıklarım Arasına Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Yerel Kripto (BtcTurk & Paribu) */}
            {activeTab === 'crypto' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Türkiye Kripto Borsaları (BtcTurk & Paribu)
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded">TRY Çiftleri</span>
                    </h4>
                    <p className="text-xs text-zinc-400">Türk Lirası bazlı canlı kripto para parite verileri</p>
                  </div>
                  <button
                    onClick={fetchCryptoTr}
                    disabled={loading}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cryptoTr.map((item, idx) => (
                    <div key={`${item.symbol}-${item.exchange}-${idx}`} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-sm">{item.symbol}/TRY</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-medium">{item.exchange}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.dailyChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {item.dailyChange >= 0 ? '+' : ''}{item.dailyChange}%
                        </span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/50 flex justify-between items-end">
                        <span className="text-xs text-zinc-400">Son Fiyat</span>
                        <span className="font-black text-amber-400 text-base">₺{item.lastPrice.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: Makro & Tatiller */}
            {activeTab === 'macro' && macroData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider block">TCMB Politika Faizi</span>
                    <span className="text-2xl font-black text-amber-400 block mt-1">%{macroData.tcmbPolicyInterestRate.toFixed(2)}</span>
                    <span className="text-[10px] text-zinc-500 mt-1 block">Merkez Bankası Bir Hafta Repo Faizi</span>
                  </div>
                  <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider block">TÜİK Yıllık TÜFE Enflasyonu</span>
                    <span className="text-2xl font-black text-rose-400 block mt-1">%{macroData.tuikAnnualInflationTufe.toFixed(2)}</span>
                    <span className="text-[10px] text-zinc-500 mt-1 block">Tüketici Fiyat Endeksi Değişimi</span>
                  </div>
                  <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider block">Net Asgari Ücret (2026 Ref)</span>
                    <span className="text-2xl font-black text-emerald-400 block mt-1">₺{macroData.asgariUcretNet.toLocaleString('tr-TR')}</span>
                    <span className="text-[10px] text-zinc-500 mt-1 block">Aylık Resmi Net Asgari Ücret Tutar</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    Türkiye Resmi Tatiller Takvimi (Nakit Akışı Ref)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {macroData.resmiTatiller.map((holiday: any, i: number) => (
                      <div key={i} className="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-white block">{holiday.name}</span>
                          <span className="text-[10px] text-zinc-500">{holiday.day}</span>
                        </div>
                        <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          {holiday.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
