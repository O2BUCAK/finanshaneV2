import React, { useState, useMemo } from 'react';
import { 
  Wallet, Building2, Bitcoin, Gift, RefreshCw, 
  Plus, Search, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Settings2, Eye, EyeOff, TrendingUp, TrendingDown,
  LayoutGrid, List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { syncAccountWithApi } from '../lib/apiIntegrations';

interface AccountsViewProps {
  householdId: string;
  accounts: Account[];
  assetPrices: Record<string, { price: number; changePercent: number }>;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  isPrivacyMode?: boolean;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  householdId,
  accounts,
  assetPrices,
  onAddAccount,
  onEditAccount,
  isPrivacyMode = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupBy, setGroupBy] = useState<'none' | 'institution' | 'type' | 'branch'>('none');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [toggledAccounts, setToggledAccounts] = useState<Set<string>>(new Set());
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

    // Simple interest calculation based on period
    switch (account.depositDetails.period) {
      case 'daily':
        // If it's a daily rate (unlikely but possible)
        accrued = account.balance * rate * diffDays;
        break;
      case 'monthly':
        // If it's an annual rate but calculated monthly
        accrued = (account.balance * rate * diffDays) / 365;
        break;
      case 'yearly':
      default:
        // Standard annual rate calculation
        accrued = (account.balance * rate * diffDays) / 365;
        break;
    }
    
    return accrued;
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.institution?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            credit_debt: 'Alacaklar',
            credit_card: 'Kredi Kartları',
            transport: 'Ulaşım Kartları',
            food: 'Yemek Kartları',
            corporate_gift: 'Kurumsal Hediyeler'
          };
          key = subTypeMap[acc.subType] || 'Diğer';
        }
      } else if (groupBy === 'branch') {
        const branchMap: any = { banking: 'Bankacılık', crypto: 'Kripto', social_gift: 'Sosyal/Yan Haklar' };
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
      // Clear result after 3 seconds
      setTimeout(() => {
        setSyncResults(prev => {
          const next = { ...prev };
          delete next[account.id];
          return next;
        });
      }, 3000);
    }
  };

  const getBranchIcon = (branch: string) => {
    switch (branch) {
      case 'banking': return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'crypto': return <Bitcoin className="w-5 h-5 text-orange-500" />;
      case 'social_gift': return <Gift className="w-5 h-5 text-purple-500" />;
      default: return <Wallet className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Hesaplarım</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Tüm banka, kripto ve sosyal hesaplarınızın yönetimi</p>
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
              className="group corporate-card overflow-hidden relative border border-border/30 hover:border-primary/30 transition-all duration-500"
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
                      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mt-1">{account.institution || 'Diğer Kurum'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {account.apiConfig && (
                      <button 
                        onClick={() => handleSync(account)}
                        disabled={syncingIds.has(account.id)}
                        className={`p-2.5 rounded-xl transition-all duration-500 ${
                          syncingIds.has(account.id) 
                            ? 'bg-emerald-500/20 text-emerald-500 animate-spin' 
                            : 'bg-secondary/50 text-muted-foreground hover:text-emerald-500 border border-border/50 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                        }`}
                        title="API ile Senkronize Et"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleLocalPrivacy(account.id)}
                      className={`p-2.5 border border-border/50 rounded-xl transition-all duration-500 ${
                        isAccountHidden(account.id)
                          ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                      title={isAccountHidden(account.id) ? 'Göster' : 'Gizle'}
                    >
                      {isAccountHidden(account.id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => onEditAccount(account)}
                      className="p-2.5 bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/50 rounded-xl transition-all duration-500 hover:bg-secondary"
                      title="Düzenle"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
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
                    {account.apiConfig?.lastSync && (
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-black mb-2 opacity-60">Son Senk.</p>
                        <p className="text-xs font-black text-muted-foreground opacity-80">
                          {new Date(account.apiConfig.lastSync).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}
                  </div>

                  {account.type === 'asset' && account.assetDetails && assetPrices[account.assetDetails.symbol] && (
                    <div className="mt-6 p-4 bg-zinc-950/30 rounded-2xl border border-border/50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            (account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price) >= account.balance 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {(account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price) >= account.balance 
                              ? <TrendingUp className="w-3 h-3" /> 
                              : <TrendingDown className="w-3 h-3" />
                            }
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Kar / Zarar</span>
                        </div>
                        <span className={`text-sm font-black ${
                          (account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price) >= account.balance 
                            ? 'text-emerald-500' 
                            : 'text-rose-500'
                        }`}>
                          {formatWithEquivalent(
                            (account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price) - account.balance,
                            account.currency || 'TRY',
                            isAccountHidden(account.id)
                          )}
                          <span className="ml-1 text-[10px] opacity-60">
                            ({(((account.assetDetails.quantity * assetPrices[account.assetDetails.symbol].price) / (account.balance || 1) - 1) * 100).toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {account.depositDetails?.isTimeDeposit && (
                    <div className="mt-6 p-4 bg-zinc-950/30 rounded-2xl border border-border/50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <TrendingUp className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Birikmiş Faiz</span>
                        </div>
                        <span className="text-sm font-black text-emerald-500">
                          {formatWithEquivalent(
                            calculateAccruedInterest(account),
                            account.currency || 'TRY',
                            isAccountHidden(account.id)
                          )}
                          <span className="ml-1 text-[10px] opacity-60">
                            (%{account.depositDetails.interestRate})
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {account.loanDetails && (
                    <div className="mt-6 space-y-4 p-6 bg-zinc-950/30 rounded-[2rem] border border-border/50 relative overflow-hidden group/loan-info hover:bg-zinc-950/50 transition-all duration-500">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all duration-700 group-hover/loan-info:bg-emerald-500/10" />
                      
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">Kalan Borç</span>
                        <span className="text-sm font-black text-foreground">{formatWithEquivalent(account.loanDetails.remainingPrincipal, account.currency || 'TRY', isAccountHidden(account.id))}</span>
                      </div>
                      
                      <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden relative z-10 p-0.5 border border-border/30">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((1 - (account.loanDetails.remainingPrincipal / account.loanDetails.principal)) * 100, 100)}%` }}
                          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1 relative z-10">
                        <div>
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Aylık Taksit</p>
                          <p className="text-sm font-black text-emerald-500">{formatWithEquivalent(account.loanDetails.monthlyPayment, account.currency || 'TRY', isAccountHidden(account.id))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Sonraki Ödeme</p>
                          <p className="text-sm font-black text-foreground">
                            {new Date(account.loanDetails.nextPaymentDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-4 relative z-10">
                        <div>
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Toplam Faiz</p>
                          <p className="text-xs font-black text-rose-500">{formatWithEquivalent(account.loanDetails.totalInterest, account.currency || 'TRY', isAccountHidden(account.id))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Vade</p>
                          <p className="text-xs font-black text-foreground">{account.loanDetails.termMonths} Ay</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {account.subType === 'credit_card' && (
                    <div className="mt-6 space-y-4 p-6 bg-zinc-950/30 rounded-[2rem] border border-border/50 relative overflow-hidden group/card-info hover:bg-zinc-950/50 transition-all duration-500">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all duration-700 group-hover/card-info:bg-rose-500/10" />
                      
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">Kart Limiti</span>
                        <span className="text-sm font-black text-foreground">{formatWithEquivalent(account.creditLimit || 0, account.currency || 'TRY', isAccountHidden(account.id))}</span>
                      </div>
                      <div className="flex justify-between items-center relative z-10">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">Kalan Limit</span>
                        <span className="text-sm font-black text-emerald-500">{formatWithEquivalent((account.creditLimit || 0) - account.balance, account.currency || 'TRY', isAccountHidden(account.id))}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden relative z-10 p-0.5 border border-border/30">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((account.balance / (account.creditLimit || 1)) * 100, 100)}%` }}
                          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.4)]" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-1 relative z-10">
                        <div>
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Güncel Borç</p>
                          <p className="text-sm font-black text-foreground">{formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60 mb-1">Asgari Tutar</p>
                          <p className="text-sm font-black text-foreground">
                            {formatWithEquivalent(account.balance * ((account.creditLimit || 0) >= 25000 ? 0.4 : 0.2), account.currency || 'TRY', isAccountHidden(account.id))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
              
              {account.branch === 'crypto' && (
                <div className="px-10 py-4 bg-secondary/50 border-t border-border/50 flex items-center justify-between group-hover:bg-secondary/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <Bitcoin className="w-4 h-4 text-orange-500" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.25em] opacity-60">Kripto Varlık</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              )}
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
              <div className="grid grid-cols-1 gap-3">
                {accs.map(account => (
                  <div 
                    key={account.id}
                    className="corporate-card p-4 flex items-center justify-between hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-secondary/50 rounded-xl flex items-center justify-center border border-border/50 group-hover:scale-110 transition-transform">
                        {getBranchIcon(account.branch || '')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm text-foreground">{account.name}</h3>
                          {account.assetDetails?.symbol && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded uppercase">
                              {account.assetDetails.symbol}
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60">
                          {account.institution || 'Diğer Kurum'} • {
                            account.assetDetails?.assetType === 'stock' ? 'Hisse Senedi' :
                            account.assetDetails?.assetType === 'crypto' ? 'Kripto' :
                            account.subType === 'liquidity_deposit' ? 'Likidite/Mevduat' :
                            account.subType === 'credit_card' ? 'Kredi Kartı' : 'Diğer'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-black mb-0.5 opacity-60">Bakiye</p>
                        <p className={`text-sm font-black ${account.subType === 'credit_card' ? 'text-rose-500' : 'text-foreground'}`}>
                          {formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}
                        </p>
                      </div>
                      
                      <div className="flex gap-1">
                        <button 
                          onClick={() => toggleLocalPrivacy(account.id)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isAccountHidden(account.id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => onEditAccount(account)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 self-center ml-2" />
                      </div>
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
    </div>
  );
};
