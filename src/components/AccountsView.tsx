import React, { useState, useMemo } from 'react';
import { 
  Wallet, Building2, Bitcoin, Gift, RefreshCw, 
  Plus, Search, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Settings2, Eye, EyeOff, TrendingUp, TrendingDown,
  LayoutGrid, List as ListIcon, Trash2, Pencil, X, ArrowUpRight, ArrowDownLeft,
  Filter, Tag, Calendar, CreditCard, Layers, ArrowDown, ArrowUp, ArrowUpDown, User,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, Transaction } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { syncAccountWithApi } from '../lib/apiIntegrations';
import { deleteLedgerTransaction, getCreditCardFutureDebt } from '../lib/ledger';
import { ConfirmModal } from './ConfirmModal';
import { StatementImportModal } from './StatementImportModal';

interface AccountsViewProps {
  householdId: string;
  accounts: Account[];
  assetPrices: Record<string, { price: number; changePercent: number }>;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount?: (accountId: string) => Promise<void> | void;
  transactions?: Transaction[];
  categories?: Account[];
  onEditTransaction?: (tx: Transaction) => void;
  isPrivacyMode?: boolean;
  members?: Record<string, any>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  householdId,
  accounts,
  assetPrices,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  transactions = [],
  categories = [],
  onEditTransaction,
  isPrivacyMode = false,
  members = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'institution' | 'type' | 'branch'>('none');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [toggledAccounts, setToggledAccounts] = useState<Set<string>>(new Set());

  // Detail Modal & Account Deletion State
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState<Account | null>(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetAccountId, setImportTargetAccountId] = useState<string>('');
  const [accTxFilter, setAccTxFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [accTxSearch, setAccTxSearch] = useState('');
  const [accTxSortField, setAccTxSortField] = useState<'date' | 'description' | 'category' | 'amount'>('date');
  const [accTxSortOrder, setAccTxSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isDeleting, setIsDeleting] = useState(false);

  const getOwnerDisplayName = (ownerId?: string) => {
    if (!ownerId) return 'Hane Geneli';
    if (members && members[ownerId]) {
      return members[ownerId].displayName || members[ownerId].name || 'Hane Üyesi';
    }
    return 'Hane Üyesi';
  };

  const toggleAccTxSort = (field: 'date' | 'description' | 'category' | 'amount') => {
    if (accTxSortField === field) {
      setAccTxSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setAccTxSortField(field);
      setAccTxSortOrder(field === 'description' || field === 'category' ? 'asc' : 'desc');
    }
  };

  const { formatWithEquivalent } = useExchangeRates(isPrivacyMode);

  const toggleLocalPrivacy = (accountId: string) => {
    setToggledAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const isAccountHidden = (accountId: string) => {
    return isPrivacyMode ? !toggledAccounts.has(accountId) : toggledAccounts.has(accountId);
  };

  const calculateAccruedInterest = (account: Account) => {
    if (!account.depositDetails?.isTimeDeposit || !account.depositDetails.interestRate) return 0;
    
    const startDate = account.depositDetails.startDate ? new Date(account.depositDetails.startDate) : new Date(account.createdAt);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - startDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const rate = account.depositDetails.interestRate / 100;
    let accrued = 0;

    switch (account.depositDetails.period) {
      case 'daily':
        accrued = account.balance * rate * diffDays;
        break;
      case 'monthly':
      case 'yearly':
      default:
        accrued = (account.balance * rate * diffDays) / 365;
        break;
    }
    
    return accrued;
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = 
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.institution?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOwner = ownerFilter === 'all' || acc.ownerId === ownerFilter;
    return matchesSearch && matchesOwner;
  });

  const groupedAccounts = useMemo<Record<string, Account[]>>(() => {
    if (groupBy === 'none') return { 'Tüm Hesaplar': filteredAccounts };

    const groups: Record<string, Account[]> = {};
    filteredAccounts.forEach(acc => {
      let key = 'Diğer';
      if (groupBy === 'institution') {
        key = acc.institution || 'Kurum Belirtilmemiş';
      } else if (groupBy === 'type') {
        if (acc.assetDetails?.assetType) {
          const typeMap: any = { stock: 'Hisse Senetleri', crypto: 'Kripto Varlıklar', fund: 'Yatırım Fonları' };
          key = typeMap[acc.assetDetails.assetType] || 'Diğer Yatırımlar';
        } else {
          const subTypeMap: any = { 
            liquidity_deposit: 'Vadesiz/Mevduat', 
            investment: 'Yatırım', 
            bes: 'BES (Bireysel Emeklilik)',
            oks: 'OKS (Otomatik Katılım)',
            credit_debt: 'Alacaklar',
            credit_card: 'Kredi Kartları',
            transport: 'Ulaşım Kartları',
            food: 'Yemek Kartları',
            corporate_gift: 'Kurumsal Hediyeler',
            cash: 'Nakit Para',
            personal_debt: 'Kişisel Borçlar',
            personal_loan: 'Kişisel Alacaklar'
          };
          key = subTypeMap[acc.subType] || 'Diğer';
        }
      } else if (groupBy === 'branch') {
        const branchMap: any = { banking: 'Bankacılık', pension: 'BES & OKS Emeklilik', crypto: 'Kripto', social_gift: 'Sosyal/Yan Haklar', personal: 'Kişisel ve Nakit' };
        key = branchMap[acc.branch] || 'Diğer';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    });

    return groups;
  }, [filteredAccounts, groupBy]);

  const handleSync = async (account: Account) => {
    if (!account.apiConfig) return;
    
    setSyncingIds(prev => new Set(prev).add(account.id));
    try {
      const result = await syncAccountWithApi(householdId, account);
      if (result.error) {
        setSyncResults(prev => ({ ...prev, [account.id]: { success: false, message: result.error! } }));
      } else {
        setSyncResults(prev => ({ ...prev, [account.id]: { success: true, message: 'Senkronizasyon başarılı' } }));
      }
    } catch (error) {
      setSyncResults(prev => ({ ...prev, [account.id]: { success: false, message: 'Beklenmedik bir hata oluştu' } }));
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
      setTimeout(() => {
        setSyncResults(prev => {
          const next = { ...prev };
          delete next[account.id];
          return next;
        });
      }, 3000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAccount || !onDeleteAccount) return;
    setIsDeleting(true);
    try {
      await onDeleteAccount(deleteConfirmAccount.id);
      if (selectedAccount?.id === deleteConfirmAccount.id) {
        setSelectedAccount(null);
      }
      setDeleteConfirmAccount(null);
    } catch (err) {
      console.error("Account delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getBranchIcon = (branch: string) => {
    switch (branch) {
      case 'banking': return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'crypto': return <Bitcoin className="w-5 h-5 text-orange-500" />;
      case 'social_gift': return <Gift className="w-5 h-5 text-purple-500" />;
      case 'personal': return <Wallet className="w-5 h-5 text-emerald-500" />;
      default: return <Wallet className="w-5 h-5 text-zinc-400" />;
    }
  };

  // Transactions specific to selectedAccount
  const selectedAccountTxs = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions.filter(tx => 
      tx.debitAccountId === selectedAccount.id ||
      tx.creditAccountId === selectedAccount.id ||
      tx.categoryId === selectedAccount.id
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedAccount, transactions]);

  // Helper to determine if transaction is incoming (+) or outgoing (-) for an account
  const getTxDirection = (tx: Transaction, account: Account) => {
    const isAsset = account.type === 'asset' || account.subType === 'cash' || account.subType === 'liquidity_deposit' || account.subType === 'investment';
    const isLiability = account.subType === 'credit_card' || account.type === 'liability';

    if (isAsset) {
      if (tx.debitAccountId === account.id) {
        return 'incoming';
      }
      return 'outgoing';
    } else if (isLiability) {
      if (tx.creditAccountId === account.id) {
        return 'outgoing'; // Spend on credit card
      }
      return 'incoming'; // Payment towards credit card
    } else {
      if (tx.debitAccountId === account.id) return 'incoming';
      return 'outgoing';
    }
  };

  const filteredAccountTxs = useMemo(() => {
    if (!selectedAccount) return [];
    const list = selectedAccountTxs.filter(tx => {
      const dir = getTxDirection(tx, selectedAccount);
      if (accTxFilter === 'incoming' && dir !== 'incoming') return false;
      if (accTxFilter === 'outgoing' && dir !== 'outgoing') return false;

      if (accTxSearch) {
        const q = accTxSearch.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q);
        return matchDesc || matchAmount;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      let diff = 0;
      if (accTxSortField === 'date') {
        const getTime = (d: any) => {
          if (!d) return 0;
          if (d instanceof Date) return d.getTime();
          if (typeof d === 'number') return d;
          if (d?.seconds) return d.seconds * 1000;
          const parsed = new Date(d).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        diff = getTime(a.date) - getTime(b.date);
      } else if (accTxSortField === 'description') {
        diff = (a.description || '').localeCompare(b.description || '', 'tr');
      } else if (accTxSortField === 'category') {
        const dirA = getTxDirection(a, selectedAccount);
        const nameA = getCounterpartName(a, selectedAccount, dirA);
        const dirB = getTxDirection(b, selectedAccount);
        const nameB = getCounterpartName(b, selectedAccount, dirB);
        diff = nameA.localeCompare(nameB, 'tr');
      } else if (accTxSortField === 'amount') {
        diff = a.amount - b.amount;
      }
      return accTxSortOrder === 'asc' ? diff : -diff;
    });
  }, [selectedAccountTxs, selectedAccount, accTxFilter, accTxSearch, accTxSortField, accTxSortOrder, categories, accounts]);

  const accTxStats = useMemo(() => {
    if (!selectedAccount) return { totalIncoming: 0, totalOutgoing: 0, count: 0 };
    let totalIncoming = 0;
    let totalOutgoing = 0;

    selectedAccountTxs.forEach(tx => {
      const dir = getTxDirection(tx, selectedAccount);
      if (dir === 'incoming') {
        totalIncoming += tx.amount;
      } else {
        totalOutgoing += tx.amount;
      }
    });

    return {
      totalIncoming,
      totalOutgoing,
      count: selectedAccountTxs.length
    };
  }, [selectedAccountTxs, selectedAccount]);

  const getCounterpartName = (tx: Transaction, account: Account, dir: 'incoming' | 'outgoing') => {
    let counterpartId = '';
    if (dir === 'incoming') {
      counterpartId = tx.creditAccountId || tx.categoryId || '';
    } else {
      counterpartId = tx.debitAccountId || tx.categoryId || '';
    }

    if (!counterpartId || counterpartId === account.id) {
      return dir === 'incoming' ? 'Gelir / Transfer' : 'Gider / Transfer';
    }

    const foundCategory = categories.find(c => c.id === counterpartId);
    if (foundCategory) return foundCategory.name;

    const foundAccount = accounts.find(a => a.id === counterpartId);
    if (foundAccount) return foundAccount.name;

    return dir === 'incoming' ? 'Gelir' : 'Gider';
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Hesaplarım</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Tüm banka, nakit, kredi kartı ve yatırım hesaplarınızın detayları</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'grid' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Kutu</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                viewMode === 'list' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListIcon className="w-4 h-4" />
              <span>Liste</span>
            </button>
          </div>

          {members && Object.keys(members).length > 0 && (
            <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border">
              <User className="w-3.5 h-3.5 text-amber-400 ml-1" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sahip:</span>
              <select 
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold uppercase tracking-wide focus:ring-0 cursor-pointer pr-8 text-foreground"
              >
                <option value="all">Tüm Üyeler</option>
                {Object.entries(members).map(([id, m]) => (
                  <option key={id} value={id}>
                    {m.displayName || m.name || 'Üye'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Grupla:</span>
            <select 
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-transparent border-none text-xs font-bold uppercase tracking-wide focus:ring-0 cursor-pointer pr-8"
            >
              <option value="none">Yok</option>
              <option value="institution">Kurum</option>
              <option value="type">Tür</option>
              <option value="branch">Branş</option>
            </select>
          </div>

          <button 
            onClick={() => {
              setImportTargetAccountId(accounts[0]?.id || '');
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-emerald-500/20 active:scale-[0.98] transition-all"
            title="Garanti BBVA, Akbank, İş Bankası vb. bankalardan indirdiğiniz ekstre/CSV dosyasını yükleyin"
          >
            <UploadCloud className="w-4 h-4" />
            Ekstre / Döküm Yükle
          </button>

          <button 
            onClick={onAddAccount}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Yeni Hesap Ekle
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-secondary/50 rounded-lg flex items-center justify-center border border-border/50 group-focus-within:border-primary/30 transition-all duration-500 shadow-sm">
          <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input 
          type="text"
          placeholder="Hesap veya kurum ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900/30 border border-border/50 rounded-xl pl-14 pr-6 py-3 focus:outline-none focus:ring-2 focus:ring-primary/10 text-foreground transition-all shadow-sm focus:shadow-xl focus:bg-zinc-900/50 text-sm font-black tracking-tight placeholder:text-muted-foreground/30"
        />
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map(account => (
            <motion.div 
              key={account.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedAccount(account)}
              className="group corporate-card overflow-hidden relative border border-border/30 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 cursor-pointer transition-all duration-500"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
              
              <div className="p-8 space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-secondary/50 rounded-2xl flex items-center justify-center border border-border/50 shadow-sm group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/10 transition-all duration-500">
                      {getBranchIcon(account.branch || '')}
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors tracking-tighter leading-tight">{account.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">{account.institution || 'Diğer Kurum'}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                          <User className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{getOwnerDisplayName(account.ownerId)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {account.apiConfig && (
                      <button 
                        onClick={() => handleSync(account)}
                        disabled={syncingIds.has(account.id)}
                        className={`p-2 rounded-xl transition-all duration-500 ${
                          syncingIds.has(account.id) 
                            ? 'bg-emerald-500/20 text-emerald-500 animate-spin' 
                            : 'bg-secondary/50 text-muted-foreground hover:text-emerald-500 border border-border/50 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                        }`}
                        title="API ile Senkronize Et"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleLocalPrivacy(account.id)}
                      className={`p-2 border border-border/50 rounded-xl transition-all duration-500 ${
                        isAccountHidden(account.id)
                          ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                      title={isAccountHidden(account.id) ? 'Göster' : 'Gizle'}
                    >
                      {isAccountHidden(account.id) ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => onEditAccount(account)}
                      className="p-2 bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/50 rounded-xl transition-all duration-500 hover:bg-secondary"
                      title="Düzenle"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteAccount && (
                      <button 
                        onClick={() => setDeleteConfirmAccount(account)}
                        className="p-2 bg-rose-500/10 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-xl transition-all duration-500 hover:bg-rose-500/20"
                        title="Hesabı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border/30">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-black mb-2 opacity-60">
                        {account.subType === 'credit_card' ? 'Güncel Borç' : account.type === 'asset' && account.assetDetails ? 'Toplam Maliyet' : 'Güncel Bakiye'}
                      </p>
                      <p className={`text-3xl font-black tracking-tighter ${account.subType === 'credit_card' ? 'text-rose-500' : 'text-foreground'}`}>
                        {formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}
                      </p>
                    </div>
                    {account.type === 'asset' && account.assetDetails && assetPrices[account.assetDetails.symbol] && (
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-black mb-2 opacity-60">Güncel Değer</p>
                        <p className="text-xl font-black text-emerald-500 tracking-tighter">
                          {formatWithEquivalent(account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price, account.currency || 'TRY', isAccountHidden(account.id))}
                        </p>
                      </div>
                    )}
                    {account.depositDetails?.isTimeDeposit && (
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-black mb-2 opacity-60">Tahmini Bakiye</p>
                        <p className="text-xl font-black text-emerald-500 tracking-tighter">
                          {formatWithEquivalent(account.balance + calculateAccruedInterest(account), account.currency || 'TRY', isAccountHidden(account.id))}
                        </p>
                      </div>
                    )}
                  </div>

                  {account.subType === 'credit_card' && (() => {
                    const futureDebt = getCreditCardFutureDebt(account, transactions);
                    const totalUsedLimit = account.balance + Math.max(0, futureDebt);
                    const remainingLimit = (account.creditLimit || 0) - totalUsedLimit;
                    const usagePercentage = Math.min(100, Math.max(0, (totalUsedLimit / (account.creditLimit || 1)) * 100));

                    return (
                      <div className="mt-4 p-3 bg-zinc-950/40 rounded-2xl border border-border/50 space-y-2">
                        {futureDebt > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-zinc-400">
                            <span>Gelecek Taksitler:</span>
                            <span className="font-bold text-amber-400">
                              {formatWithEquivalent(futureDebt, account.currency || 'TRY', isAccountHidden(account.id))}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400 font-medium">Kullanılabilir Limit:</span>
                          <span className={`font-extrabold ${remainingLimit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {formatWithEquivalent(remainingLimit, account.currency || 'TRY', isAccountHidden(account.id))}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-rose-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${usagePercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {(account.subType === 'bes' || account.subType === 'oks' || account.besDetails) && (() => {
                    const besStateBal = account.besDetails?.stateContributionBalance ?? (account.balance * ((account.besDetails?.stateContributionRate ?? 30) / 100));
                    const totalBesVal = account.balance + besStateBal;
                    const monthlyCont = account.besDetails?.monthlyContribution || 0;

                    return (
                      <div className="mt-4 p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-2">
                        <div className="flex justify-between items-center text-[11px] text-zinc-400">
                          <span>Kendi Birikiminiz:</span>
                          <span className="font-bold text-white">
                            {formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-zinc-400">
                          <span>Devlet Katkısı (+%{account.besDetails?.stateContributionRate || 30}):</span>
                          <span className="font-bold text-amber-400">
                            +{formatWithEquivalent(besStateBal, account.currency || 'TRY', isAccountHidden(account.id))}
                          </span>
                        </div>
                        {monthlyCont > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-zinc-400">
                            <span>Aylık Düzenli Katkı:</span>
                            <span className="font-semibold text-emerald-400">
                              {formatWithEquivalent(monthlyCont, account.currency || 'TRY', isAccountHidden(account.id))} / ay
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-amber-500/10 flex justify-between items-center text-xs">
                          <span className="font-black text-amber-300 uppercase tracking-wider text-[10px]">Toplam BES Portföyü</span>
                          <span className="font-black text-emerald-400 text-sm">
                            {formatWithEquivalent(totalBesVal, account.currency || 'TRY', isAccountHidden(account.id))}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Open Account Transactions Button Footer */}
                <div className="pt-2 flex items-center justify-between text-xs font-bold text-emerald-500 group-hover:text-emerald-400 transition-colors">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Hesap İşlemlerini Gör
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>

                <AnimatePresence>
                  {syncResults[account.id] && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest ${
                        syncResults[account.id].success 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {syncResults[account.id].success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {syncResults[account.id].message}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedAccounts).map(([groupName, accs]) => (
            <div key={groupName} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">{groupName}</h2>
                <span className="text-xs font-black text-primary">
                  {formatWithEquivalent(
                    accs.reduce((sum, a) => sum + (a.balance || 0), 0),
                    'TRY'
                  )}
                </span>
              </div>

              {/* Table Column Header for Desktop */}
              <div className="hidden md:grid md:grid-cols-12 px-5 py-2.5 bg-secondary/30 rounded-xl border border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground gap-4 items-center">
                <div className="col-span-4">Hesap & Kurum</div>
                <div className="col-span-2">Hesap Sahibi</div>
                <div className="col-span-3">Tür / Branş</div>
                <div className="col-span-2 text-right">Bakiye / Değer</div>
                <div className="col-span-1 text-right">İşlem</div>
              </div>

              <div className="space-y-2.5">
                {accs.map(account => (
                  <div 
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className="corporate-card p-4 grid grid-cols-1 md:grid-cols-12 items-center gap-3 md:gap-4 hover:border-emerald-500/50 hover:shadow-md cursor-pointer transition-all group rounded-2xl"
                  >
                    {/* Col 1: Icon, Name, Institution, Asset Symbol */}
                    <div className="md:col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary/50 rounded-xl flex items-center justify-center border border-border/50 group-hover:scale-110 transition-transform shrink-0">
                        {getBranchIcon(account.branch || '')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-sm text-foreground group-hover:text-emerald-400 transition-colors truncate">{account.name}</h3>
                          {account.assetDetails?.symbol && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded uppercase">
                              {account.assetDetails.symbol}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-widest opacity-70">
                          {account.institution || 'Diğer Kurum'}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Owner Badge */}
                    <div className="md:col-span-2 flex items-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                        <User className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{getOwnerDisplayName(account.ownerId)}</span>
                      </span>
                    </div>

                    {/* Col 3: Type/Branch */}
                    <div className="md:col-span-3 text-xs text-muted-foreground font-medium">
                      <span className="px-2 py-0.5 bg-secondary/80 rounded-lg border border-border/50 text-[10px] font-extrabold text-foreground uppercase tracking-wider inline-block">
                        {
                          account.assetDetails?.assetType === 'stock' ? 'Hisse Senedi' :
                          account.assetDetails?.assetType === 'crypto' ? 'Kripto Varlık' :
                          account.subType === 'bes' ? 'BES Emeklilik' :
                          account.subType === 'oks' ? 'OKS Emeklilik' :
                          account.subType === 'liquidity_deposit' ? 'Vadesiz / Mevduat' :
                          account.subType === 'credit_card' ? 'Kredi Kartı' :
                          account.subType === 'cash' ? 'Nakit Para' :
                          account.subType === 'personal_debt' ? 'Kişisel Borç' :
                          account.subType === 'personal_loan' ? 'Kişisel Alacak' : 'Genel Hesap'
                        }
                      </span>
                    </div>

                    {/* Col 4: Balance */}
                    <div className="md:col-span-2 md:text-right">
                      <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-black mb-0.5 opacity-60 md:hidden">Bakiye</p>
                      <p className={`text-sm font-black ${account.subType === 'credit_card' ? 'text-rose-500' : 'text-foreground'}`}>
                        {formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}
                      </p>
                    </div>

                    {/* Col 5: Actions */}
                    <div className="md:col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {account.apiConfig && (
                        <button 
                          onClick={() => handleSync(account)}
                          disabled={syncingIds.has(account.id)}
                          className="p-1.5 text-muted-foreground hover:text-emerald-400 transition-colors"
                          title="API Senkronize Et"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingIds.has(account.id) ? 'animate-spin text-emerald-400' : ''}`} />
                        </button>
                      )}
                      <button 
                        onClick={() => toggleLocalPrivacy(account.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={isAccountHidden(account.id) ? 'Göster' : 'Gizle'}
                      >
                        {isAccountHidden(account.id) ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => onEditAccount(account)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Düzenle"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteAccount && (
                        <button 
                          onClick={() => setDeleteConfirmAccount(account)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Hesabı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-emerald-400 transition-colors ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredAccounts.length === 0 && (
        <div className="text-center py-24 bg-secondary/20 border border-dashed border-border rounded-[2.5rem] group hover:bg-secondary/30 transition-all">
          <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">Hesap Bulunamadı</h3>
          <p className="text-muted-foreground max-w-xs mx-auto text-sm font-medium">Arama kriterlerinize uygun hesap bulunamadı veya henüz hesap eklemediniz.</p>
        </div>
      )}

      {/* Account Details & Transactions Modal */}
      <AnimatePresence>
        {selectedAccount && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto"
            onClick={() => setSelectedAccount(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="corporate-card w-full max-w-4xl p-6 md:p-8 bg-zinc-950/95 border border-zinc-800 rounded-3xl space-y-6 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shrink-0">
                    {getBranchIcon(selectedAccount.branch || '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-black text-foreground">{selectedAccount.name}</h2>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {selectedAccount.institution || 'Hesap'}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-400" />
                        {getOwnerDisplayName(selectedAccount.ownerId)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {selectedAccount.subType === 'credit_card' ? 'Kredi Kartı Hesabı' : 'Gelen ve giden tüm hesap hareketleri'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImportTargetAccountId(selectedAccount.id);
                      setIsImportModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl transition-colors"
                    title="Bu hesaba ait ekstre/CSV dökümü yükle"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Ekstre Yükle</span>
                  </button>
                  <button
                    onClick={() => {
                      onEditAccount(selectedAccount);
                      setSelectedAccount(null);
                    }}
                    className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
                    title="Hesabı Düzenle"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {onDeleteAccount && (
                    <button
                      onClick={() => setDeleteConfirmAccount(selectedAccount)}
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl transition-colors"
                      title="Hesabı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedAccount(null)}
                    className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl transition-colors ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              {selectedAccount.subType === 'credit_card' ? (() => {
                const selectedFutureDebt = getCreditCardFutureDebt(selectedAccount, transactions);
                const selectedTotalDebt = selectedAccount.balance + Math.max(0, selectedFutureDebt);
                const selectedAvailableLimit = (selectedAccount.creditLimit || 0) - selectedTotalDebt;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Güncel Borç</span>
                      <span className="text-lg font-black text-rose-400">
                        {formatWithEquivalent(selectedAccount.balance, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Gelecek Taksitler</span>
                      <span className="text-lg font-black text-amber-400">
                        {formatWithEquivalent(selectedFutureDebt, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Kart Limiti</span>
                      <span className="text-lg font-black text-foreground">
                        {formatWithEquivalent(selectedAccount.creditLimit || 0, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Kullanılabilir Limit</span>
                      <span className={`text-lg font-black ${selectedAvailableLimit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {formatWithEquivalent(selectedAvailableLimit, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>
                  </div>
                );
              })() : (selectedAccount.subType === 'bes' || selectedAccount.subType === 'oks' || selectedAccount.besDetails) ? (() => {
                const stateContribution = selectedAccount.besDetails?.stateContributionBalance ?? (selectedAccount.balance * ((selectedAccount.besDetails?.stateContributionRate ?? 30) / 100));
                const totalBesPortfolio = selectedAccount.balance + stateContribution;
                const monthlyCont = selectedAccount.besDetails?.monthlyContribution || 0;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">Kendi Birikiminiz</span>
                      <span className="text-lg font-black text-white">
                        {formatWithEquivalent(selectedAccount.balance, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Devlet Katkısı (%30)</span>
                      <span className="text-lg font-black text-amber-400">
                        +{formatWithEquivalent(stateContribution, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Toplam Emeklilik Portföyü</span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatWithEquivalent(totalBesPortfolio, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Aylık Düzenli Katkı</span>
                      <span className="text-lg font-black text-foreground">
                        {formatWithEquivalent(monthlyCont, selectedAccount.currency || 'TRY')}
                      </span>
                    </div>
                  </div>
                );
              })() : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                  <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Güncel Bakiye</span>
                    <span className="text-lg font-black text-emerald-400">
                      {formatWithEquivalent(selectedAccount.balance, selectedAccount.currency || 'TRY')}
                    </span>
                  </div>

                  <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Toplam Gelen (+)
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      +{formatWithEquivalent(accTxStats.totalIncoming, selectedAccount.currency || 'TRY')}
                    </span>
                  </div>

                  <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Toplam Giden (-)
                    </span>
                    <span className="text-lg font-black text-rose-400">
                      -{formatWithEquivalent(accTxStats.totalOutgoing, selectedAccount.currency || 'TRY')}
                    </span>
                  </div>

                  <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Toplam İşlem</span>
                    <span className="text-lg font-black text-foreground">
                      {accTxStats.count} İşlem
                    </span>
                  </div>
                </div>
              )}

              {/* Controls: Filter & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
                  <button
                    onClick={() => setAccTxFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      accTxFilter === 'all' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Tümü ({selectedAccountTxs.length})
                  </button>
                  <button
                    onClick={() => setAccTxFilter('incoming')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      accTxFilter === 'incoming' ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Gelen (+)
                  </button>
                  <button
                    onClick={() => setAccTxFilter('outgoing')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      accTxFilter === 'outgoing' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Giden (-)
                  </button>
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="İşlemlerde ara..."
                    value={accTxSearch}
                    onChange={(e) => setAccTxSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Transaction List */}
              <div className="overflow-y-auto flex-1 pr-1 border border-zinc-900 rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-zinc-900/90 text-[10px] text-zinc-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-3 font-bold">
                        <button 
                          onClick={() => toggleAccTxSort('date')}
                          className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
                          title="Tarihe göre sırala"
                        >
                          Tarih
                          {accTxSortField === 'date' ? (
                            accTxSortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-indigo-400" /> : <ArrowUp className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-bold">
                        <button 
                          onClick={() => toggleAccTxSort('description')}
                          className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
                          title="Açıklamaya göre sırala"
                        >
                          Açıklama
                          {accTxSortField === 'description' ? (
                            accTxSortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-indigo-400" /> : <ArrowUp className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-bold">
                        <button 
                          onClick={() => toggleAccTxSort('category')}
                          className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
                          title="Kategori veya hesaba göre sırala"
                        >
                          Kategori / Hesap
                          {accTxSortField === 'category' ? (
                            accTxSortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-indigo-400" /> : <ArrowUp className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-bold text-right">
                        <button 
                          onClick={() => toggleAccTxSort('amount')}
                          className="flex items-center gap-1.5 ml-auto hover:text-indigo-400 transition-colors"
                          title="Tutara göre sırala"
                        >
                          Tutar
                          {accTxSortField === 'amount' ? (
                            accTxSortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-indigo-400" /> : <ArrowUp className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {filteredAccountTxs.length > 0 ? (
                      filteredAccountTxs.map((tx) => {
                        const dir = getTxDirection(tx, selectedAccount);
                        const counterpart = getCounterpartName(tx, selectedAccount, dir);
                        const isIncoming = dir === 'incoming';
                        const isInst = tx.isInstallment || (tx.installmentCount && tx.installmentCount > 1);

                        return (
                          <tr key={tx.id} className="hover:bg-zinc-900/50 transition-colors group">
                            <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-white">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{tx.description}</span>
                                {isInst && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold">
                                    Taksit {tx.installmentNumber}/{tx.installmentCount}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 rounded-md text-[10px] font-bold text-zinc-300">
                                <Tag className="w-3 h-3 text-zinc-500" />
                                {counterpart}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-xs font-black text-right whitespace-nowrap ${
                              isIncoming ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {isIncoming ? '+' : '-'}{formatWithEquivalent(tx.amount, tx.currency || 'TRY')}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                              {onEditTransaction && (
                                <button
                                  onClick={() => {
                                    onEditTransaction(tx);
                                    setSelectedAccount(null);
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-zinc-800/60 bg-zinc-900/40"
                                  title="Düzenle"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteConfirmTx(tx)}
                                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-zinc-800/60 bg-zinc-900/40"
                                title="Sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-xs text-zinc-500">
                          {accTxSearch ? 'Arama kriterlerinize uygun işlem bulunamadı.' : 'Bu hesaba ait henüz işlem bulunmuyor.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Deletion Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmAccount && (
          <div 
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => setDeleteConfirmAccount(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="corporate-card w-full max-w-md p-6 bg-zinc-950 border border-zinc-800 rounded-3xl space-y-5 text-center shadow-2xl"
            >
              <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Hesabı Sil</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  <strong className="text-white">{deleteConfirmAccount.name}</strong> hesabını silmek istediğinizden emin misiniz?
                  <br />
                  Bu işlem hesabı listenizden kaldırır. Hesaba bağlı geçmiş harcama ve gelir kayıtları korunmaya devam eder.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmAccount(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold rounded-2xl text-xs transition-colors border border-zinc-800"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
                >
                  {isDeleting ? 'Siliniyor...' : 'Evet, Hesabı Sil'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!deleteConfirmTx}
        onClose={() => setDeleteConfirmTx(null)}
        onConfirm={async () => {
          if (deleteConfirmTx) {
            await deleteLedgerTransaction(householdId, deleteConfirmTx.id);
            setDeleteConfirmTx(null);
          }
        }}
        title="İşlemi Sil"
        message={`${deleteConfirmTx?.description || 'Bu'} işlemini silmek istediğinizden emin misiniz? Bu işlem hesap bakiyelerini de güncelleyecektir.`}
      />

      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportTargetAccountId('');
        }}
        householdId={householdId}
        accounts={accounts}
        categories={categories}
        members={members}
        transactions={transactions}
        initialAccountId={importTargetAccountId || selectedAccount?.id}
      />
    </div>
  );
};
