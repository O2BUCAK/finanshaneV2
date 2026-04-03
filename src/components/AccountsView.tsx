import React, { useState } from 'react';
import { 
  Wallet, Building2, Bitcoin, Gift, RefreshCw, 
  Plus, Search, ChevronRight, AlertCircle, CheckCircle2,
  ExternalLink, Settings2, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account } from '../types';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { syncAccountWithApi } from '../lib/apiIntegrations';

interface AccountsViewProps {
  householdId: string;
  accounts: Account[];
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  isPrivacyMode?: boolean;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  householdId,
  accounts,
  onAddAccount,
  onEditAccount,
  isPrivacyMode = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.institution?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Hesaplarım</h1>
          <p className="text-zinc-400 font-medium mt-1">Tüm banka, kripto ve sosyal hesaplarınızın yönetimi</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input 
          type="text"
          placeholder="Hesap veya kurum ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map(account => (
          <motion.div 
            key={account.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-zinc-700 transition-all"
          >
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800">
                    {getBranchIcon(account.branch || '')}
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-emerald-500 transition-colors">{account.name}</h3>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{account.institution || 'Diğer'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {account.apiConfig && (
                    <button 
                      onClick={() => handleSync(account)}
                      disabled={syncingIds.has(account.id)}
                      className={`p-2 rounded-xl transition-all ${
                        syncingIds.has(account.id) 
                          ? 'bg-emerald-500/10 text-emerald-500 animate-spin' 
                          : 'bg-zinc-950 text-zinc-400 hover:text-emerald-500 border border-zinc-800'
                      }`}
                      title="API ile Senkronize Et"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => toggleLocalPrivacy(account.id)}
                    className={`p-2 border border-zinc-800 rounded-xl transition-all ${
                      isAccountHidden(account.id)
                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                    title={isAccountHidden(account.id) ? 'Göster' : 'Gizle'}
                  >
                    {isAccountHidden(account.id) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => onEditAccount(account)}
                    className="p-2 bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition-all"
                    title="Düzenle"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/50">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                      {account.subType === 'credit_card' ? 'Güncel Borç' : 'Güncel Bakiye'}
                    </p>
                    <p className={`text-2xl font-bold tracking-tight ${account.subType === 'credit_card' ? 'text-rose-500' : 'text-white'}`}>
                      {formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}
                    </p>
                  </div>
                  {account.apiConfig?.lastSync && (
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Son Senk.</p>
                      <p className="text-[10px] text-zinc-400 font-medium">
                        {new Date(account.apiConfig.lastSync).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>

                {account.subType === 'credit_card' && (
                  <div className="mt-4 space-y-3 p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kart Limiti</span>
                      <span className="text-xs font-bold text-zinc-300">{formatWithEquivalent(account.creditLimit || 0, account.currency || 'TRY', isAccountHidden(account.id))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kalan Limit</span>
                      <span className="text-xs font-bold text-emerald-500">{formatWithEquivalent((account.creditLimit || 0) - account.balance, account.currency || 'TRY', isAccountHidden(account.id))}</span>
                    </div>
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full" 
                        style={{ width: `${Math.min((account.balance / (account.creditLimit || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Güncel Borç</p>
                        <p className="text-xs font-bold text-zinc-200">{formatWithEquivalent(account.balance, account.currency || 'TRY', isAccountHidden(account.id))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Asgari Tutar</p>
                        <p className="text-xs font-bold text-zinc-200">
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
                    className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
                      syncResults[account.id].success 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}
                  >
                    {syncResults[account.id].success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {syncResults[account.id].message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {account.branch === 'crypto' && (
              <div className="px-6 py-3 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Kripto Varlık</span>
                <ExternalLink className="w-3 h-3 text-zinc-600" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Hesap Bulunamadı</h3>
          <p className="text-zinc-400 max-w-xs mx-auto">Arama kriterlerinize uygun hesap bulunamadı veya henüz hesap eklemediniz.</p>
        </div>
      )}
    </div>
  );
};
