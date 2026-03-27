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
  Download,
  Trash2
} from 'lucide-react';
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
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { formatAmount, parseAmount, cleanAmountInput } from './utils/formatters';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, Timestamp, orderBy, limit, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { useCollection } from './hooks/useFirestore';
import { useExchangeRates } from './hooks/useExchangeRates';
import { useAssetPrices } from './hooks/useAssetPrices';
import { createLedgerTransaction, deleteLedgerTransaction, updateLedgerTransaction, updateAccount, createInstallmentTransactions } from './lib/ledger';
import { Account, Category, Transaction, AccountBranch, AccountSubType, IncomeSource, ExpectedIncome, IncomeFlowType, PlannedExpense } from './types';

import { Dashboard as DashboardView } from './components/Dashboard';
import { Reports } from './components/Reports';
import { SharedBudgets } from './components/SharedBudgets';
import { HouseholdMembers } from './components/HouseholdMembers';
import { PlannedExpenses } from './components/PlannedExpenses';
import { AdminPanel } from './components/AdminPanel';
import { AiAdvisor } from './components/AiAdvisor';

// --- Constants ---

const FLOW_TYPE_OPTIONS = [
  { id: 'fixed', label: 'Sabit (Periyodik)', description: 'Maaş, kira gibi düzenli gelirler' },
  { id: 'variable', label: 'Değişken', description: 'Mesai, prim gibi miktarı değişen gelirler' },
  { id: 'spot', label: 'Spot (Tek Seferlik)', description: 'Satış, hediye, bonus gibi kalemler' },
];

// ... existing constants ...

// --- Components ---

const IncomeSourceModal = ({ isOpen, onClose, householdId, accounts, members, initialData }: any) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [flowType, setFlowType] = useState<IncomeFlowType>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [periodDay, setPeriodDay] = useState('1');
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const sourceData = {
        name,
        ownerId: ownerId || user.uid,
        flowType,
        amount: parseFloat(amount),
        currency,
        targetAccountId,
        periodDay: flowType !== 'spot' ? parseInt(periodDay) : null,
        createdAt: Timestamp.now(),
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
          expectedDate: Timestamp.fromDate(expectedDate),
          status: 'pending',
          targetAccountId,
          createdAt: Timestamp.now(),
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
  banking: ['Garanti BBVA', 'Akbank', 'İş Bankası', 'Yapı Kredi', 'Ziraat Bankası', 'VakıfBank', 'Halkbank', 'QNB Finansbank', 'DenizBank', 'Kuveyt Türk', 'Enpara', 'Papara', 'TEB', 'ING', 'HSBC', 'Odeabank', 'Burgan Bank', 'Alternatif Bank', 'Anadolubank', 'Fibabanka', 'Şekerbank', 'Emlak Katılım', 'Vakıf Katılım', 'Türkiye Finans', 'Albaraka Türk'],
  crypto: ['Binance', 'Paribu', 'BtcTurk', 'OKX', 'KuCoin', 'Coinbase', 'Gate.io', 'Huobi', 'Kraken', 'Bitfinex', 'Mexc'],
  social_gift: ['Sodexo', 'Ticket', 'Multinet', 'Metropol', 'Yemeksepeti', 'İstanbulkart', 'Ankarakart', 'İzmirim Kart', 'Hopi', 'Boyner', 'Migros Money', 'CarrefourSA Kart'],
};

const ASSET_OPTIONS = {
  stock: ['THYAO', 'ASELS', 'EREGL', 'GARAN', 'AKBNK', 'YKBNK', 'ISCTR', 'SISE', 'BIMAS', 'TUPRS', 'KCHOL', 'SAHOL', 'SASA', 'HEKTS', 'FROTO', 'TOASO'],
  crypto: ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'SHIB'],
  fund: ['MAC', 'TCD', 'TKF', 'NNF', 'IPB', 'IIH', 'YAS', 'AFT', 'YAY', 'IPJ']
};

const AccountModal = ({ isOpen, onClose, householdId, members, initialData }: any) => {
  const { user } = useAuth();
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

  const handleQuantityChange = (val: string) => {
    setAssetQuantity(val);
    const q = parseFloat(val);
    const u = parseFloat(assetUnitPrice);
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setAssetTotalCost((q * u).toFixed(2));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setAssetUnitPrice(val);
    const u = parseFloat(val);
    const q = parseFloat(assetQuantity);
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setAssetTotalCost((q * u).toFixed(2));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setAssetTotalCost(val);
    const t = parseFloat(val);
    const u = parseFloat(assetUnitPrice);
    const q = parseFloat(assetQuantity);
    
    if (!isNaN(t) && !isNaN(u) && u > 0) {
      setAssetQuantity((t / u).toFixed(6));
    } else if (!isNaN(t) && !isNaN(q) && q > 0) {
      setAssetUnitPrice((t / q).toFixed(4));
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

    try {
      if (initialData) {
        await updateAccount(householdId, initialData.id, accountData);
      } else {
        const accId = finalName.toLowerCase().replace(/\s+/g, '-');
        await setDoc(doc(db, `households/${householdId}/accounts/${accId}`), {
          ...accountData,
          createdAt: Timestamp.now()
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
                        setAssetType(e.target.value as any);
                        setAssetSymbol('');
                        setCustomAssetSymbol('');
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
                    value={formatAmount(assetQuantity)}
                    onChange={(e) => handleQuantityChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
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
                    value={formatAmount(assetUnitPrice)}
                    onChange={(e) => handleUnitPriceChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Toplam Maliyet ({assetType === 'crypto' ? '$' : '₺'})</label>
                  <input
                    type="text"
                    value={formatAmount(assetTotalCost)}
                    onChange={(e) => handleTotalCostChange(parseAmount(cleanAmountInput(e.target.value)))}
                    placeholder="0,00"
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

const TransactionModal = ({ isOpen, onClose, householdId, accounts, categories, members, initialData }: any) => {
  const { user } = useAuth();
  const { formatWithEquivalent } = useExchangeRates();
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.amount.toString());
        setCurrency(initialData.currency || 'TRY');
        setDescription(initialData.description);
        setDate(initialData.date.toDate().toISOString().split('T')[0]);
        setDebitAccountId(initialData.debitAccountId);
        setCreditAccountId(initialData.creditAccountId);
        setCategoryId(initialData.categoryId);
        setUserId(initialData.userId || user?.uid || '');
        setIsInstallment(initialData.isInstallment || false);
        setInstallmentCount(initialData.installmentCount?.toString() || '2');
        
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
  }, [isOpen, type, accounts, categories, initialData, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !householdId) return;
    setLoading(true);

    try {
      const txData = {
        description,
        amount: parseFloat(amount),
        currency,
        date: Timestamp.fromDate(new Date(date)),
        debitAccountId,
        creditAccountId,
        categoryId: type === 'transfer' ? 'transfer' : categoryId,
        userId: userId || user.uid,
      };

      if (initialData) {
        await updateLedgerTransaction(householdId, initialData.id, txData);
      } else if (isInstallment && type === 'expense') {
        await createInstallmentTransactions(householdId, txData, parseInt(installmentCount));
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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile already exists
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.activeHouseholdId) {
          // User already has a household, just update profile info
          await updateDoc(userRef, {
            fullName: user.displayName || 'Kullanıcı',
            email: user.email || '',
            avatarUrl: user.photoURL || null,
            isAdmin: user.email === 'ersinozbucak@gmail.com',
            updatedAt: Timestamp.now()
          });

          // Also update household members info to ensure email is present
          const householdRef = doc(db, 'households', userData.activeHouseholdId);
          await updateDoc(householdRef, {
            [`members.${user.uid}.email`]: user.email || '',
            [`members.${user.uid}.displayName`]: user.displayName || 'Kullanıcı'
          });
          return;
        }
      }

      // If no household, we'll let them choose in the UI or create a default one
      const householdId = `household-${user.uid}`;
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await setDoc(userRef, {
        fullName: user.displayName || 'Kullanıcı',
        email: user.email || '',
        avatarUrl: user.photoURL || null,
        role: 'adult',
        isAdmin: user.email === 'ersinozbucak@gmail.com',
        kvkkAccepted: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        activeHouseholdId: householdId 
      }, { merge: true });

      const householdRef = doc(db, 'households', householdId);
      await setDoc(householdRef, {
        name: `${user.displayName?.split(' ')[0]} Ailesi`,
        ownerId: user.uid,
        currency: 'TRY',
        joinCode,
        members: {
          [user.uid]: { 
            role: 'owner', 
            type: 'adult',
            salaryVisible: true,
            displayName: user.displayName || 'Kullanıcı',
            email: user.email || ''
          }
        },
        createdAt: Timestamp.now()
      }, { merge: true });

      // Create demo accounts and categories
      const accounts = [
        { name: 'Nakit', type: 'asset', branch: 'banking', institution: 'Nakit', subType: 'liquidity_deposit', balance: 5000, currency: 'TRY', icon: 'wallet', depositDetails: { isTimeDeposit: false } },
        { name: 'Maaş Hesabı', type: 'asset', branch: 'banking', institution: 'Garanti BBVA', subType: 'liquidity_deposit', balance: 25000, currency: 'TRY', icon: 'bank', depositDetails: { isTimeDeposit: false } },
        { name: 'Kredi Kartı', type: 'liability', branch: 'banking', institution: 'Akbank', subType: 'credit_debt', balance: 12000, currency: 'TRY', icon: 'credit-card', isCreditCard: true, creditLimit: 50000, points: [{ name: 'Chip-para', amount: 150 }] },
        { name: 'Binance', type: 'asset', branch: 'crypto', institution: 'Binance', subType: 'global_exchange', balance: 1000, currency: 'USD', icon: 'bitcoin' },
        { name: 'İstanbulkart', type: 'asset', branch: 'social_gift', institution: 'İstanbulkart', subType: 'transport', balance: 200, currency: 'TRY', icon: 'bus' },
        { name: 'Maaş', type: 'income', balance: 0, currency: 'TRY', icon: 'briefcase' },
        { name: 'Market', type: 'expense', balance: 0, currency: 'TRY', icon: 'shopping-cart' },
        { name: 'Kira', type: 'expense', balance: 0, currency: 'TRY', icon: 'home' },
      ];

      for (const acc of accounts) {
        const accId = acc.name.toLowerCase().replace(/\s+/g, '-');
        await setDoc(doc(db, `households/${householdId}/accounts/${accId}`), {
          ...acc,
          createdAt: Timestamp.now()
        }, { merge: true });
      }

    } catch (error: any) {
      console.error('Login Error:', error);
      let message = "Giriş yapılırken bir hata oluştu.";
      if (error.code === 'auth/popup-blocked') {
        message = "Giriş penceresi tarayıcı tarafından engellendi. Lütfen izin verin.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "Bu alan adı Firebase'de yetkilendirilmemiş. Lütfen Firebase Console'u kontrol edin.";
      }
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center"
      >
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">FinansHane</h1>
        <p className="text-zinc-300 mb-8">Ev finansal yönetim sistemine hoş geldiniz. Çift kayıtlı muhasebe ile bütçenizi kontrol altına alın.</p>
        
        {loginError && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-left">{loginError}</p>
          </div>
        )}

        <button 
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className="w-full bg-white text-black font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          )}
          {isLoggingIn ? 'Giriş Yapılıyor...' : 'Google ile Giriş Yap'}
        </button>
      </motion.div>
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
          <p>Verileriniz Google Cloud (Firebase) altyapısında güvenli bir şekilde saklanmakta ve sadece sizin yetkilendirdiğiniz kişiler tarafından erişilebilmektedir.</p>
          
          <h4 className="text-white font-bold">3. Veri Sahibi Hakları</h4>
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
      active 
        ? 'bg-emerald-500/10 text-emerald-500 font-medium' 
        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
    }`}
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
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Add user to household members
      await updateDoc(doc(db, 'households', householdId), {
        [`members.${user.uid}`]: {
          role: 'member',
          type: 'other',
          salaryVisible: true,
          displayName: user.displayName || 'Kullanıcı',
          email: user.email || ''
        }
      });

      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        activeHouseholdId: householdId
      });

    } catch (err: any) {
      console.error('Join error:', err);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
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
      
      await setDoc(doc(db, 'households', householdId), {
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
        createdAt: Timestamp.now()
      }, { merge: true });

      await updateDoc(doc(db, 'users', user.uid), {
        activeHouseholdId: householdId
      });
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
          onClick={() => signOut(auth)}
          className="w-full mt-6 text-zinc-400 text-sm hover:text-white transition-colors"
        >
          Çıkış Yap
        </button>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { user, profile, household } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncomeSource, setEditingIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleteTxConfirmOpen, setIsDeleteTxConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [isKVKKModalOpen, setIsKVKKModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

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
        kvkkAcceptedAt: Timestamp.now()
      });
      setIsKVKKModalOpen(false);
    } catch (error) {
      console.error('KVKK accept error:', error);
    }
  };

  const handleExportData = () => {
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

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDeleteAllData = async () => {
    if (!user || !household) return;
    setConfirmDialog({
      message: 'Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          // Delete all related data
          const collectionsToDelete = ['accounts', 'transactions', 'incomeSources', 'expectedIncomes', 'plannedExpenses'];
          for (const coll of collectionsToDelete) {
            const q = query(collection(db, `households/${household.id}/${coll}`));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await deleteDoc(d.ref);
            }
          }
          
          // If owner, delete household
          if (household.ownerId === user.uid) {
            await deleteDoc(doc(db, 'households', household.id));
            await updateDoc(doc(db, 'users', user.uid), { activeHouseholdId: null });
          } else {
            // Just remove from members
            const updates: any = {};
            updates[`members.${user.uid}`] = null;
            await updateDoc(doc(db, 'households', household.id), updates);
            await updateDoc(doc(db, 'users', user.uid), { activeHouseholdId: null });
          }

          showNotification('Tüm veriler başarıyla silindi.', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
          console.error('Delete data error:', error);
          showNotification('Veriler silinirken bir hata oluştu.', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Sync owner profile info and generate joinCode if missing
  useEffect(() => {
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
        updateDoc(householdRef, updates);
      }
    }
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

  const { formatWithEquivalent, convertToTRY } = useExchangeRates();

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
      const txDate = tx.date.toDate();
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
      const txDate = tx.date.toDate();
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
        .filter(tx => tx.categoryId === cat.id && tx.date.toDate().getMonth() === currentMonth)
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
    const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const dayIncome = transactions
      .filter(tx => {
        const txDate = tx.date.toDate();
        const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
        const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
        return txDate.toDateString() === date.toDateString() &&
               debitAcc?.type === 'asset' && 
               creditAcc?.type === 'income';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const dayExpense = transactions
      .filter(tx => {
        const txDate = tx.date.toDate();
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
          createdAt: Timestamp.now()
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
        date: Timestamp.now(),
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
        const nextDate = expected.expectedDate.toDate();
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        await setDoc(doc(collection(db, `households/${household.id}/expectedIncomes`)), {
          sourceId: source.id,
          sourceName: source.name,
          amount: source.amount,
          currency: source.currency,
          expectedDate: Timestamp.fromDate(nextDate),
          status: 'pending',
          targetAccountId: source.targetAccountId,
          createdAt: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error('Approve income error:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <IncomeSourceModal 
        isOpen={isIncomeModalOpen} 
        onClose={() => { setIsIncomeModalOpen(false); setEditingIncomeSource(null); }}
        householdId={household?.id}
        accounts={allAccounts}
        initialData={editingIncomeSource}
      />
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FinansHane</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Genel Bakış" 
            active={activeTab === 'overview'} 
            onClick={() => handleTabChange('overview')} 
          />
          <SidebarItem 
            icon={ArrowRightLeft} 
            label="İşlemler" 
            active={activeTab === 'transactions'} 
            onClick={() => handleTabChange('transactions')} 
          />
          <SidebarItem 
            icon={CreditCard} 
            label="Hesaplar" 
            active={activeTab === 'accounts'} 
            onClick={() => handleTabChange('accounts')} 
          />
          <SidebarItem 
            icon={Target} 
            label="Bütçeler" 
            active={activeTab === 'budgets'} 
            onClick={() => handleTabChange('budgets')} 
          />
          <SidebarItem 
            icon={Briefcase} 
            label="Gelir Yönetimi" 
            active={activeTab === 'income'} 
            onClick={() => handleTabChange('income')} 
          />
          <SidebarItem 
            icon={PieChart} 
            label="Raporlar" 
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
              icon={ShieldAlert} 
              label="Yönetim Paneli" 
              active={activeTab === 'admin'} 
              onClick={() => handleTabChange('admin')} 
            />
          )}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <SidebarItem 
            icon={Settings} 
            label="Ayarlar" 
            active={activeTab === 'settings'} 
            onClick={() => handleTabChange('settings')} 
          />
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all mt-2"
          >
            <LogOut className="w-5 h-5" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-20 border-b border-zinc-800 px-4 lg:px-8 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg lg:text-xl font-semibold">
              {activeTab === 'overview' ? 'Genel Bakış' : 
               activeTab === 'transactions' ? 'İşlemler' : 
               activeTab === 'accounts' ? 'Hesaplar' : 
               activeTab === 'budgets' ? 'Bütçeler' :
               activeTab === 'income' ? 'Gelir Yönetimi' :
               activeTab === 'reports' ? 'Raporlar' :
               activeTab === 'groups' ? 'Gruplar' :
               activeTab === 'admin' ? 'Yönetim Paneli' :
               activeTab === 'settings' ? 'Ayarlar' : 'Panel'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
              <div className="relative hidden xl:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input 
                  type="text" 
                  placeholder="Ara..." 
                  className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-64 text-white"
                />
              </div>
              <button className="p-2 text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-950"></span>
              </button>
            <div className="h-8 w-px bg-zinc-800 mx-2"></div>
            <button 
              onClick={() => activeTab === 'accounts' ? setIsAccModalOpen(true) : setIsTxModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'accounts' ? 'Yeni Hesap' : 'Yeni İşlem'}</span>
            </button>
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
                  date: Timestamp.now(),
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
                  date: Timestamp.now(),
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

          {activeTab === 'transactions' && (
            <div className="space-y-8">
              {/* Installment Summary Section */}
              {transactions.some(t => t.isInstallment && t.date.toDate() > new Date()) && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    Gelecek Taksitler
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {transactions
                      .filter(t => t.isInstallment && t.date.toDate() > new Date())
                      .sort((a, b) => a.date.toMillis() - b.date.toMillis())
                      .slice(0, 6)
                      .map(tx => (
                        <div key={tx.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl hover:border-blue-500/30 transition-all group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase tracking-wider">
                              {tx.installmentNumber}/{tx.installmentCount} Taksit
                            </span>
                            <span className="text-xs text-zinc-300">{tx.date.toDate().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span>
                          </div>
                          <h4 className="text-sm font-medium text-white truncate">{tx.description}</h4>
                          <div className="flex justify-between items-end mt-3">
                            <span className="text-xs text-zinc-400">{accounts.find(a => a.id === tx.creditAccountId)?.name || 'Hesap'}</span>
                            <span className="text-sm font-bold text-rose-500">{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">İşlem Geçmişi</h3>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">İşlemi Yapan</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Açıklama</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Kategori</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Hesap</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {transactions.map(tx => {
                      const category = categories.find(c => c.id === tx.categoryId);
                      const debitAcc = accounts.find(a => a.id === tx.debitAccountId);
                      const creditAcc = accounts.find(a => a.id === tx.creditAccountId);
                      const isExpense = !!debitAcc && !creditAcc;
                      const isIncome = !debitAcc && !!creditAcc;
                      const member = household?.members?.[tx.userId];
                      
                      return (
                        <tr key={tx.id} className="group hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => { setEditingTransaction(tx); setIsTxModalOpen(true); }}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-zinc-300">{tx.date.toDate().toLocaleDateString('tr-TR')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                member?.type === 'child' ? 'bg-purple-500/20 text-purple-500' : 
                                member?.type === 'elderly' ? 'bg-rose-500/20 text-rose-500' :
                                member?.type === 'adult' ? 'bg-blue-500/20 text-blue-500' :
                                'bg-emerald-500/20 text-emerald-500'
                              }`}>
                                {member?.displayName?.charAt(0) || '?'}
                              </div>
                              <span className="text-sm text-zinc-300">{member?.displayName || 'Bilinmiyor'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className="text-sm font-medium text-white">{tx.description}</div>
                              {tx.isInstallment && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase tracking-wider">
                                    Taksit {tx.installmentNumber}/{tx.installmentCount}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300">
                              <Tag className="w-3 h-3" />
                              {category?.name || 'Diğer'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-zinc-300">
                              {(() => {
                                const getAccName = (acc: any) => acc?.institution ? `${acc.institution} — ${acc.name}` : acc?.name;
                                if (isExpense) return getAccName(debitAcc);
                                if (isIncome) return getAccName(creditAcc);
                                return `${getAccName(debitAcc)} → ${getAccName(creditAcc)}`;
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className={`text-sm font-bold ${isExpense ? 'text-rose-500' : isIncome ? 'text-emerald-500' : 'text-blue-500'}`}>
                              {isExpense ? '-' : isIncome ? '+' : ''}{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-300">
                          Henüz işlem bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-12">
              {BRANCH_OPTIONS.map(branch => {
                const branchAccounts = accounts.filter(acc => acc.branch === branch.id);
                if (branchAccounts.length === 0) return null;

                return (
                  <div key={branch.id} className="space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-xl">
                          <branch.icon className={`w-6 h-6 ${branch.color}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{branch.label}</h3>
                          <p className="text-zinc-300 text-sm">
                            Toplam: {formatWithEquivalent(branchAccounts.reduce((sum, a) => {
                              let balance = a.balance;
                              if (a.assetDetails && assetPrices[a.assetDetails.symbol]) {
                                balance = a.assetDetails.quantity * assetPrices[a.assetDetails.symbol].price;
                              }
                              const amountInTRY = convertToTRY(balance, a.currency || 'TRY');
                              return sum + (a.type === 'asset' ? amountInTRY : -amountInTRY);
                            }, 0), 'TRY')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {branchAccounts.map((acc) => (
                        <div key={acc.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-zinc-700 transition-all">
                          <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${acc.type === 'asset' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <div className="flex justify-between items-start mb-6">
                            <div className={`p-3 rounded-2xl ${acc.type === 'asset' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {acc.subType === 'credit_debt' ? <CreditCard className="w-6 h-6" /> :
                               acc.subType === 'investment' ? <TrendingUp className="w-6 h-6" /> :
                               acc.branch === 'crypto' ? <Bitcoin className="w-6 h-6" /> :
                               acc.subType === 'transport' ? <Bus className="w-6 h-6" /> :
                               acc.subType === 'food' ? <Smartphone className="w-6 h-6" /> :
                               <Wallet className="w-6 h-6" />}
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => { setEditingAccount(acc); setIsAccModalOpen(true); }}
                                className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${acc.type === 'asset' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {acc.subType === 'liquidity_deposit' && acc.depositDetails 
                                  ? (acc.depositDetails.isTimeDeposit ? 'Vadeli Mevduat' : 'Vadesiz Mevduat')
                                  : (SUBTYPE_OPTIONS[acc.branch || 'banking'].find(s => s.id === acc.subType)?.label || acc.type)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            {acc.institution && (
                              <span className="text-[10px] text-zinc-300 uppercase tracking-widest font-bold mb-0.5">{acc.institution}</span>
                            )}
                            <h3 className="text-lg font-bold mb-1">{acc.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                              household?.members?.[acc.ownerId]?.type === 'child' ? 'bg-purple-500/20 text-purple-500' : 
                              household?.members?.[acc.ownerId]?.type === 'elderly' ? 'bg-rose-500/20 text-rose-500' :
                              household?.members?.[acc.ownerId]?.type === 'adult' ? 'bg-blue-500/20 text-blue-500' :
                              'bg-emerald-500/20 text-emerald-500'
                            }`}>
                              {household?.members?.[acc.ownerId]?.displayName?.charAt(0) || '?'}
                            </div>
                            <span className="text-xs text-zinc-300">{household?.members?.[acc.ownerId]?.displayName || 'Bilinmiyor'}</span>
                            <span className="text-zinc-700">•</span>
                            <span className="text-xs text-zinc-300">{acc.currency}</span>
                          </div>
                          
                          {acc.depositDetails && acc.depositDetails.isTimeDeposit && (
                            <div className="mb-4 text-xs space-y-1 bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                              <div className="flex justify-between text-zinc-300">
                                <span>Faiz Oranı:</span>
                                <span className="text-emerald-400 font-medium">%{(acc.depositDetails.interestRate || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-zinc-300">
                                <span>Vade:</span>
                                <span className="text-zinc-300">
                                  {acc.depositDetails.period === 'daily' ? 'Günlük' : acc.depositDetails.period === 'monthly' ? 'Aylık' : 'Yıllık'}
                                </span>
                              </div>
                              {acc.depositDetails.maturityDate && (
                                <div className="flex justify-between text-zinc-300">
                                  <span>Vade Sonu:</span>
                                  <span className="text-zinc-300">{new Date(acc.depositDetails.maturityDate).toLocaleDateString('tr-TR')}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {acc.assetDetails ? (
                            <div className="space-y-2">
                              {assetPrices[acc.assetDetails.symbol] ? (
                                <>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold">
                                      {formatWithEquivalent(acc.assetDetails.quantity * assetPrices[acc.assetDetails.symbol].price, acc.currency || 'TRY')}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-300">Güncel Fiyat:</span>
                                    <span className="font-medium">{assetPrices[acc.assetDetails.symbol].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {assetPrices[acc.assetDetails.symbol].currency}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-300">Maliyet:</span>
                                    <span className="font-medium">{acc.assetDetails.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {acc.currency}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-800">
                                    <span className="text-zinc-300">Kar/Zarar:</span>
                                    <div className="flex flex-col items-end">
                                      {(() => {
                                        const currentTotal = acc.assetDetails.quantity * assetPrices[acc.assetDetails.symbol].price;
                                        const costTotal = acc.assetDetails.quantity * acc.assetDetails.purchasePrice;
                                        // If currencies match, we can calculate directly. If not, we should convert.
                                        // For simplicity, assuming purchasePrice and currentPrice are in the same currency (e.g. USD for crypto, TRY for stocks)
                                        const pl = currentTotal - costTotal;
                                        const plPercent = (pl / costTotal) * 100;
                                        const isProfit = pl >= 0;
                                        return (
                                          <>
                                            <span className={`font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                              {isProfit ? '+' : ''}{pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {assetPrices[acc.assetDetails.symbol].currency}
                                            </span>
                                            <span className={`text-xs ${isProfit ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                              {isProfit ? '+' : ''}{plPercent.toFixed(2)}%
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold">{formatWithEquivalent(acc.balance, acc.currency || 'TRY')}</span>
                                  </div>
                                  <div className="text-xs text-zinc-300 animate-pulse">Güncel fiyat bekleniyor...</div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold">{formatWithEquivalent(acc.balance, acc.currency || 'TRY')}</span>
                            </div>
                          )}
                          
                          {acc.points && acc.points.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                              {acc.points.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                  <span className="text-zinc-300">{p.name}</span>
                                  <span className="font-medium text-emerald-500">{p.amount.toLocaleString()} Puan</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              <div className="pt-8">
                <button 
                  onClick={() => { setEditingAccount(null); setIsAccModalOpen(true); }}
                  className="w-full border-2 border-dashed border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-500 transition-all group bg-zinc-900/30"
                >
                  <div className="p-4 bg-zinc-900 rounded-2xl group-hover:bg-emerald-500/10 transition-all">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-lg">Yeni Hesap Ekle</span>
                    <p className="text-sm">Bankacılık, Kripto veya Sosyal Kart ekleyin</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="p-8 max-w-7xl mx-auto">
              <PlannedExpenses 
                householdId={household?.id} 
                categories={categories}
                accounts={accounts}
                members={household?.members}
              />
            </div>
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
                <h3 className="text-xl font-bold mb-6">KVKK ve Veri Yönetimi</h3>
                <div className="space-y-4">
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
                      <p className="text-xs text-zinc-300">Tüm verileriniz kalıcı olarak silinecektir.</p>
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
                  onClick={() => signOut(auth)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'income' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Gelir Yönetimi</h1>
                <p className="text-zinc-300">Gelir kaynaklarını ve beklenen girişleri yönetin.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingIncomeSource(null);
                  setIsIncomeModalOpen(true);
                }}
                className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> Yeni Kaynak
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Income Sources List */}
              <div className="lg:col-span-1 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-500" /> Gelir Kaynakları
                </h2>
                <div className="space-y-3">
                  {incomeSources.map(source => (
                    <div key={source.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          source.flowType === 'fixed' ? 'bg-blue-500/10 text-blue-500' :
                          source.flowType === 'variable' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-purple-500/10 text-purple-500'
                        }`}>
                          {source.flowType === 'fixed' ? 'Sabit' : source.flowType === 'variable' ? 'Değişken' : 'Spot'}
                        </span>
                        <button 
                          onClick={() => {
                            setEditingIncomeSource(source);
                            setIsIncomeModalOpen(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/5 rounded-lg transition-all"
                        >
                          <Settings className="w-4 h-4 text-zinc-300" />
                        </button>
                      </div>
                      <h3 className="text-white font-medium">{source.name}</h3>
                      <div className="flex items-end justify-between mt-2">
                        <div className="text-xs text-zinc-300">
                          {source.flowType !== 'spot' && `Her ayın ${source.periodDay}. günü`}
                        </div>
                        <div className="text-lg font-bold text-white">
                          {formatWithEquivalent(source.amount, source.currency || 'TRY')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {incomeSources.length === 0 && (
                    <div className="text-center py-8 bg-zinc-900/50 border border-dashed border-white/5 rounded-2xl">
                      <p className="text-zinc-300 text-sm">Henüz gelir kaynağı eklenmemiş.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expected Incomes List */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" /> Beklenen Girişler
                </h2>
                <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Tarih</th>
                          <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Kaynak</th>
                          <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Miktar</th>
                          <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider">Durum</th>
                          <th className="px-6 py-4 text-xs font-bold text-zinc-300 uppercase tracking-wider text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {expectedIncomes.map(expected => (
                          <tr key={expected.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-white font-medium">
                                {expected.expectedDate.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-zinc-300">{expected.sourceName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-white">
                                {formatWithEquivalent(expected.amount, expected.currency || 'TRY')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                expected.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                expected.status === 'realized' ? 'bg-emerald-500/10 text-emerald-500' :
                                'bg-rose-500/10 text-rose-500'
                              }`}>
                                {expected.status === 'pending' ? 'Bekliyor' : expected.status === 'realized' ? 'Gerçekleşti' : 'İptal'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              {expected.status === 'pending' && (
                                <button 
                                  onClick={() => handleApproveIncome(expected)}
                                  className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                >
                                  Onayla
                                </button>
                              )}
                              {expected.status === 'realized' && (
                                <div className="flex items-center justify-end gap-1 text-emerald-500">
                                  <Check className="w-4 h-4" />
                                  <span className="text-[10px] font-bold uppercase">Tamamlandı</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {expectedIncomes.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-zinc-300">
                              Bekleyen gelir girişi bulunmuyor.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <IncomeSourceModal 
              isOpen={isIncomeModalOpen}
              onClose={() => setIsIncomeModalOpen(false)}
              householdId={household?.id}
              accounts={accounts}
              members={household?.members}
              initialData={editingIncomeSource}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="p-8 max-w-7xl mx-auto">
            <Reports 
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              members={household?.members}
              formatWithEquivalent={formatWithEquivalent}
              convertToTRY={convertToTRY}
            />
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="p-8 max-w-7xl mx-auto">
            <SharedBudgets 
              householdId={household?.id} 
              showNotification={showNotification}
            />
          </div>
        )}

        {activeTab === 'admin' && profile?.isAdmin && (
          <AdminPanel currentUserEmail={user?.email || ''} />
        )}
        </div>

        <TransactionModal 
          isOpen={isTxModalOpen} 
          onClose={() => { setIsTxModalOpen(false); setEditingTransaction(null); }} 
          householdId={household?.id}
          accounts={accounts}
          categories={categories}
          members={household?.members}
          initialData={editingTransaction}
        />
        <AccountModal
          isOpen={isAccModalOpen}
          onClose={() => { setIsAccModalOpen(false); setEditingAccount(null); }}
          householdId={household?.id}
          members={household?.members}
          initialData={editingAccount}
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
