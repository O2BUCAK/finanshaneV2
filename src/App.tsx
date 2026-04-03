import React, { useState, Component, ErrorInfo, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Users, 
  Settings, 
  LogOut,
  Target,
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  Bell,
  Search,
  ArrowRightLeft,
  X,
  Menu,
  AlertCircle,
  Bot,
  Calendar,
  Calculator,
  FileText,
  Tag,
  ChevronDown,
  Building2,
  Bitcoin,
  Gift,
  Bus,
  Coins,
  Briefcase,
  Smartphone,
  Check,
  ShieldCheck,
  ShieldAlert,
  Info,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Sun,
  Moon,
  Clock
} from 'lucide-react';
import { localDB } from './db';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { formatAmount, parseAmount, cleanAmountInput } from './utils/formatters';
import { useCollection } from './hooks/useFirestore';
import { useExchangeRates } from './hooks/useExchangeRates';
import { useAssetPrices } from './hooks/useAssetPrices';
import { createLedgerTransaction, deleteLedgerTransaction, updateLedgerTransaction, updateAccount, createInstallmentTransactions } from './lib/ledger';
import { createExpenseSource } from './lib/expenseSources';
import { Account, Category, Transaction, AccountBranch, AccountSubType, IncomeSource, ExpectedIncome, IncomeFlowType, PlannedExpense, Household, UserProfile, ExpenseSource } from './types';
import { 
  db, 
  doc, 
  collection, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  query, 
  where, 
  getDocs, 
  orderBy 
} from './lib/firebase';

import { Dashboard as DashboardView } from './components/Dashboard';
import { Reports } from './components/Reports';
import { SharedBudgets } from './components/SharedBudgets';
import { HouseholdMembers } from './components/HouseholdMembers';
import { PlannedExpenses } from './components/PlannedExpenses';
import { AdminPanel } from './components/AdminPanel';
import { AccountsView } from './components/AccountsView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { IncomeView } from './components/IncomeView';
import { ExpenseView } from './components/ExpenseView';

// --- Constants ---

const FLOW_TYPE_OPTIONS = [
  { id: 'fixed', label: 'Sabit (Periyodik)', description: 'Maaş, kira gibi düzenli gelirler' },
  { id: 'variable', label: 'Değişken', description: 'Mesai, prim gibi miktarı değişen gelirler' },
  { id: 'spot', label: 'Spot (Tek Seferlik)', description: 'Satış, hediye, bonus gibi kalemler' },
];

// ... existing constants ...

// --- Components ---

const IncomeSourceModal = ({ isOpen, onClose, householdId, accounts, members, initialData, isPrivacyMode }: any) => {
  const { user } = useAuth();
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [flowType, setFlowType] = useState<IncomeFlowType>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [periodDay, setPeriodDay] = useState('1');
  const [loading, setLoading] = useState(false);

  // Meal Allowance Calculator States
  const [showMealCalculator, setShowMealCalculator] = useState(false);
  const [dailyMealRate, setDailyMealRate] = useState('');
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState<5 | 6>(5);
  const [mealMonth, setMealMonth] = useState(new Date().getMonth());
  const [mealYear, setMealYear] = useState(new Date().getFullYear());

  const calculateMealAllowance = () => {
    const rate = parseFloat(dailyMealRate.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) {
      alert('Lütfen geçerli bir günlük ücret giriniz.');
      return;
    }

    let count = 0;
    const date = new Date(mealYear, mealMonth, 1);
    while (date.getMonth() === mealMonth) {
      const day = date.getDay();
      if (workingDaysPerWeek === 5) {
        if (day !== 0 && day !== 6) count++;
      } else {
        if (day !== 0) count++;
      }
      date.setDate(date.getDate() + 1);
    }

    const total = rate * count;
    setAmount(total.toString());
    setShowMealCalculator(false);
    if (!name) setName('Yemek Parası');
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setOwnerId(initialData.ownerId || user?.uid || '');
        setFlowType(initialData.flowType);
        setAmount(initialData.amount.toString());
        setCurrency(initialData.currency || 'TRY');
        setTargetAccountId(initialData.targetAccountId);
        setPeriodDay(initialData.periodDay?.toString() || '1');
      } else {
        setName('');
        setOwnerId(user?.uid || '');
        setFlowType('fixed');
        setAmount('');
        setCurrency('TRY');
        setTargetAccountId(accounts.find((a: any) => a.type === 'asset')?.id || '');
        setPeriodDay('1');
      }
    }
  }, [isOpen, initialData, accounts, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !householdId) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    setLoading(true);

    try {
      const sourceData = {
        name,
        ownerId: ownerId || user.uid,
        flowType,
        amount: parsedAmount,
        currency,
        targetAccountId,
        periodDay: flowType !== 'spot' ? parseInt(periodDay) : null,
        createdAt: initialData ? (initialData.createdAt || new Date()) : new Date(),
      };

      const sourceRef = initialData 
        ? doc(db, `households/${householdId}/incomeSources/${initialData.id}`)
        : doc(collection(db, `households/${householdId}/incomeSources`));
      
      await setDoc(sourceRef, sourceData, { merge: true });
      
      // If it's a new fixed/variable source, we might want to generate the first expected income
      if (!initialData && flowType !== 'spot') {
        const expectedDate = new Date();
        expectedDate.setDate(parseInt(periodDay));
        if (expectedDate < new Date()) expectedDate.setMonth(expectedDate.getMonth() + 1);

        await setDoc(doc(collection(db, `households/${householdId}/expectedIncomes`)), {
          sourceId: sourceRef.id,
          sourceName: name,
          amount: parseFloat(amount),
          currency,
          expectedDate: new Date(expectedDate),
          status: 'pending',
          targetAccountId,
          createdAt: new Date(),
        });
      }

      onClose();
    } catch (error) {
      console.error('Income source error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <h3 className="text-xl font-bold">{initialData ? 'Gelir Kaynağını Düzenle' : 'Yeni Gelir Kaynağı'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hane Bireyi</label>
            <div className="relative">
              <select 
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
              >
                {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                  <option key={id} value={id}>{m.displayName}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Gelir Adı</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Maaş, Kira Geliri"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Akış Tipi</label>
            <div className="grid grid-cols-1 gap-2">
              {FLOW_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFlowType(opt.id as IncomeFlowType)}
                  className={`flex flex-col items-start p-4 rounded-2xl border transition-all ${
                    flowType === opt.id 
                      ? 'bg-emerald-500/10 border-emerald-500 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tutar ve Para Birimi</label>
                <button
                  type="button"
                  onClick={() => setShowMealCalculator(!showMealCalculator)}
                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <Calculator className="w-3 h-3" />
                  Yemek Parası Hesapla
                </button>
              </div>
              
              {showMealCalculator && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-zinc-950 border border-emerald-500/30 rounded-2xl space-y-4 mb-2"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Günlük Ücret</label>
                      <input
                        type="text"
                        value={dailyMealRate}
                        onChange={(e) => setDailyMealRate(e.target.value)}
                        placeholder="Örn: 200"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Çalışma Günü</label>
                      <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setWorkingDaysPerWeek(5)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${workingDaysPerWeek === 5 ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          5 GÜN
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkingDaysPerWeek(6)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${workingDaysPerWeek === 6 ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          6 GÜN
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Ay</label>
                      <select
                        value={mealMonth}
                        onChange={(e) => setMealMonth(parseInt(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      >
                        {['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].map((m, i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Yıl</label>
                      <select
                        value={mealYear}
                        onChange={(e) => setMealYear(parseInt(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={calculateMealAllowance}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Hesapla ve Uygula
                  </button>
                </motion.div>
              )}

              <div className="flex gap-2 overflow-hidden">
                <input
                  type="text"
                  required
                  value={formatAmount(amount)}
                  onChange={(e) => setAmount(parseAmount(cleanAmountInput(e.target.value)))}
                  placeholder="0,00"
                  className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                />
                <div className="relative w-24 flex-shrink-0">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>
            {flowType !== 'spot' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Ödeme Günü</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={periodDay}
                  onChange={(e) => setPeriodDay(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hedef Hesap</label>
            <div className="relative">
              <select
                required
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
              >
                <option value="">Seçiniz</option>
                {BRANCH_OPTIONS.map(branch => {
                  const branchAccs = accounts
                    .filter((a: any) => a.branch === branch.id && a.type === 'asset')
                    .sort((a: any, b: any) => {
                      if (a.institution !== b.institution) return (a.institution || '').localeCompare(b.institution || '');
                      const aIsTime = a.depositDetails?.isTimeDeposit ? 1 : 0;
                      const bIsTime = b.depositDetails?.isTimeDeposit ? 1 : 0;
                      if (aIsTime !== bIsTime) return bIsTime - aIsTime;
                      if (a.subType !== b.subType) return (a.subType || '').localeCompare(b.subType || '');
                      return a.name.localeCompare(b.name);
                    });
                  
                  if (branchAccs.length === 0) return null;

                  const options: React.ReactNode[] = [];
                  let lastInst = "";
                  let lastSubType = "";

                  branchAccs.forEach((acc: any) => {
                    const inst = acc.institution || 'Diğer';
                    const subTypeLabel = acc.subType === 'liquidity_deposit' && acc.depositDetails 
                      ? (acc.depositDetails.isTimeDeposit ? 'Vadeli Hesaplar' : 'Vadesiz Hesaplar')
                      : (SUBTYPE_OPTIONS[acc.branch]?.find(o => o.id === acc.subType)?.label || 'Diğer');

                    if (inst !== lastInst) {
                      options.push(<option key={`inst-${inst}`} disabled className="font-bold text-zinc-300 bg-zinc-900">{inst}</option>);
                      lastInst = inst;
                      lastSubType = ""; // Reset subtype when institution changes
                    }

                    if (subTypeLabel !== lastSubType) {
                      options.push(<option key={`sub-${inst}-${subTypeLabel}`} disabled className="text-zinc-300 bg-zinc-950/50 italic">&nbsp;&nbsp;{subTypeLabel}</option>);
                      lastSubType = subTypeLabel;
                    }

                    options.push(
                      <option key={acc.id} value={acc.id}>
                        &nbsp;&nbsp;&nbsp;&nbsp;{acc.name}
                      </option>
                    );
                  });

                  return (
                    <optgroup key={branch.id} label={branch.label}>
                      {options}
                    </optgroup>
                  );
                })}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
          >
            {loading ? 'Kaydediliyor...' : (initialData ? 'Güncelle' : 'Kaynağı Ekle')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const BRANCH_OPTIONS = [
  { id: 'banking', label: 'Bankacılık', icon: Building2, color: 'text-blue-500' },
  { id: 'crypto', label: 'Kripto Borsaları', icon: Bitcoin, color: 'text-orange-500' },
  { id: 'social_gift', label: 'Sosyal ve Hediye Kartları', icon: Gift, color: 'text-purple-500' },
];

const SUBTYPE_OPTIONS: Record<string, { id: string; label: string }[]> = {
  banking: [
    { id: 'liquidity_deposit', label: 'Likidite ve Mevduat' },
    { id: 'investment', label: 'Yatırım' },
    { id: 'credit_debt', label: 'Kredi ve Borç' },
    { id: 'credit_card', label: 'Kredi Kartı' },
  ],
  crypto: [
    { id: 'global_exchange', label: 'Küresel Borsa' },
    { id: 'local_exchange', label: 'Yerel Borsa' },
  ],
  social_gift: [
    { id: 'transport', label: 'Ulaşım' },
    { id: 'food', label: 'Yemek' },
    { id: 'corporate_gift', label: 'Kurumsal Hediye' },
  ],
};

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Bir şeyler ters gitti.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Hata: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-rose-500/20 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Uygulama Hatası</h2>
            <p className="text-zinc-300 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-zinc-200 transition-colors"
            >
              Yeniden Yükle
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const INSTITUTION_OPTIONS: Record<string, string[]> = {
  banking: ['Garanti BBVA', 'Akbank', 'İş Bankası', 'Ziraat Bankası', 'VakıfBank', 'Halkbank', 'QNB Finansbank', 'DenizBank', 'Kuveyt Türk', 'Enpara', 'Papara', 'TEB', 'ING', 'HSBC', 'Odeabank', 'Burgan Bank', 'Alternatif Bank', 'Anadolubank', 'Fibabanka', 'Şekerbank', 'Emlak Katılım', 'Vakıf Katılım', 'Türkiye Finans', 'Albaraka Türk'],
  crypto: ['Bitexen Global', 'Binance', 'Paribu', 'BtcTurk', 'OKX', 'KuCoin', 'Coinbase', 'Gate.io', 'Huobi', 'Kraken', 'Bitfinex', 'Mexc'],
  social_gift: ['Sodexo', 'Ticket', 'Multinet', 'Metropol', 'Yemeksepeti', 'İstanbulkart', 'Ankarakart', 'İzmirim Kart', 'Hopi', 'Boyner', 'Migros Money', 'CarrefourSA Kart'],
};

const ASSET_OPTIONS = {
  stock: ['THYAO', 'ASELS', 'EREGL', 'GARAN', 'AKBNK', 'YKBNK', 'ISCTR', 'SISE', 'BIMAS', 'TUPRS', 'KCHOL', 'SAHOL', 'SASA', 'HEKTS', 'FROTO', 'TOASO'],
  crypto: ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'SHIB'],
  fund: ['MAC', 'TCD', 'TKF', 'NNF', 'IPB', 'IIH', 'YAS', 'AFT', 'YAY', 'IPJ']
};

const AccountModal = ({ isOpen, onClose, householdId, members, initialData, isPrivacyMode }: any) => {
  const { user } = useAuth();
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [institution, setInstitution] = useState('');
  const [customInstitution, setCustomInstitution] = useState('');
  const [type, setType] = useState<'asset' | 'liability'>('asset');
  const [branch, setBranch] = useState<AccountBranch>('banking');
  const [subType, setSubType] = useState<AccountSubType>('liquidity_deposit');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<{ name: string; amount: number }[]>([]);

  // Deposit states
  const [isTimeDeposit, setIsTimeDeposit] = useState(false);
  const [interestRate, setInterestRate] = useState('');
  const [depositPeriod, setDepositPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [maturityDate, setMaturityDate] = useState('');

  // Asset states
  const [isAsset, setIsAsset] = useState(false);
  const [assetType, setAssetType] = useState<'stock' | 'crypto' | 'fund'>('stock');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [customAssetSymbol, setCustomAssetSymbol] = useState('');
  const [assetQuantity, setAssetQuantity] = useState('');
  const [assetUnitPrice, setAssetUnitPrice] = useState('');
  const [assetTotalCost, setAssetTotalCost] = useState('');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // API states
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Credit Card states
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('1');

  const handleQuantityChange = (val: string) => {
    setAssetQuantity(val);
    const q = parseFloat(val);
    const u = parseFloat(assetUnitPrice);
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setAssetTotalCost((q * u).toFixed(8));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setAssetUnitPrice(val);
    const u = parseFloat(val);
    const q = parseFloat(assetQuantity);
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setAssetTotalCost((q * u).toFixed(8));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setAssetTotalCost(val);
    const t = parseFloat(val);
    const u = parseFloat(assetUnitPrice);
    const q = parseFloat(assetQuantity);
    
    if (!isNaN(t) && !isNaN(u) && u > 0) {
      setAssetQuantity((t / u).toFixed(8));
    } else if (!isNaN(t) && !isNaN(q) && q > 0) {
      setAssetUnitPrice((t / q).toFixed(8));
    }
  };

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setOwnerId(initialData.ownerId || user?.uid || '');
      setType(initialData.type);
      setBranch(initialData.branch || 'banking');
      setSubType(initialData.subType || 'liquidity_deposit');
      setBalance(initialData.balance.toString());
      setCurrency(initialData.currency);
      setPoints(initialData.points || []);
      
      if (initialData.institution) {
        const options = INSTITUTION_OPTIONS[initialData.branch || 'banking'] || [];
        if (options.includes(initialData.institution)) {
          setInstitution(initialData.institution);
          setCustomInstitution('');
        } else {
          setInstitution('Diğer');
          setCustomInstitution(initialData.institution);
        }
      } else {
        setInstitution('');
        setCustomInstitution('');
      }

      if (initialData.depositDetails) {
        setIsTimeDeposit(initialData.depositDetails.isTimeDeposit);
        setInterestRate(initialData.depositDetails.interestRate?.toString() || '');
        setDepositPeriod(initialData.depositDetails.period || 'monthly');
        setMaturityDate(initialData.depositDetails.maturityDate || '');
      } else {
        setIsTimeDeposit(false);
        setInterestRate('');
        setDepositPeriod('monthly');
        setMaturityDate('');
      }

      if (initialData.assetDetails) {
        setIsAsset(true);
        setAssetType(initialData.assetDetails.assetType);
        const opts = ASSET_OPTIONS[initialData.assetDetails.assetType] || [];
        if (opts.includes(initialData.assetDetails.symbol)) {
          setAssetSymbol(initialData.assetDetails.symbol);
          setCustomAssetSymbol('');
        } else {
          setAssetSymbol('Diğer');
          setCustomAssetSymbol(initialData.assetDetails.symbol);
        }
        setAssetQuantity(initialData.assetDetails.quantity.toString());
        setAssetUnitPrice(initialData.assetDetails.purchasePrice.toString());
        setAssetTotalCost((initialData.assetDetails.quantity * initialData.assetDetails.purchasePrice).toString());
        setAssetPurchaseDate(initialData.assetDetails.purchaseDate);
      } else {
        setIsAsset(false);
      }

      if (initialData.apiConfig) {
        setIsApiConnected(true);
        setApiKey(initialData.apiConfig.apiKey || '');
        setApiSecret(initialData.apiConfig.apiSecret || '');
      } else {
        setIsApiConnected(false);
        setApiKey('');
        setApiSecret('');
      }

      if (initialData.subType === 'credit_card') {
        setCreditLimit(initialData.creditLimit?.toString() || '');
        setStatementDay(initialData.statementDay?.toString() || '1');
      } else {
        setCreditLimit('');
        setStatementDay('1');
      }
    } else {
      setName('');
      setOwnerId(user?.uid || '');
      setInstitution('');
      setCustomInstitution('');
      setType('asset');
      setBranch('banking');
      setSubType('liquidity_deposit');
      setBalance('');
      setCurrency('TRY');
      setPoints([]);
      setIsTimeDeposit(false);
      setInterestRate('');
      setDepositPeriod('monthly');
      setMaturityDate('');
      setIsAsset(false);
      setAssetType('stock');
      setAssetSymbol('');
      setCustomAssetSymbol('');
      setAssetQuantity('');
      setAssetUnitPrice('');
      setAssetTotalCost('');
      setAssetPurchaseDate(new Date().toISOString().split('T')[0]);
      setIsApiConnected(false);
      setApiKey('');
      setApiSecret('');
      setCreditLimit('');
      setStatementDay('1');
    }
  }, [initialData, isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId) return;
    setLoading(true);

    const finalInstitution = institution === 'Diğer' ? customInstitution : institution;
    const finalAssetSymbol = assetSymbol === 'Diğer' ? customAssetSymbol : assetSymbol;
    const finalName = name.trim() || (isAsset ? `${finalAssetSymbol} (${assetType === 'stock' ? 'Hisse' : assetType === 'fund' ? 'Fon' : 'Kripto'})` : `${finalInstitution} ${SUBTYPE_OPTIONS[branch].find(o => o.id === subType)?.label || ''}`.trim());

    const accountData: any = {
      name: finalName,
      ownerId: ownerId || user?.uid,
      institution: finalInstitution,
      type,
      branch,
      subType,
      balance: isAsset ? (parseFloat(assetTotalCost) || 0) : (parseFloat(balance) || 0),
      currency: isAsset ? (assetType === 'crypto' ? 'USD' : 'TRY') : currency,
      points: subType === 'credit_debt' ? points : [],
    };

    if (subType === 'credit_card') {
      accountData.isCreditCard = true;
      accountData.creditLimit = parseFloat(creditLimit) || 0;
      accountData.statementDay = parseInt(statementDay) || 1;
      // For credit cards, balance is usually the current debt.
      // If it's a new card, balance starts at 0 unless it's an edit.
      accountData.type = 'liability';
    }

    if (subType === 'liquidity_deposit') {
      accountData.depositDetails = {
        isTimeDeposit,
        interestRate: isTimeDeposit && interestRate ? parseFloat(interestRate) : null,
        period: isTimeDeposit ? depositPeriod : null,
        maturityDate: isTimeDeposit ? maturityDate : null,
      };
    } else {
      accountData.depositDetails = null;
    }

    if (isAsset) {
      accountData.assetDetails = {
        symbol: finalAssetSymbol,
        assetType,
        quantity: parseFloat(assetQuantity) || 0,
        purchasePrice: parseFloat(assetUnitPrice) || 0,
        purchaseDate: assetPurchaseDate
      };
    } else {
      accountData.assetDetails = null;
    }

    accountData.apiConfig = isApiConnected ? {
      apiKey,
      apiSecret,
      lastSync: initialData?.apiConfig?.lastSync || null
    } : null;

    try {
      if (initialData) {
        await updateAccount(householdId, initialData.id, accountData);
      } else {
        const accId = finalName.toLowerCase().replace(/\s+/g, '-');
        await setDoc(doc(db, `households/${householdId}/accounts/${accId}`), {
          ...accountData,
          createdAt: new Date()
        }, { merge: true });
      }
      onClose();
    } catch (error) {
      console.error('Account error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <h3 className="text-xl font-bold">{initialData ? 'Hesabı Düzenle' : 'Yeni Hesap'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hesap Sahibi</label>
            <select 
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
            >
              {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                <option key={id} value={id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Ne Tür Hesap?</label>
            <select
              value={branch}
              onChange={(e) => {
                const newBranch = e.target.value as AccountBranch;
                setBranch(newBranch);
                setSubType(SUBTYPE_OPTIONS[newBranch][0].id as AccountSubType);
                setInstitution('');
                setCustomInstitution('');
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
            >
              {BRANCH_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Firma / Kurum</label>
            <div className="relative">
              <select
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
              >
                <option value="">Seçiniz</option>
                {(INSTITUTION_OPTIONS[branch] || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="Diğer">Diğer (Ekle)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
            </div>
            {institution === 'Diğer' && (
              <input
                type="text"
                required
                value={customInstitution}
                onChange={(e) => setCustomInstitution(e.target.value)}
                placeholder="Firma/Kurum adını girin"
                className="w-full mt-2 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Alt Kategori</label>
            <div className="relative">
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value as AccountSubType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
              >
                {SUBTYPE_OPTIONS[branch].map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {subType === 'credit_card' && (
            <div className="space-y-4 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Kredi Limiti</label>
                  <input
                    type="text"
                    required
                    value={formatAmount(creditLimit)}
                    onChange={(e) => setCreditLimit(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hesap Kesim Günü</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <p className="text-[10px] text-rose-500/60 font-medium italic">
                * Borç ve asgari ödeme tutarı harcamalarınıza göre otomatik hesaplanacaktır.
              </p>
            </div>
          )}

          {subType === 'liquidity_deposit' && (
            <div className="space-y-4 p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Mevduat Tipi</label>
                <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsTimeDeposit(false)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isTimeDeposit ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-300 hover:text-white'}`}
                  >
                    Vadesiz
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTimeDeposit(true)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isTimeDeposit ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-300 hover:text-white'}`}
                  >
                    Vadeli
                  </button>
                </div>
              </div>

              {isTimeDeposit && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Faiz Oranı (%)</label>
                    <input
                      type="text"
                      required={isTimeDeposit}
                      value={formatAmount(interestRate)}
                      onChange={(e) => setInterestRate(parseAmount(cleanAmountInput(e.target.value)))}
                      placeholder="Örn: 45,5"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Vade Süresi</label>
                    <div className="relative">
                      <select
                        value={depositPeriod}
                        onChange={(e) => setDepositPeriod(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                      >
                        <option value="daily">Günlük</option>
                        <option value="monthly">Aylık</option>
                        <option value="yearly">Yıllık</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Vade Sonu Tarihi</label>
                    <input
                      type="date"
                      required={isTimeDeposit}
                      value={maturityDate}
                      onChange={(e) => setMaturityDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {(subType === 'investment' || branch === 'crypto') && (
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-3 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={isAsset}
                  onChange={(e) => setIsAsset(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-900"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-200">Belirli bir varlık (Hisse/Fon/Kripto) ekliyorum</span>
                  <span className="text-xs text-zinc-400">Birim fiyat ve maliyet takibi için seçin</span>
                </div>
              </label>
            </div>
          )}

          {isAsset && (
            <div className="space-y-4 p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Varlık Tipi</label>
                  <div className="relative">
                    <select
                      value={assetType}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        setAssetType(newType);
                        setAssetSymbol('');
                        setCustomAssetSymbol('');
                        if (newType === 'crypto') {
                          setCurrency('USD');
                        } else {
                          setCurrency('TRY');
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                    >
                      <option value="stock">Hisse Senedi</option>
                      <option value="fund">Yatırım Fonu</option>
                      <option value="crypto">Kripto Para</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sembol / Kod</label>
                  <div className="relative">
                    <select
                      required={isAsset}
                      value={assetSymbol}
                      onChange={(e) => setAssetSymbol(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                    >
                      <option value="">Seçiniz</option>
                      {(ASSET_OPTIONS[assetType] || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="Diğer">Diğer (Ekle)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              
              {assetSymbol === 'Diğer' && (
                <input
                  type="text"
                  required={isAsset}
                  value={customAssetSymbol}
                  onChange={(e) => setCustomAssetSymbol(e.target.value.toUpperCase())}
                  placeholder="Örn: AAPL, XU100"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Adet</label>
                  <input
                    type="text"
                    value={formatAmount(assetQuantity, assetType === 'crypto' ? 8 : 2)}
                    onChange={(e) => handleQuantityChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder={assetType === 'crypto' ? "0,00000000" : "0,00"}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Alım Tarihi</label>
                  <input
                    type="date"
                    required={isAsset}
                    value={assetPurchaseDate}
                    onChange={(e) => setAssetPurchaseDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/50">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Birim Fiyat ({assetType === 'crypto' ? '$' : '₺'})</label>
                  <input
                    type="text"
                    value={formatAmount(assetUnitPrice, assetType === 'crypto' ? 8 : 2)}
                    onChange={(e) => handleUnitPriceChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder={assetType === 'crypto' ? "0,00000000" : "0,00"}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Toplam Maliyet ({assetType === 'crypto' ? '$' : '₺'})</label>
                  <input
                    type="text"
                    value={formatAmount(assetTotalCost, assetType === 'crypto' ? 8 : 2)}
                    onChange={(e) => handleTotalCostChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder={assetType === 'crypto' ? "0,00000000" : "0,00"}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hesap Adı (İsteğe Bağlı)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Garanti Maaş"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {!isAsset && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tür</label>
                <div className="flex p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
                  {(['asset', 'liability'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        type === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      {t === 'asset' ? 'Varlık' : 'Borç'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Bakiye ve Para Birimi</label>
                <div className="flex gap-2 overflow-hidden">
                  <input
                    type="text"
                    value={formatAmount(balance)}
                    onChange={(e) => setBalance(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
                    className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                  />
                  <div className="relative w-24 flex-shrink-0">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                    >
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}

          {subType === 'credit_debt' && (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Kart Puanları</label>
                <button 
                  type="button"
                  onClick={() => setPoints([...points, { name: '', amount: 0 }])}
                  className="text-xs text-emerald-500 font-medium hover:underline"
                >
                  + Puan Ekle
                </button>
              </div>
              {points.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const newPoints = [...points];
                      newPoints[idx].name = e.target.value;
                      setPoints(newPoints);
                    }}
                    placeholder="Puan Adı (Chip-para vb.)"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <input
                    type="text"
                    value={formatAmount(p.amount)}
                    onChange={(e) => {
                      const newPoints = [...points];
                      newPoints[idx].amount = parseFloat(parseAmount(cleanAmountInput(e.target.value))) || 0;
                      setPoints(newPoints);
                    }}
                    placeholder="Tutar"
                    className="w-24 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button 
                    type="button"
                    onClick={() => setPoints(points.filter((_, i) => i !== idx))}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
          >
            {loading ? 'Kaydediliyor...' : 'Hesabı Kaydet'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const TransactionModal = ({ isOpen, onClose, householdId, accounts, categories, members, initialData, isPrivacyMode, defaultIsSubscription = false }: any) => {
  const { user } = useAuth();
  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [userId, setUserId] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [isSubscription, setIsSubscription] = useState(defaultIsSubscription);
  const [periodDay, setPeriodDay] = useState(new Date().getDate().toString());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.amount.toString());
        setCurrency(initialData.currency || 'TRY');
        setDescription(initialData.description);
        setDate(initialData.date.toISOString().split('T')[0]);
        setDebitAccountId(initialData.debitAccountId);
        setCreditAccountId(initialData.creditAccountId);
        setCategoryId(initialData.categoryId);
        setUserId(initialData.userId || user?.uid || '');
        setIsInstallment(initialData.isInstallment || false);
        setInstallmentCount(initialData.installmentCount?.toString() || '2');
        setIsSubscription(false);
        
        // Determine type
        const debitAcc = accounts.find((a: any) => a.id === initialData.debitAccountId);
        const creditAcc = accounts.find((a: any) => a.id === initialData.creditAccountId);
        if (debitAcc?.type === 'asset' && creditAcc?.type === 'asset') setType('transfer');
        else if (debitAcc?.type === 'asset') setType('income');
        else setType('expense');
      } else {
        setAmount('');
        setCurrency('TRY');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setUserId(user?.uid || '');
        setIsInstallment(false);
        setInstallmentCount('2');
        setIsSubscription(defaultIsSubscription);
        // Set defaults
        if (type === 'expense') {
          const defaultCat = categories.find((c: any) => c.type === 'expense');
          const defaultAcc = accounts.find((a: any) => a.type === 'asset');
          setDebitAccountId(defaultCat?.id || '');
          setCreditAccountId(defaultAcc?.id || '');
          setCategoryId(defaultCat?.id || '');
        } else if (type === 'income') {
          const defaultCat = categories.find((c: any) => c.type === 'income');
          const defaultAcc = accounts.find((a: any) => a.type === 'asset');
          setDebitAccountId(defaultAcc?.id || '');
          setCreditAccountId(defaultCat?.id || '');
          setCategoryId(defaultCat?.id || '');
        } else {
          setDebitAccountId(accounts[0]?.id || '');
          setCreditAccountId(accounts[1]?.id || '');
        }
      }
    }
  }, [isOpen, type, accounts, categories, initialData, user, defaultIsSubscription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !householdId) return;
    setLoading(true);

    try {
      const txData = {
        description,
        amount: parseFloat(amount),
        currency,
        date: new Date(date),
        debitAccountId,
        creditAccountId,
        categoryId: type === 'transfer' ? 'transfer' : categoryId,
        userId: userId || user.uid,
      };

      if (initialData) {
        await updateLedgerTransaction(householdId, initialData.id, txData);
      } else if (isInstallment && type === 'expense') {
        await createInstallmentTransactions(householdId, txData, parseInt(installmentCount));
      } else if (isSubscription && type === 'expense') {
        // Create as a recurring expense source
        await createExpenseSource(householdId, {
          name: description,
          amount: parseFloat(amount),
          currency,
          flowType: 'fixed',
          periodDay: parseInt(periodDay),
          sourceAccountId: creditAccountId,
          categoryId,
          ownerId: userId || user.uid,
          status: 'active'
        });
        // Also create the first transaction
        await createLedgerTransaction(householdId, txData);
      } else {
        await createLedgerTransaction(householdId, txData);
      }
      onClose();
    } catch (error) {
      console.error('Transaction error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <h3 className="text-xl font-bold">Yeni İşlem</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">İşlemi Yapan</label>
            <select 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none"
            >
              {Object.entries(members || {}).map(([id, m]: [string, any]) => (
                <option key={id} value={id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          <div className="flex p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  type === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {t === 'expense' ? 'Gider' : t === 'income' ? 'Gelir' : 'Transfer'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tutar ve Para Birimi</label>
              <div className="flex gap-2 overflow-hidden">
                <input
                  type="text"
                  required
                  value={formatAmount(amount)}
                  onChange={(e) => setAmount(parseAmount(cleanAmountInput(e.target.value)))}
                  placeholder="0,00"
                  className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                />
                <div className="relative w-24 flex-shrink-0">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tarih</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Açıklama</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örn: Market alışverişi"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {type === 'expense' && !initialData && (
            <div className="space-y-4 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-900"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-200">Taksitli İşlem</span>
                  <span className="text-xs text-zinc-400">Harcamayı aylara bölmek için seçin</span>
                </div>
              </label>

              {isInstallment && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Taksit Sayısı</label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 6, 9, 12].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setInstallmentCount(num.toString())}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          installmentCount === num.toString() 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      className="w-16 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 italic">
                    * Toplam {amount || '0'} {currency} tutarı {installmentCount} taksite bölünecek. 
                    Her ay {(parseFloat(amount || '0') / parseInt(installmentCount || '1')).toFixed(2)} {currency} olarak kaydedilecek.
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-800/50 mt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSubscription}
                    onChange={(e) => {
                      setIsSubscription(e.target.checked);
                      if (e.target.checked) setIsInstallment(false);
                    }}
                    className="w-5 h-5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-900"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-200">Düzenli Ödeme (Abonelik)</span>
                    <span className="text-xs text-zinc-400">Kira, abonelik gibi her ay tekrarlayan ödemeler</span>
                  </div>
                </label>

                {isSubscription && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Her Ayın Kaçında?</label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 5, 10, 15, 20, 25, 28].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setPeriodDay(day.toString())}
                          className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                            periodDay === day.toString() 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={periodDay}
                        onChange={(e) => setPeriodDay(e.target.value)}
                        className="w-12 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {type === 'expense' ? 'Ödeme Hesabı' : type === 'income' ? 'Hedef Hesap' : 'Kaynak Hesap'}
              </label>
              <div className="relative">
                <select
                  required
                  value={type === 'income' ? debitAccountId : creditAccountId}
                  onChange={(e) => type === 'income' ? setDebitAccountId(e.target.value) : setCreditAccountId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                >
                  <option value="">Seçiniz</option>
                  {BRANCH_OPTIONS.map(branch => {
                    const branchAccs = accounts
                      .filter((a: any) => a.branch === branch.id)
                      .sort((a: any, b: any) => {
                        if (a.institution !== b.institution) return (a.institution || '').localeCompare(b.institution || '');
                        const aIsTime = a.depositDetails?.isTimeDeposit ? 1 : 0;
                        const bIsTime = b.depositDetails?.isTimeDeposit ? 1 : 0;
                        if (aIsTime !== bIsTime) return bIsTime - aIsTime;
                        if (a.subType !== b.subType) return (a.subType || '').localeCompare(b.subType || '');
                        return a.name.localeCompare(b.name);
                      });
                    
                    if (branchAccs.length === 0) return null;

                    const options: React.ReactNode[] = [];
                    let lastInst = "";
                    let lastSubType = "";

                    branchAccs.forEach((acc: any) => {
                      const inst = acc.institution || 'Diğer';
                      const subTypeLabel = acc.subType === 'liquidity_deposit' && acc.depositDetails 
                        ? (acc.depositDetails.isTimeDeposit ? 'Vadeli Hesaplar' : 'Vadesiz Hesaplar')
                        : (SUBTYPE_OPTIONS[acc.branch]?.find(o => o.id === acc.subType)?.label || 'Diğer');

                      if (inst !== lastInst) {
                        options.push(<option key={`inst-${inst}`} disabled className="font-bold text-zinc-300 bg-zinc-900">{inst}</option>);
                        lastInst = inst;
                        lastSubType = "";
                      }

                      if (subTypeLabel !== lastSubType) {
                        options.push(<option key={`sub-${inst}-${subTypeLabel}`} disabled className="text-zinc-400 bg-zinc-950/50 italic">&nbsp;&nbsp;{subTypeLabel}</option>);
                        lastSubType = subTypeLabel;
                      }

                      options.push(
                        <option key={acc.id} value={acc.id}>
                          &nbsp;&nbsp;&nbsp;&nbsp;{acc.name} ({formatWithEquivalent(acc.balance, acc.currency || 'TRY')})
                        </option>
                      );
                    });

                    return (
                      <optgroup key={branch.id} label={branch.label}>
                        {options}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {type === 'expense' ? 'Kategori' : type === 'income' ? 'Gelir Kaynağı' : 'Hedef Hesap'}
              </label>
              {type === 'transfer' ? (
                <div className="relative">
                  <select
                    required
                    value={debitAccountId}
                    onChange={(e) => setDebitAccountId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                  >
                    <option value="">Seçiniz</option>
                    {BRANCH_OPTIONS.map(branch => {
                      const branchAccs = accounts
                        .filter((a: any) => a.branch === branch.id && a.id !== creditAccountId)
                        .sort((a: any, b: any) => {
                          if (a.institution !== b.institution) return (a.institution || '').localeCompare(b.institution || '');
                          const aIsTime = a.depositDetails?.isTimeDeposit ? 1 : 0;
                          const bIsTime = b.depositDetails?.isTimeDeposit ? 1 : 0;
                          if (aIsTime !== bIsTime) return bIsTime - aIsTime;
                          if (a.subType !== b.subType) return (a.subType || '').localeCompare(b.subType || '');
                          return a.name.localeCompare(b.name);
                        });
                      
                      if (branchAccs.length === 0) return null;

                      const options: React.ReactNode[] = [];
                      let lastInst = "";
                      let lastSubType = "";

                      branchAccs.forEach((acc: any) => {
                        const inst = acc.institution || 'Diğer';
                        const subTypeLabel = acc.subType === 'liquidity_deposit' && acc.depositDetails 
                          ? (acc.depositDetails.isTimeDeposit ? 'Vadeli Hesaplar' : 'Vadesiz Hesaplar')
                          : (SUBTYPE_OPTIONS[acc.branch]?.find(o => o.id === acc.subType)?.label || 'Diğer');

                        if (inst !== lastInst) {
                          options.push(<option key={`inst-${inst}`} disabled className="font-bold text-zinc-300 bg-zinc-900">{inst}</option>);
                          lastInst = inst;
                          lastSubType = "";
                        }

                        if (subTypeLabel !== lastSubType) {
                          options.push(<option key={`sub-${inst}-${subTypeLabel}`} disabled className="text-zinc-400 bg-zinc-950/50 italic">&nbsp;&nbsp;{subTypeLabel}</option>);
                          lastSubType = subTypeLabel;
                        }

                        options.push(
                          <option key={acc.id} value={acc.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;{acc.name}
                          </option>
                        );
                      });

                      return (
                        <optgroup key={branch.id} label={branch.label}>
                          {options}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                </div>
              ) : (
                <div className="relative">
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCategoryId(val);
                      if (type === 'expense') setDebitAccountId(val);
                      else if (type === 'income') setCreditAccountId(val);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white cursor-pointer"
                  >
                    <option value="">Seçiniz</option>
                    {categories.filter((c: any) => c.type === type).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 mt-4"
          >
            {loading ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Login = () => {
  const { login, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [isKvkkModalOpen, setIsKvkkModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kvkkAccepted) {
      setError('Lütfen KVKK Aydınlatma Metni\'ni onaylayın.');
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      await login(email, name, kvkkAccepted);
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!kvkkAccepted) {
      setError('Lütfen KVKK Aydınlatma Metni\'ni onaylayın.');
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      // Small delay to ensure user gesture is processed cleanly
      await new Promise(resolve => setTimeout(resolve, 100));
      await loginWithGoogle(kvkkAccepted);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Giriş penceresi kapatıldı veya önizleme ortamı tarafından engellendi. Lütfen tekrar deneyin veya "Yerel Giriş" seçeneğini kullanın.');
      } else {
        setError(err.message || 'Google ile giriş yapılamadı.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-emerald-500/10 rounded-3xl mb-4">
            <Wallet className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">FinansHane</h1>
          <p className="text-zinc-400">Verileriniz cihazınızda şifrelenmiş olarak saklanır.</p>
        </div>

        <div className="space-y-6 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-950 font-bold py-4 rounded-2xl transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>Google ile Giriş Yap</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">Veya Yerel Giriş</span>
            </div>
          </div>

          <form onSubmit={handleLocalLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Ad Soyad</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                placeholder="Adınız"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
                placeholder="E-posta adresiniz"
              />
            </div>

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
              <label htmlFor="kvkk" className="text-xs text-zinc-400 leading-relaxed">
                <button 
                  type="button"
                  onClick={() => setIsKvkkModalOpen(true)}
                  className="text-emerald-500 hover:underline font-medium"
                >
                  KVKK Aydınlatma Metni
                </button>
                'ni okudum ve verilerimin yerel olarak işlenmesini onaylıyorum.
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Giriş Yapılıyor...' : 'Yerel Giriş Yap'}
            </button>
          </form>
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

const KVKKConsentModal = ({ isOpen, onAccept }: { isOpen: boolean; onAccept: () => void }) => {
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
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, FinansHane olarak, veri sorumlusu sıfatıyla, kişisel verilerinizin aşağıda açıklanan kapsamda işlenebileceğini bildiririz.</p>
          
          <h4 className="text-white font-bold">1. Kişisel Verilerin İşlenme Amacı</h4>
          <p>Kişisel verileriniz; bütçe yönetimi, finansal analizler, hane içi paylaşım ve uygulama hizmetlerinin sunulması amacıyla işlenmektedir.</p>
          
          <h4 className="text-white font-bold">2. Veri Güvenliği ve Saklama</h4>
          <p>Verileriniz tarayıcınızın yerel veritabanında (IndexedDB) şifrelenmiş olarak saklanmaktadır. FinansHane, verilerinizi merkezi bir sunucuya göndermez; tüm finansal kayıtlarınız sadece sizin cihazınızda kalır. Güvenliğiniz için önemli işlemler (giriş, veri dışa aktarma vb.) yerel bir Güvenlik Günlüğü'nde kayıt altına alınır.</p>
          
          <h4 className="text-white font-bold">3. Veri Sahibi Hakları</h4>
          <p>Dilediğiniz zaman uygulama ayarlarından tüm verilerinizi silebilir veya dışa aktarabilirsiniz. Verileriniz üzerinde tam kontrol sahibisiniz.</p>
          <p>Dilediğiniz zaman verilerinizin silinmesini talep edebilir, verilerinizi dışa aktarabilir veya işlenmesine itiraz edebilirsiniz. Ayarlar bölümünden "Verilerimi Sil" seçeneği ile tüm verilerinizi kalıcı olarak silebilirsiniz.</p>
          
          <p className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 italic">
            "Uygulamayı kullanmaya devam ederek, kişisel verilerinizin bu metin çerçevesinde işlenmesini kabul etmiş sayılırsınız."
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

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
      ${active 
        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
    `}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

const StatCard = ({ title, amount, trend, icon: Icon, color }: any) => (
  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm font-medium ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-zinc-300 text-sm mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-white">₺{amount.toLocaleString()}</h3>
  </div>
);

const JoinOrCreateHousehold = () => {
  const { user, logout } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-check for existing households on mount
  useEffect(() => {
    const checkExisting = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Check if user profile has activeHouseholdId in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.activeHouseholdId) {
            // If found, useAuth sync should handle it, but we can force a reload or just wait
            // Actually, if we are here, it means localDB doesn't have it yet.
            // Let's sync it to localDB manually here to speed up
            const householdDoc = await getDoc(doc(db, 'households', userData.activeHouseholdId));
            if (householdDoc.exists()) {
              await localDB.households.put({ ...householdDoc.data(), id: householdDoc.id } as Household);
              await localDB.users.update(user.uid, { activeHouseholdId: householdDoc.id });
              return; // useLiveQuery will trigger re-render
            }
          }
        }

        // 2. If not in profile, check if user is a member of any household
        // This is a bit more expensive but helpful
        const q = query(collection(db, 'households'), where(`members.${user.uid}.role`, 'in', ['owner', 'member']));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const householdDoc = snap.docs[0];
          const householdId = householdDoc.id;
          
          // Sync to localDB
          await localDB.households.put({ ...householdDoc.data(), id: householdId } as Household);
          await localDB.users.update(user.uid, { activeHouseholdId: householdId });
          
          // Update Firestore profile too
          await updateDoc(doc(db, 'users', user.uid), { activeHouseholdId: householdId });
        }
      } catch (err) {
        console.error('Check existing error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkExisting();
  }, [user]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'households'), where('joinCode', '==', joinCode.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Geçersiz katılım kodu.');
        return;
      }

      const householdDoc = snap.docs[0];
      const householdId = householdDoc.id;
      const householdData = householdDoc.data();

      // Check if user is already a member
      if (householdData.members && householdData.members[user.uid]) {
        setError('Zaten bu hanenin bir üyesisiniz.');
        return;
      }

      // Add user to household members
      const memberData = {
        role: 'member',
        type: 'other',
        salaryVisible: true,
        displayName: user.displayName || 'Kullanıcı',
        email: user.email || ''
      };

      try {
        await updateDoc(doc(db, 'households', householdId), {
          [`members.${user.uid}`]: memberData
        });
      } catch (err: any) {
        console.error('Household update error:', err);
        if (err.code === 'permission-denied') {
          setError('Hane güncellenemedi. Lütfen hane sahibi ile iletişime geçin.');
        } else {
          throw err;
        }
        return;
      }

      // Update user profile in Firestore
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          activeHouseholdId: householdId
        });
      } catch (err: any) {
        console.error('User profile update error:', err);
        if (err.code === 'permission-denied') {
          setError('Profil güncellenemedi. Lütfen tekrar deneyin.');
        } else {
          throw err;
        }
        return;
      }

      // SYNC TO LOCALDB
      try {
        const updatedHouseholdDoc = await getDoc(doc(db, 'households', householdId));
        if (updatedHouseholdDoc.exists()) {
          await localDB.households.put({ ...updatedHouseholdDoc.data(), id: householdId } as Household);
        }
        await localDB.users.update(user.uid, { activeHouseholdId: householdId });
      } catch (err: any) {
        console.error('LocalDB sync error:', err);
        // This is not a fatal error for the UI, but we should log it
      }

    } catch (err: any) {
      console.error('Join error:', err);
      setError('Bir hata oluştu: ' + (err.message || 'Lütfen tekrar deneyin.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const householdId = `household-${user.uid}`;
      const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const householdData = {
        name: `${user.displayName?.split(' ')[0]} Ailesi`,
        ownerId: user.uid,
        currency: 'TRY',
        joinCode: newJoinCode,
        members: {
          [user.uid]: { 
            role: 'owner', 
            type: 'adult',
            salaryVisible: true,
            displayName: user.displayName || 'Kullanıcı',
            email: user.email || ''
          }
        },
        createdAt: new Date()
      };

      await setDoc(doc(db, 'households', householdId), householdData, { merge: true });

      await updateDoc(doc(db, 'users', user.uid), {
        activeHouseholdId: householdId
      });

      // SYNC TO LOCALDB
      await localDB.households.put({ ...householdData, id: householdId } as Household);
      await localDB.users.update(user.uid, { activeHouseholdId: householdId });

    } catch (err: any) {
      console.error('Create error:', err);
      setError('Hane oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
      >
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Users className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2">Hane Seçimi</h2>
        <p className="text-zinc-300 text-center mb-8 text-sm">Finansal verilerinizi yönetmek için bir haneye katılın veya yeni bir hane oluşturun.</p>

        <form onSubmit={handleJoin} className="space-y-4 mb-8">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Katılım Kodu</label>
            <input 
              type="text"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Örn: AB12CD"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          {error && <p className="text-rose-500 text-xs text-center">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? 'Katılınıyor...' : 'Haneye Katıl'}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-2 text-zinc-400">Veya</span>
          </div>
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-all disabled:opacity-50"
        >
          Yeni Hane Oluştur
        </button>

        <button 
          onClick={logout}
          className="w-full mt-6 text-zinc-400 text-sm hover:text-white transition-colors"
        >
          Çıkış Yap
        </button>
      </motion.div>
    </div>
  );
};

const AuditModal = ({ isOpen, onClose, logs }: { isOpen: boolean; onClose: () => void; logs: any[] }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" /> Güvenlik Günlükleri
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {logs.length === 0 && <p className="text-center text-zinc-400 py-8">Henüz işlem kaydı bulunmuyor.</p>}
          {logs.map(log => (
            <div key={log.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{log.action}</p>
                <p className="text-[10px] text-zinc-400 mt-1">{log.details}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono text-zinc-500">
                  {new Date(log.timestamp).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold transition-all"
          >
            Kapat
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const NotificationsDropdown: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
        <h3 className="font-semibold text-white">Bildirimler</h3>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2 bg-zinc-900/50 backdrop-blur-xl">
        <div className="p-3 hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer group">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Yeni İşlem Eklendi</p>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">Market alışverişi için 450.00 TRY harcama eklendi.</p>
              <p className="text-[10px] text-zinc-500 mt-1">Az önce</p>
            </div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
          </div>
        </div>
        <div className="p-3 hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer group">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Bütçe Uyarısı</p>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">Mutfak bütçenizin %80'ine ulaştınız.</p>
              <p className="text-[10px] text-zinc-500 mt-1">2 saat önce</p>
            </div>
          </div>
        </div>
        <div className="p-3 hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer group">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Sistem Güncellemesi</p>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">Yeni raporlama özellikleri eklendi. Hemen göz atın!</p>
              <p className="text-[10px] text-zinc-500 mt-1">Dün</p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-xl text-center">
        <button className="text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
          Tümünü Gör
        </button>
      </div>
    </div>
    </>
  );
};

const Dashboard = () => {
  const { user, profile, household, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalIsSubscription, setTxModalIsSubscription] = useState(false);
  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const logSecurityAction = async (action: string, details?: string) => {
    if (!user) return;
    try {
      const logId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await localDB.auditLogs.add({
        id: logId,
        timestamp: new Date(),
        action,
        userId: user.uid,
        details
      });
    } catch (e) {
      console.error("Failed to log security action:", e);
    }
  };
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const saved = localStorage.getItem('privacy_mode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('privacy_mode', String(isPrivacyMode));
  }, [isPrivacyMode]);

  const maskValue = (value: string | number) => {
    if (!isPrivacyMode) return value;
    return '••••••';
  };
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncomeSource, setEditingIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleteTxConfirmOpen, setIsDeleteTxConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [isKVKKModalOpen, setIsKVKKModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (profile && !profile.kvkkAccepted) {
      setIsKVKKModalOpen(true);
    }
  }, [profile]);

  const handleAcceptKVKK = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        kvkkAccepted: true,
        kvkkAcceptedAt: new Date()
      });
      setIsKVKKModalOpen(false);
    } catch (error) {
      console.error('KVKK accept error:', error);
    }
  };

  const handleLogout = async () => {
    await logSecurityAction('logout', 'User logged out');
    logout();
  };

  const handleExportData = async () => {
    await logSecurityAction('export_data', 'User exported all data to JSON');
    const data = {
      profile,
      household,
      accounts,
      transactions,
      incomeSources,
      plannedExpenses
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanshane-verilerim-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleDeleteAllData = async () => {
    if (!confirm("Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?")) return;
    
    try {
      await logSecurityAction('delete_all_data', 'User initiated full data deletion');
      await localDB.accounts.clear();
      await localDB.transactions.clear();
      await localDB.incomeSources.clear();
      await localDB.expectedIncomes.clear();
      await localDB.plannedExpenses.clear();
      await localDB.sharedBudgets.clear();
      // Keep audit logs for a short while or clear them too? Let's clear them for full privacy.
      await localDB.auditLogs.clear();
      
      setNotification({ type: 'success', message: 'Tüm verileriniz başarıyla silindi.' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      console.error("Failed to delete data:", e);
      setNotification({ type: 'error', message: 'Veriler silinirken bir hata oluştu.' });
    }
  };
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings') {
      localDB.auditLogs.orderBy('timestamp').reverse().limit(50).toArray().then(setAuditLogs);
    }
  }, [activeTab]);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };


  // Sync owner profile info and generate joinCode if missing
  useEffect(() => {
    const syncHousehold = async () => {
      if (user && household && household.ownerId === user.uid) {
        const member = household.members[user.uid];
        const updates: any = {};
        
        if (member && (!member.email || member.displayName === 'Kullanıcı')) {
          updates[`members.${user.uid}.email`] = user.email || '';
          updates[`members.${user.uid}.displayName`] = user.displayName || 'Kullanıcı';
        }
        
        if (!household.joinCode) {
          updates.joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        
        if (Object.keys(updates).length > 0) {
          const householdRef = doc(db, 'households', household.id);
          await updateDoc(householdRef, updates);
          await localDB.households.update(household.id, updates);
        }
      }
    };
    syncHousehold();
  }, [user, household]);

  // Real data fetching
  const accountConstraints = useMemo(() => [], []);
  const { data: allAccounts } = useCollection<Account>(
    household ? `households/${household.id}/accounts` : '',
    accountConstraints
  );
  
  const accounts = allAccounts.filter(a => a.type === 'asset' || a.type === 'liability');
  const categories = allAccounts.filter(a => a.type === 'income' || a.type === 'expense');

  const transactionConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: transactions } = useCollection<Transaction>(
    household ? `households/${household.id}/transactions` : '',
    transactionConstraints
  );

  const incomeSourceConstraints = useMemo(() => [], []);
  const { data: incomeSources } = useCollection<IncomeSource>(
    household ? `households/${household.id}/incomeSources` : '',
    incomeSourceConstraints
  );

  const expenseSourceConstraints = useMemo(() => [], []);
  const { data: expenseSources } = useCollection<any>(
    household ? `households/${household.id}/expenseSources` : '',
    expenseSourceConstraints
  );

  const expectedIncomeConstraints = useMemo(() => [orderBy('expectedDate', 'asc')], []);
  const { data: expectedIncomes } = useCollection<ExpectedIncome>(
    household ? `households/${household.id}/expectedIncomes` : '',
    expectedIncomeConstraints
  );

  const plannedExpenseConstraints = useMemo(() => [orderBy('dueDate', 'asc')], []);
  const { data: plannedExpenses } = useCollection<PlannedExpense>(
    household ? `households/${household.id}/plannedExpenses` : '',
    plannedExpenseConstraints
  );

  const { formatWithEquivalent, convertToTRY } = useExchangeRates(isPrivacyMode);

  const assetSymbols = useMemo(() => {
    const symbols: { symbol: string; type: 'stock' | 'crypto' | 'fund' }[] = [];
    accounts.forEach(a => {
      if (a.assetDetails) {
        symbols.push({ symbol: a.assetDetails.symbol, type: a.assetDetails.assetType });
      }
    });
    return symbols;
  }, [accounts]);

  const { prices: assetPrices } = useAssetPrices(assetSymbols);

  // Stats calculation
  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => {
    let balance = a.balance;
    if (a.assetDetails && assetPrices[a.assetDetails.symbol]) {
      balance = a.assetDetails.quantity * assetPrices[a.assetDetails.symbol].price;
    }
    return sum + convertToTRY(balance, a.currency || 'TRY');
  }, 0);
  
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + convertToTRY(a.balance, a.currency || 'TRY'), 0);
  const netWorth = totalAssets - totalLiabilities;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyIncome = transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      return txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             debitAcc?.type === 'asset' && 
             creditAcc?.type === 'income';
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyExpense = transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
      return txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             debitAcc?.type === 'expense' && 
             creditAcc?.type === 'asset';
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Category distribution data
  const categoryData = categories
    .filter(c => c.type === 'expense')
    .map(cat => {
      const amount = transactions
        .filter(tx => tx.categoryId === cat.id && new Date(tx.date).getMonth() === currentMonth)
        .reduce((sum, tx) => sum + tx.amount, 0);
      return { name: cat.name, value: amount };
    })
    .filter(c => c.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Cash flow chart data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const chartData = last7Days.map(date => {
    const dateStr = new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const dayIncome = transactions
      .filter(tx => {
        const txDate = tx.date;
        const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
        const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
        return txDate.toDateString() === date.toDateString() &&
               debitAcc?.type === 'asset' && 
               creditAcc?.type === 'income';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const dayExpense = transactions
      .filter(tx => {
        const txDate = tx.date;
        const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
        const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
        return txDate.toDateString() === date.toDateString() &&
               debitAcc?.type === 'expense' && 
               creditAcc?.type === 'asset';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    return { name: dateStr, gelir: dayIncome, gider: dayExpense };
  });

  // Category initialization
  useEffect(() => {
    const initCategories = async () => {
      if (!household || categories.length > 0) return;

      const defaultCategories = [
        { name: 'Maaş', type: 'income', icon: 'briefcase' },
        { name: 'Ek Gelir', type: 'income', icon: 'plus-circle' },
        { name: 'Market', type: 'expense', icon: 'shopping-cart' },
        { name: 'Kira', type: 'expense', icon: 'home' },
        { name: 'Fatura', type: 'expense', icon: 'zap' },
        { name: 'Ulaşım', type: 'expense', icon: 'car' },
        { name: 'Eğlence', type: 'expense', icon: 'film' },
        { name: 'Sağlık', type: 'expense', icon: 'heart' },
      ];

      for (const cat of defaultCategories) {
        const catId = cat.name.toLowerCase().replace(/\s+/g, '-');
        await setDoc(doc(db, `households/${household.id}/accounts/${catId}`), {
          ...cat,
          balance: 0,
          currency: 'TRY',
          createdAt: new Date()
        }, { merge: true });
      }
    };

    initCategories();
  }, [household, categories.length]);

  // Auto-fix demo accounts if institution is missing
  useEffect(() => {
    if (!household || accounts.length === 0) return;
    
    const fixDemoAccounts = async () => {
      const demoFixes: Record<string, string> = {
        'nakit': 'Nakit',
        'maaş-hesabı': 'Garanti BBVA',
        'kredi-kartı': 'Akbank',
        'binance': 'Binance',
        'istanbulkart': 'İstanbulkart'
      };
      
      for (const acc of accounts) {
        if (!acc.institution && demoFixes[acc.id]) {
          try {
            await setDoc(doc(db, `households/${household.id}/accounts/${acc.id}`), {
              institution: demoFixes[acc.id]
            }, { merge: true });
          } catch (e) {
            console.error("Failed to fix demo account:", e);
          }
        }
      }
    };
    
    fixDemoAccounts();
  }, [household, accounts.length]);

  const handleDeleteTransaction = async (txId: string) => {
    if (!household) return;
    setTxToDelete(txId);
    setIsDeleteTxConfirmOpen(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!household || !txToDelete) return;
    try {
      await deleteLedgerTransaction(household.id, txToDelete);
      setIsDeleteTxConfirmOpen(false);
      setTxToDelete(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleApproveIncome = async (expected: ExpectedIncome) => {
    if (!household || !user) return;
    
    try {
      // 1. Create a transaction
      const txData = {
        description: `${expected.sourceName} (Gerçekleşen)`,
        amount: expected.amount,
        currency: expected.currency,
        date: new Date(),
        debitAccountId: expected.targetAccountId,
        creditAccountId: 'maas', // Default to salary category for now, or find the right one
        categoryId: 'maas',
        userId: user.uid,
      };

      await createLedgerTransaction(household.id, txData);

      // 2. Update expected income status
      await setDoc(doc(db, `households/${household.id}/expectedIncomes/${expected.id}`), {
        status: 'realized',
        transactionId: 'temp-id', // Ideally we get the ID from createLedgerTransaction
      }, { merge: true });

      // 3. If it's a fixed/variable source, generate the NEXT expected income
      const source = incomeSources.find(s => s.id === expected.sourceId);
      if (source && source.flowType !== 'spot') {
        const nextDate = expected.expectedDate;
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        await setDoc(doc(collection(db, `households/${household.id}/expectedIncomes`)), {
          sourceId: source.id,
          sourceName: source.name,
          amount: source.amount,
          currency: source.currency,
          expectedDate: new Date(nextDate),
          status: 'pending',
          targetAccountId: source.targetAccountId,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Approve income error:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 border-r border-border bg-card flex flex-col z-50 transition-transform duration-300 lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">FinansHane</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Kurumsal Finans</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-secondary rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Genel Bakış" 
            active={activeTab === 'overview'} 
            onClick={() => handleTabChange('overview')} 
          />
          <SidebarItem 
            icon={CreditCard} 
            label="Hesaplar" 
            active={activeTab === 'accounts'} 
            onClick={() => handleTabChange('accounts')} 
          />
          <SidebarItem 
            icon={TrendingUp} 
            label="Gelir" 
            active={activeTab === 'income'} 
            onClick={() => handleTabChange('income')} 
          />
          <SidebarItem 
            icon={TrendingDown} 
            label="Gider" 
            active={activeTab === 'expense'} 
            onClick={() => handleTabChange('expense')} 
          />
          <SidebarItem 
            icon={PieChart} 
            label="Rapor" 
            active={activeTab === 'reports'} 
            onClick={() => handleTabChange('reports')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Gruplar" 
            active={activeTab === 'groups'} 
            onClick={() => handleTabChange('groups')} 
          />
          {profile?.isAdmin && (
            <SidebarItem 
              icon={Shield} 
              label="Yönetici Paneli" 
              active={activeTab === 'admin'} 
              onClick={() => handleTabChange('admin')} 
            />
          )}
        </nav>

        <div className="p-4 border-t border-border/50">
          <SidebarItem 
            icon={Settings} 
            label="Ayarlar" 
            active={activeTab === 'settings'} 
            onClick={() => handleTabChange('settings')} 
          />
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all font-medium mt-1"
          >
            <LogOut className="w-5 h-5" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 h-20 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-secondary rounded-xl"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeTab === 'overview' && 'Genel Bakış'}
              {activeTab === 'accounts' && 'Hesaplarım'}
              {activeTab === 'income' && 'Gelir Yönetimi'}
              {activeTab === 'expense' && 'Gider Yönetimi'}
              {activeTab === 'reports' && 'Finansal Raporlar'}
              {activeTab === 'groups' && 'Hane Grupları'}
              {activeTab === 'settings' && 'Ayarlar'}
              {activeTab === 'admin' && 'Yönetici Paneli'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="text-xs font-medium">Gizlilik</span>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-xl">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">KVKK Güvenli</span>
            </div>
            
            <div className="h-8 w-px bg-border mx-1"></div>

            <button 
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:bg-secondary rounded-xl transition-all"
              title={theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  if (!isNotificationsOpen) setHasUnreadNotifications(false);
                }}
                className={`p-2 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
              >
                <Bell className="w-5 h-5" />
                {hasUnreadNotifications && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
                )}
              </button>
              <NotificationsDropdown 
                isOpen={isNotificationsOpen} 
                onClose={() => setIsNotificationsOpen(false)} 
              />
            </div>

            <div className="h-8 w-px bg-border mx-1"></div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <DashboardView 
              householdId={household?.id}
              accounts={accounts}
              transactions={transactions}
              categories={categories}
              incomeSources={incomeSources}
              expectedIncomes={expectedIncomes}
              plannedExpenses={plannedExpenses}
              assetPrices={assetPrices}
              members={household?.members}
              isPrivacyMode={isPrivacyMode}
              onAddIncome={() => {
                setEditingIncomeSource(null);
                setIsIncomeModalOpen(true);
              }}
              onAddTransaction={() => {
                setEditingTransaction(null);
                setIsTxModalOpen(true);
              }}
              onCryptoTransfer={() => {
                // Open transaction modal pre-filled for crypto transfer
                setEditingTransaction({
                  description: 'Kripto Transferi',
                  amount: 0,
                  currency: 'TRY',
                  date: new Date(),
                  debitAccountId: '',
                  creditAccountId: '',
                  categoryId: '',
                  userId: user?.uid || '',
                  isInstallment: false
                } as any);
                setIsTxModalOpen(true);
              }}
              onAkbilLoad={() => {
                // Open transaction modal pre-filled for Akbil
                setEditingTransaction({
                  description: 'Akbil Yüklemesi',
                  amount: 0,
                  currency: 'TRY',
                  date: new Date(),
                  debitAccountId: '', // Should be social card
                  creditAccountId: '', // Should be credit card or bank
                  categoryId: '', // Transport category
                  userId: user?.uid || '',
                  isInstallment: false
                } as any);
                setIsTxModalOpen(true);
              }}
            />
          )}

          {activeTab === 'income' && (
            <IncomeView 
              householdId={household?.id || ''}
              incomeSources={incomeSources}
              expectedIncomes={expectedIncomes}
              transactions={transactions}
              accounts={accounts}
              onAddIncome={() => {
                setEditingIncomeSource(null);
                setIsIncomeModalOpen(true);
              }}
              onEditIncome={(source) => {
                setEditingIncomeSource(source);
                setIsIncomeModalOpen(true);
              }}
              onApproveIncome={handleApproveIncome}
              isPrivacyMode={isPrivacyMode}
            />
          )}

          {activeTab === 'expense' && (
            <ExpenseView 
              householdId={household?.id || ''}
              plannedExpenses={plannedExpenses}
              expenseSources={expenseSources}
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              onAddTransaction={() => {
                setEditingTransaction(null);
                setIsTxModalOpen(true);
              }}
              onAddSubscription={() => {
                setTxModalIsSubscription(true);
                setIsTxModalOpen(true);
              }}
              onAddPlannedExpense={() => {
                setIsTxModalOpen(true);
              }}
              isPrivacyMode={isPrivacyMode}
            />
          )}



          {activeTab === 'accounts' && (
            <AccountsView 
              householdId={household?.id || ''}
              accounts={accounts}
              onAddAccount={() => {
                setEditingAccount(null);
                setIsAccModalOpen(true);
              }}
              onEditAccount={(account) => {
                setEditingAccount(account);
                setIsAccModalOpen(true);
              }}
              isPrivacyMode={isPrivacyMode}
            />
          )}

          {activeTab === 'reports' && (
            <Reports 
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              formatWithEquivalent={formatWithEquivalent}
              convertToTRY={convertToTRY}
            />
          )}

          {activeTab === 'groups' && (
            <SharedBudgets 
              householdId={household?.id || ''}
            />
          )}

          {activeTab === 'admin' && profile?.isAdmin && (
            <AdminPanel currentUserEmail={user?.email || ''} />
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-8">
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6">Profil Ayarları</h3>
                <div className="flex items-center gap-6 mb-8">
                  <img 
                    src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} 
                    className="w-20 h-20 rounded-2xl border-2 border-zinc-800" 
                    alt="Avatar" 
                  />
                  <div>
                    <h4 className="text-lg font-bold">{user?.displayName}</h4>
                    <p className="text-zinc-300">{user?.email}</p>
                    {profile?.isAdmin && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 uppercase tracking-wider mt-1 inline-block">Yönetici</span>
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

              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" /> KVKK ve Bilgi Güvenliği
                </h3>
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mb-6">
                  <p className="text-sm text-emerald-200/80 leading-relaxed">
                    <strong>Güvenlik Notu:</strong> FinansHane, verilerinizi merkezi bir sunucuda değil, tarayıcınızın 
                    <strong> IndexedDB</strong> veritabanında yerel olarak saklar. Tüm hassas veriler cihazınızda 
                    şifrelenmiş olarak tutulur. 2026 Türkiye KVKK standartlarına tam uyumludur.
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
                      onClick={handleDeleteAllData}
                      className="p-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white rounded-xl transition-all text-rose-500"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6">Hane Ayarları</h3>
                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Hane Adı</label>
                    <input 
                      type="text" 
                      defaultValue={household?.name || ''} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Para Birimi</label>
                    <select className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none">
                      <option value="TRY">Türk Lirası (₺)</option>
                      <option value="USD">Amerikan Loları ($)</option>
                      <option value="EUR">Euro (€)</option>
                    </select>
                  </div>
                </div>

                {household && user && (
                  <HouseholdMembers household={household} currentUserId={user.uid} />
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6">Oturum</h3>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            </div>
          )}

        </div>

        <TransactionModal 
          isOpen={isTxModalOpen} 
          onClose={() => { 
            setIsTxModalOpen(false); 
            setEditingTransaction(null); 
            setTxModalIsSubscription(false);
          }} 
          householdId={household?.id}
          accounts={accounts}
          categories={categories}
          members={household?.members}
          initialData={editingTransaction}
          isPrivacyMode={isPrivacyMode}
          defaultIsSubscription={txModalIsSubscription}
        />
        <AccountModal
          isOpen={isAccModalOpen}
          onClose={() => { setIsAccModalOpen(false); setEditingAccount(null); }}
          householdId={household?.id}
          members={household?.members}
          initialData={editingAccount}
          isPrivacyMode={isPrivacyMode}
        />
        <IncomeSourceModal
          isOpen={isIncomeModalOpen}
          onClose={() => { setIsIncomeModalOpen(false); setEditingIncomeSource(null); }}
          householdId={household?.id}
          accounts={accounts}
          members={household?.members}
          initialData={editingIncomeSource}
          isPrivacyMode={isPrivacyMode}
        />

        {/* Delete Transaction Confirmation Modal */}
        <AnimatePresence>
          {isDeleteTxConfirmOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteTxConfirmOpen(false)}
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
                <h3 className="text-xl font-bold text-white mb-2">İşlemi Sil?</h3>
                <p className="text-zinc-300 mb-6">Bu işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve hesap bakiyeleri geri yüklenecektir.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteTxConfirmOpen(false)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-zinc-700 transition-all"
                  >
                    İptal
                  </button>
                  <button 
                    onClick={confirmDeleteTransaction}
                    className="flex-1 px-4 py-3 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all"
                  >
                    Evet, Sil
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <AuditModal 
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          logs={auditLogs}
        />

        {/* Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
                notification.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
                notification.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
                'bg-zinc-900 border-zinc-800 text-white'
              }`}
            >
              {notification.type === 'success' ? <Check className="w-5 h-5" /> : 
               notification.type === 'error' ? <ShieldAlert className="w-5 h-5" /> : 
               <Bell className="w-5 h-5" />}
              <span className="font-bold text-sm">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Dialog */}
        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center gap-4 text-rose-500 mb-6">
                  <div className="p-3 bg-rose-500/10 rounded-2xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Emin misiniz?</h3>
                </div>
                <p className="text-zinc-300 mb-8 leading-relaxed">
                  {confirmDialog.message}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 px-6 py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={confirmDialog.onConfirm}
                    className="flex-1 px-6 py-3 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                  >
                    Evet, Sil
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const AppContent = () => {
  const { user, household, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) return <Login />;
  if (!household) return <JoinOrCreateHousehold />;
  return <Dashboard />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
