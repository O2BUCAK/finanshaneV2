import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, TrendingUp, ShieldAlert, Sparkles, Scale, DollarSign, 
  Coins, Landmark, Calculator, Info, ArrowUpRight, ArrowDownRight, RefreshCw, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

interface InflationMetricsWidgetProps {
  totalAssetsTRY: number;
  totalMonthlyExpenseTRY: number;
  formatWithEquivalent: (amount: number, currency?: string, hidden?: boolean) => string;
  isPrivacyHidden?: boolean;
}

export const InflationMetricsWidget: React.FC<InflationMetricsWidgetProps> = ({
  totalAssetsTRY,
  totalMonthlyExpenseTRY,
  formatWithEquivalent,
  isPrivacyHidden = false,
}) => {
  // Inflation source rate options
  const [tuikRate, setTuikRate] = useState<number>(48.58);
  const [enagRate, setEnagRate] = useState<number>(82.40);
  const [asgariUcret, setAsgariUcret] = useState<number>(28005);
  const [gramAltinPrice, setGramAltinPrice] = useState<number>(3150);
  const [usdRate, setUsdRate] = useState<number>(44.60);
  const [selectedRateMode, setSelectedRateMode] = useState<'TUIK' | 'ENAG' | 'CUSTOM'>('TUIK');
  const [customRate, setCustomRate] = useState<number>(50.0);
  const [timeHorizonMonths, setTimeHorizonMonths] = useState<number>(12);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMacroAndGold = async () => {
      setLoading(true);
      try {
        const [macroRes, goldRes, tcmbRes] = await Promise.all([
          fetch('/api/macro-tr'),
          fetch('/api/gold-rates'),
          fetch('/api/tcmb-rates')
        ]);

        if (macroRes.ok) {
          const macroData = await macroRes.json();
          if (macroData.data) {
            setTuikRate(macroData.data.tuikAnnualInflationTufe || 48.58);
            setAsgariUcret(macroData.data.asgariUcretNet || 28005);
          }
        }

        if (goldRes.ok) {
          const goldData = await goldRes.json();
          const gramItem = goldData.rates?.find((r: any) => r.code === 'gram-altin');
          if (gramItem && gramItem.selling > 0) {
            setGramAltinPrice(gramItem.selling);
          }
        }

        if (tcmbRes.ok) {
          const tcmbData = await tcmbRes.json();
          if (tcmbData.rates?.USD?.forexSelling) {
            setUsdRate(tcmbData.rates.USD.forexSelling);
          }
        }
      } catch (err) {
        console.warn('Inflation metrics data fetch fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMacroAndGold();
  }, []);

  const activeInflationRate = 
    selectedRateMode === 'TUIK' ? tuikRate :
    selectedRateMode === 'ENAG' ? enagRate : customRate;

  // Purchasing power calculations
  const asgariUcretCount = asgariUcret > 0 ? (totalAssetsTRY / asgariUcret) : 0;
  const gramAltinCount = gramAltinPrice > 0 ? (totalAssetsTRY / gramAltinPrice) : 0;
  const ataAltinCount = gramAltinCount / 7.21; // ~7.21 grams per Ata Gold
  const usdCount = usdRate > 0 ? (totalAssetsTRY / usdRate) : 0;

  // Inflation impact projection over selected time horizon
  // Formula: Future Purchasing Power = Current Power / (1 + Rate)^(Months / 12)
  const yearsFactor = timeHorizonMonths / 12;
  const inflationMultiplier = Math.pow(1 + activeInflationRate / 100, yearsFactor);
  
  // What 100 TRY today will be worth in terms of purchasing power
  const futurePurchasingPowerRatio = 1 / inflationMultiplier; // e.g. 0.67
  const purchasingPowerLossPercent = (1 - futurePurchasingPowerRatio) * 100;
  
  // Real equivalent value of current total assets if uninvested
  const futureRealAssetsTRY = totalAssetsTRY * futurePurchasingPowerRatio;
  const nominalValueNeededToMaintainPower = totalAssetsTRY * inflationMultiplier;

  // Expense inflation projection
  const futureMonthlyExpenseTRY = totalMonthlyExpenseTRY * inflationMultiplier;
  const monthlyExpenseIncrease = futureMonthlyExpenseTRY - totalMonthlyExpenseTRY;

  return (
    <div className="corporate-card p-8 relative group overflow-hidden space-y-6">
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full -mr-40 -mt-40 blur-3xl group-hover:bg-rose-500/10 transition-colors duration-500" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              Enflasyon & Alım Gücü Analizörü
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 uppercase tracking-wider">
                Reel Değer Takibi
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Varlıklarınızın ve harcamalarınızın enflasyon karşısındaki gerçek alım gücü değişimi
            </p>
          </div>
        </div>

        {/* Inflation Rate Source Selector */}
        <div className="flex items-center gap-1.5 bg-secondary/50 p-1.5 rounded-2xl border border-border/60 text-xs">
          <button
            onClick={() => setSelectedRateMode('TUIK')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              selectedRateMode === 'TUIK'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            TÜİK (%{tuikRate.toFixed(1)})
          </button>
          <button
            onClick={() => setSelectedRateMode('ENAG')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              selectedRateMode === 'ENAG'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ENAG (%{enagRate.toFixed(1)})
          </button>
          <button
            onClick={() => setSelectedRateMode('CUSTOM')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              selectedRateMode === 'CUSTOM'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Özel (%{customRate})
          </button>
        </div>
      </div>

      {/* Custom Rate Input if Custom Mode Selected */}
      {selectedRateMode === 'CUSTOM' && (
        <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50 flex items-center justify-between gap-4 text-xs">
          <span className="font-bold text-foreground">Kendi Yıllık Beklenen Enflasyon Oranınız (%):</span>
          <div className="flex items-center gap-2 w-48">
            <input
              type="range"
              min="10"
              max="150"
              step="1"
              value={customRate}
              onChange={(e) => setCustomRate(parseFloat(e.target.value))}
              className="w-full accent-rose-500"
            />
            <span className="font-mono font-black text-rose-400 w-12 text-right">%{customRate}%</span>
          </div>
        </div>
      )}

      {/* Primary Purchasing Power Multipliers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {/* Asgari Ücret Cinsinden */}
        <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 shadow-sm relative overflow-hidden group/card hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em]">Asgari Ücret Cinsinden</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">
            {isPrivacyHidden ? '••••' : `${asgariUcretCount.toFixed(2)} Katı`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Net Asgari Ücret: ₺{asgariUcret.toLocaleString('tr-TR')}
          </p>
        </div>

        {/* Gram & Ata Altın Cinsinden */}
        <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 shadow-sm relative overflow-hidden group/card hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em]">Altın Karşılığı</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400 tracking-tight">
            {isPrivacyHidden ? '••••' : `${gramAltinCount.toFixed(1)} Gram`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            ~{isPrivacyHidden ? '••' : ataAltinCount.toFixed(1)} Ata Altın (₺{gramAltinPrice.toLocaleString('tr-TR')}/gr)
          </p>
        </div>

        {/* Döviz Karşılığı (USD) */}
        <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 shadow-sm relative overflow-hidden group/card hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em]">Döviz Karşılığı</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">
            {isPrivacyHidden ? '••••' : `$${usdCount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            TCMB Dolar Kuru: ₺{usdRate.toFixed(2)}
          </p>
        </div>

        {/* Alım Gücü Kayıp Oranı Projeksiyonu */}
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-rose-300 font-black uppercase tracking-[0.15em]">1 Yıllık Erime Oranı</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 tracking-tight">
            -%{purchasingPowerLossPercent.toFixed(1)}
          </p>
          <p className="text-[10px] text-rose-300/80 mt-1">
            Faizsiz/yatırımsız nakit paranın alım gücü kaybı
          </p>
        </div>
      </div>

      {/* Inflation Simulator Section */}
      <div className="p-6 bg-secondary/20 rounded-2xl border border-border/50 space-y-5 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-rose-400" />
            <h4 className="text-sm font-bold text-foreground">Gelecek Alım Gücü & Enflasyon Şoku Projeksiyonu</h4>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Zaman Ufku:</span>
            {[6, 12, 24, 36].map((m) => (
              <button
                key={m}
                onClick={() => setTimeHorizonMonths(m)}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                  timeHorizonMonths === m
                    ? 'bg-rose-500 text-white'
                    : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {m} Ay
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Asset Purchasing Power Loss Simulation */}
          <div className="space-y-3 p-4 bg-background/50 rounded-xl border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Mevcut Varlıkların {timeHorizonMonths} Ay Sonraki Reel Alım Gücü</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-bold">
                %{activeInflationRate}% Enflasyon İle
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Bugünkü Nominal Tutar:</span>
                <span className="font-bold text-foreground">{formatWithEquivalent(totalAssetsTRY, 'TRY', isPrivacyHidden)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{timeHorizonMonths} Ay Sonraki Alım Gücü (Reel):</span>
                <span className="font-bold text-rose-400">{formatWithEquivalent(futureRealAssetsTRY, 'TRY', isPrivacyHidden)}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-border/40">
                <span className="text-muted-foreground font-medium">Alım Gücünü Korumak İçin Gereken Tutar:</span>
                <span className="font-black text-amber-400">{formatWithEquivalent(nominalValueNeededToMaintainPower, 'TRY', isPrivacyHidden)}</span>
              </div>
            </div>
          </div>

          {/* Expense Shock Simulation */}
          <div className="space-y-3 p-4 bg-background/50 rounded-xl border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Giderlerinizin {timeHorizonMonths} Ay Sonraki Tahmini Maliyeti</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold">
                Enflasyon Şoku
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mevcut Ortalama Aylık Gider:</span>
                <span className="font-bold text-foreground">{formatWithEquivalent(totalMonthlyExpenseTRY, 'TRY', isPrivacyHidden)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{timeHorizonMonths} Ay Sonraki Tahmini Aylık Gider:</span>
                <span className="font-bold text-rose-400">{formatWithEquivalent(futureMonthlyExpenseTRY, 'TRY', isPrivacyHidden)}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-border/40">
                <span className="text-muted-foreground font-medium">Aylık Ek Bütçe Yükü:</span>
                <span className="font-black text-rose-400">+{formatWithEquivalent(monthlyExpenseIncrease, 'TRY', isPrivacyHidden)} / ay</span>
              </div>
            </div>
          </div>
        </div>

        {/* Practical Financial Recommendation */}
        <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-amber-400">Stratejik Not:</strong> Paranızın alım gücünü enflasyona karşı korumak için, toplam varlıklarınızın yıllık getirisi seçili enflasyon oranının (%{activeInflationRate}) üzerinde olmalıdır. Mevcut bütçenizde fonlar (TEFAS), döviz, altın ve hisse senedi gibi reel enflasyon korumalı varlık sınıflarını çeşitlendirebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
};
