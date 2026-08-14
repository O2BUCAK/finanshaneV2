import React, { useState, useRef, useMemo } from 'react';
import { 
  UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight,
  Trash2, Filter, Search, Check, X, CreditCard, User, Building2,
  Calendar, RefreshCw, Layers, ShieldCheck, Download, Sparkles, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Account, Transaction } from '../types';
import { 
  BANK_PRESETS, 
  ParsedStatementRow, 
  parseStatementFile 
} from '../utils/statementParser';
import { createLedgerTransaction } from '../lib/ledger';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  accounts: Account[];
  categories: Account[];
  members?: Record<string, any>;
  currentUserId?: string;
  transactions?: Transaction[];
  initialAccountId?: string;
  onImportComplete?: (count: number) => void;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({
  isOpen,
  onClose,
  householdId,
  accounts,
  categories,
  members = {},
  currentUserId = '',
  transactions = [],
  initialAccountId,
  onImportComplete,
  showNotification
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'success'>('upload');
  const [selectedPreset, setSelectedPreset] = useState<string>('auto');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || accounts[0]?.id || '');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(currentUserId);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed rows
  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'duplicates'>('all');
  const [importCount, setImportCount] = useState(0);

  // Default target account sync
  React.useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
      const acc = accounts.find(a => a.id === initialAccountId);
      if (acc?.ownerId) setSelectedOwnerId(acc.ownerId);
      if (acc?.institution) {
        const inst = acc.institution.toLowerCase();
        if (inst.includes('garanti')) setSelectedPreset('garanti');
        else if (inst.includes('iş') || inst.includes('is ')) setSelectedPreset('isbank');
        else if (inst.includes('akbank')) setSelectedPreset('akbank');
        else if (inst.includes('yapı') || inst.includes('yapi')) setSelectedPreset('yapikredi');
        else if (inst.includes('ziraat')) setSelectedPreset('ziraat');
        else if (inst.includes('vakıf') || inst.includes('vakif')) setSelectedPreset('vakif');
        else if (inst.includes('enpara') || inst.includes('qnb')) setSelectedPreset('qnb_enpara');
        else if (inst.includes('papara')) setSelectedPreset('papara');
      }
    } else if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
      if (accounts[0].ownerId) setSelectedOwnerId(accounts[0].ownerId);
    }
  }, [initialAccountId, accounts]);

  const targetAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const handleFileProcess = async (file: File) => {
    if (!selectedAccountId) {
      setParseError('Lütfen önce dökümün ait olduğu banka/varlık hesabını seçin.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setUploadedFile(file);

    try {
      const rows = await parseStatementFile(
        file,
        selectedPreset,
        selectedAccountId,
        selectedOwnerId || currentUserId,
        categories,
        transactions
      );

      if (rows.length === 0) {
        setParseError('Dosyada geçerli hesap hareketi bulunamadı. Lütfen banka formatını veya başlıkları kontrol edin.');
        setIsParsing(false);
        return;
      }

      setParsedRows(rows);
      setStep('review');
    } catch (err: any) {
      console.error('File parse error:', err);
      setParseError(err.message || 'Dosya ayrıştırılırken bir hata oluştu. Lütfen CSV veya Excel formatını kontrol edin.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Row update handlers
  const handleToggleRow = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleSelectAll = (select: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const handleCategoryChange = (id: string, categoryId: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selectedCategoryId: categoryId } : r));
  };

  const handleTypeToggle = (id: string) => {
    setParsedRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newType = r.type === 'expense' ? 'income' : 'expense';
      const defaultExpenseCat = categories.find(c => c.type === 'expense')?.id || 'market';
      const defaultIncomeCat = categories.find(c => c.type === 'income')?.id || 'maas';
      return {
        ...r,
        type: newType,
        selectedCategoryId: newType === 'income' ? defaultIncomeCat : defaultExpenseCat
      };
    }));
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, description } : r));
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Filtering
  const filteredRows = useMemo(() => {
    return parsedRows.filter(row => {
      const matchesSearch = row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.amount.toString().includes(searchTerm);

      if (!matchesSearch) return false;

      if (filterType === 'income') return row.type === 'income';
      if (filterType === 'expense') return row.type === 'expense';
      if (filterType === 'duplicates') return row.isDuplicate;
      return true;
    });
  }, [parsedRows, searchTerm, filterType]);

  // Totals of selected
  const totals = useMemo(() => {
    const selected = parsedRows.filter(r => r.selected);
    const totalIncome = selected.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const totalExpense = selected.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    return {
      count: selected.length,
      totalCount: parsedRows.length,
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      duplicateCount: parsedRows.filter(r => r.isDuplicate).length
    };
  }, [parsedRows]);

  // Execute Batch Import
  const handleExecuteImport = async () => {
    const toImport = parsedRows.filter(r => r.selected);
    if (toImport.length === 0) {
      alert('Lütfen içe aktarılacak en az bir hareket seçin.');
      return;
    }

    setStep('importing');
    let successfulCount = 0;

    try {
      for (const row of toImport) {
        const isIncome = row.type === 'income';
        const currency = targetAccount?.currency || 'TRY';

        // Double-entry setup:
        // For expense: debitAccountId is category, creditAccountId is bank account
        // For income: debitAccountId is bank account, creditAccountId is category
        const debitAccountId = isIncome ? selectedAccountId : row.selectedCategoryId;
        const creditAccountId = isIncome ? row.selectedCategoryId : selectedAccountId;

        const txData = {
          description: row.description,
          amount: row.amount,
          currency,
          date: row.date,
          debitAccountId,
          creditAccountId,
          categoryId: row.selectedCategoryId,
          userId: selectedOwnerId || currentUserId,
          notes: `Banka Dökümü İçe Aktarma (${uploadedFile?.name || 'Ekstre'})`
        };

        await createLedgerTransaction(householdId, txData);
        successfulCount++;
      }

      setImportCount(successfulCount);
      setStep('success');
      if (onImportComplete) onImportComplete(successfulCount);
      if (showNotification) showNotification(`${successfulCount} adet hesap hareketi başarıyla hesabınıza işlendi.`, 'success');
    } catch (err: any) {
      console.error('Import execution error:', err);
      setParseError(`İçe aktarma sırasında bir hata oluştu: ${err.message || 'Bilinmeyen hata'}`);
      setStep('review');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setUploadedFile(null);
    setParsedRows([]);
    setParseError(null);
    setSearchTerm('');
    setFilterType('all');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card/80 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground tracking-tight">Banka Ekstresi & Döküm Yükleme</h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  CSV / Excel Parser
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">Garanti BBVA, Akbank, İş Bankası ve tüm Türk bankalarının aylık ekstrelerini otomatik aktarın</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD & CONFIGURATION */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Account & Member Configuration Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary/30 p-5 rounded-2xl border border-border">
                {/* Target Account */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    1. Aktarılacak Hesap
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer pr-8"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.institution || 'Banka'}) - {acc.currency || 'TRY'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Member Assignment */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    2. Harcama / Gelir Sahibi
                  </label>
                  <div className="relative">
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer pr-8"
                    >
                      {members && Object.keys(members).length > 0 ? (
                        Object.entries(members).map(([id, m]) => (
                          <option key={id} value={id}>
                            {m.displayName || m.name || 'Hane Üyesi'}
                          </option>
                        ))
                      ) : (
                        <option value={currentUserId}>Mevcut Kullanıcı</option>
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Bank Preset */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    3. Banka Formatı
                  </label>
                  <div className="relative">
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer pr-8"
                    >
                      {BANK_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name} ({preset.description})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Supported Banks Quick Selector */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground block mb-2.5">
                  Popüler Banka Şablonları
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                  {BANK_PRESETS.map(preset => {
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 text-xs font-bold ${
                          isSelected 
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm' 
                            : 'bg-card border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="truncate w-full text-[11px]">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
                  dragOver 
                    ? 'border-emerald-500 bg-emerald-500/5 scale-[0.99]' 
                    : 'border-border hover:border-emerald-500/50 hover:bg-secondary/20'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileInputChange} 
                  accept=".csv,.xlsx,.xls,.txt" 
                  className="hidden" 
                />

                <div className="w-16 h-16 rounded-3xl bg-secondary/80 border border-border flex items-center justify-center text-muted-foreground group-hover:scale-110 transition-transform">
                  {isParsing ? (
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8 text-emerald-400" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-black text-foreground mb-1">
                    {isParsing ? 'Döküm Ayrıştırılıyor...' : 'Banka Dökümünü veya Ekstre Dosyasını Sürükleyip Bırakın'}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Garanti BBVA, Akbank, İş Bankası vb. internet bankacılığından indirdiğiniz <strong>.CSV</strong>, <strong>.XLSX</strong> veya <strong>.XLS</strong> dosyasını seçin.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground bg-secondary/50 px-3.5 py-1.5 rounded-full border border-border">
                  <span>Desteklenen:</span>
                  <span className="text-foreground">Garanti Hesap Özeti</span> •
                  <span className="text-foreground">Excel (.xlsx)</span> •
                  <span className="text-foreground">CSV (Virgül/Noktalı Virgül)</span>
                </div>
              </div>

              {/* Error Message */}
              {parseError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Information / Privacy Guide */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-emerald-400">Tamamen Güvenli & Yerel İşleme: </span>
                  Yüklediğiniz ekstre dosyaları banka şifresi gerektirmez. Dosyalar tarayıcınızda yerel olarak çözümlenir ve sadece sizin onayladığınız işlemler çift taraflı muhasebe kaydı olarak kasanıza eklenir.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & BATCH EDIT */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Top Banner Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-secondary/40 border border-border p-3.5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Seçilen / Toplam</p>
                  <p className="text-lg font-black text-foreground mt-0.5">{totals.count} / {totals.totalCount} Hareket</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Toplam Gelir (+)</p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">+{totals.income.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-400">Toplam Gider (-)</p>
                  <p className="text-lg font-black text-rose-400 mt-0.5">-{totals.expense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
                </div>
                <div className="bg-secondary/40 border border-border p-3.5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Hedef Hesap</p>
                  <p className="text-sm font-black text-foreground mt-0.5 truncate">{targetAccount?.name || 'Hesap'}</p>
                </div>
              </div>

              {/* Duplicate warning bar if any */}
              {totals.duplicateCount > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-400">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><strong>{totals.duplicateCount} adet</strong> işlem daha önce kaydedilmiş olabilir (çift kayıt önlemek için varsayılan olarak seçimi kaldırıldı).</span>
                  </div>
                  <button
                    onClick={() => setFilterType(filterType === 'duplicates' ? 'all' : 'duplicates')}
                    className="underline text-[11px] font-bold"
                  >
                    {filterType === 'duplicates' ? 'Tümünü Göster' : 'Şüphelileri İncele'}
                  </button>
                </div>
              )}

              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/30 p-3 rounded-2xl border border-border">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="İşlem veya tutar ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button 
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
                  >
                    Tümü ({parsedRows.length})
                  </button>
                  <button 
                    onClick={() => setFilterType('expense')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'expense' ? 'bg-rose-500 text-white' : 'bg-card text-muted-foreground hover:text-rose-400'}`}
                  >
                    Giderler ({parsedRows.filter(r => r.type === 'expense').length})
                  </button>
                  <button 
                    onClick={() => setFilterType('income')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filterType === 'income' ? 'bg-emerald-500 text-white' : 'bg-card text-muted-foreground hover:text-emerald-400'}`}
                  >
                    Gelirler ({parsedRows.filter(r => r.type === 'income').length})
                  </button>
                </div>

                {/* Select / Deselect All */}
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleSelectAll(true)}
                    className="text-xs font-bold text-emerald-400 hover:underline px-2 py-1"
                  >
                    Tümünü Seç
                  </button>
                  <span className="text-border">|</span>
                  <button 
                    onClick={() => handleSelectAll(false)}
                    className="text-xs font-bold text-muted-foreground hover:underline px-2 py-1"
                  >
                    Seçimi Kaldır
                  </button>
                </div>
              </div>

              {/* Table of Parsed Rows */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] font-black tracking-widest sticky top-0 z-10 border-b border-border">
                      <tr>
                        <th className="p-3 w-10 text-center">Seç</th>
                        <th className="p-3 w-24">Tarih</th>
                        <th className="p-3 min-w-[200px]">Açıklama</th>
                        <th className="p-3 w-28">Tür</th>
                        <th className="p-3 w-40">Kategori</th>
                        <th className="p-3 w-28 text-right">Tutar</th>
                        <th className="p-3 w-12 text-center">Sil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredRows.map(row => {
                        const dateFormatted = row.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        return (
                          <tr 
                            key={row.id} 
                            className={`hover:bg-secondary/30 transition-colors ${row.selected ? 'bg-secondary/10' : 'opacity-60 bg-secondary/5'} ${row.isDuplicate ? 'border-l-4 border-l-amber-500' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => handleToggleRow(row.id)}
                                className="rounded border-border text-emerald-500 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                              />
                            </td>

                            {/* Date */}
                            <td className="p-3 font-mono font-medium text-muted-foreground whitespace-nowrap">
                              {dateFormatted}
                            </td>

                            {/* Description (Editable) */}
                            <td className="p-3">
                              <input 
                                type="text"
                                value={row.description}
                                onChange={(e) => handleDescriptionChange(row.id, e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-emerald-500 focus:bg-secondary/40 rounded px-1.5 py-1 text-xs font-medium text-foreground transition-all"
                              />
                              {row.isDuplicate && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 mt-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Zaten kayıtlı olabilir
                                </span>
                              )}
                            </td>

                            {/* Type (Toggleable Expense / Income) */}
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleTypeToggle(row.id)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                  row.type === 'income' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {row.type === 'income' ? '+ Gelir' : '- Gider'}
                              </button>
                            </td>

                            {/* Category Dropdown */}
                            <td className="p-3">
                              <select
                                value={row.selectedCategoryId}
                                onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                {categories
                                  .filter(c => row.type === 'income' ? c.type === 'income' : c.type === 'expense')
                                  .map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                              </select>
                            </td>

                            {/* Amount */}
                            <td className="p-3 text-right whitespace-nowrap">
                              <span className={`font-black font-mono text-xs ${row.type === 'income' ? 'text-emerald-400' : 'text-foreground'}`}>
                                {row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                              </span>
                            </td>

                            {/* Delete single row */}
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 text-muted-foreground hover:text-rose-400 transition-colors"
                                title="Listeden Çıkar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === 'importing' && (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-foreground">Hesap Hareketleri İşleniyor...</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Seçilen işlemler çift taraflı muhasebe defterine ve bakiye kayıtlarınıza güvenle yazılıyor.
              </p>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="py-12 text-center space-y-5">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">İçe Aktarma Tamamlandı!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{importCount} adet</strong> işlem başarıyla <strong>{targetAccount?.name}</strong> hesabınıza işlendi.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-colors"
                >
                  Başka Döküm Yükle
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-xs font-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Hesaplara Dön
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {step !== 'importing' && step !== 'success' && (
          <div className="px-6 py-4 border-t border-border bg-card/80 flex items-center justify-between">
            {step === 'review' ? (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Yeni Dosya Seç
              </button>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                Desteklenen formatlar: CSV, XLSX, XLS, TXT
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Vazgeç
              </button>

              {step === 'review' && (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={totals.count === 0}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-black text-xs hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>{totals.count} Hareketi Hesaba Aktar</span>
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
