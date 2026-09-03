import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import { Account, Transaction } from '../types';

export interface ParsedStatementRow {
  id: string;
  originalDate: string;
  date: Date;
  description: string;
  amount: number; // Always positive magnitude
  type: 'expense' | 'income';
  rawType?: string;
  balance?: number;
  suggestedCategoryId: string;
  selectedCategoryId: string;
  selectedAccountId: string;
  selectedOwnerId: string;
  isDuplicate?: boolean;
  selected: boolean;
  notes?: string;
}

export interface BankPreset {
  id: string;
  name: string;
  logoColor: string;
  description: string;
  fileTypes: string[];
}

export const BANK_PRESETS: BankPreset[] = [
  { id: 'auto', name: 'Otomatik Algıla', logoColor: 'emerald', description: 'Tüm Türk bankaları ve standart CSV/Excel formatları', fileTypes: ['.csv', '.xlsx', '.xls', '.txt'] },
  { id: 'garanti', name: 'Garanti BBVA', logoColor: 'emerald', description: 'İnternet/Mobil Bankacılık Hesap Özeti ve Ekstre', fileTypes: ['.csv', '.xlsx', '.xls', '.txt'] },
  { id: 'isbank', name: 'Türkiye İş Bankası', logoColor: 'blue', description: 'İşCep ve Ticari Hesap Hareketleri Dökümü', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'akbank', name: 'Akbank', logoColor: 'rose', description: 'Akbank Direkt Hesap Özeti ve Kredi Kartı Ekstresi', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'yapikredi', name: 'Yapı Kredi', logoColor: 'indigo', description: 'Yapı Kredi Mobil Hesap Hareketleri Dökümü', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'ziraat', name: 'Ziraat Bankası', logoColor: 'red', description: 'Ziraat Mobil / İnternet Hesap Ekstresi', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'vakif', name: 'VakıfBank', logoColor: 'amber', description: 'VakıfBank Hesap Hareketleri', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'qnb_enpara', name: 'QNB / Enpara', logoColor: 'purple', description: 'Enpara.com ve QNB Finansbank Dökümleri', fileTypes: ['.csv', '.xlsx', '.xls'] },
  { id: 'papara', name: 'Papara', logoColor: 'zinc', description: 'Papara Hesap Dökümü', fileTypes: ['.csv', '.xlsx'] }
];

/**
 * Clean & normalize Turkish numbers (e.g. "1.250,50", "- 350,00 TL", "1250.50", "(50,00)")
 */
export function parseTurkishNumber(val: any): { amount: number; isNegative: boolean } {
  if (typeof val === 'number') {
    return { amount: Math.abs(val), isNegative: val < 0 };
  }
  if (!val) return { amount: 0, isNegative: false };

  let str = String(val).trim();
  let isNegative = str.includes('-') || str.startsWith('(') || str.toLowerCase().includes('borç') || str.toLowerCase().includes('gider');

  // Strip currency symbols and letters
  str = str.replace(/[₺$€TL\s]/gi, '');
  str = str.replace(/[()]/g, '');

  if (!str) return { amount: 0, isNegative: false };

  // Check if formatted like 1.250,50 or 1,250.50
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Turkish format: 1.250,50 -> 1250.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,250.50 -> 1250.50
      str = str.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // 1250,50 -> 1250.50
    str = str.replace(',', '.');
  }

  // Remove any remaining non-numeric chars except dot and minus
  str = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);

  if (isNaN(parsed)) return { amount: 0, isNegative: false };

  if (parsed < 0) isNegative = true;
  return { amount: Math.abs(parsed), isNegative };
}

/**
 * Parse date strings like "15.01.2026", "2026-01-15", "15/01/2026 14:30", "15-01-2026"
 */
export function parseTurkishDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  // If number from Excel (Excel serial date)
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + val * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(val).trim();

  // Match DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const d = new Date(year, month, day, hours, mins);
    if (!isNaN(d.getTime())) return d;
  }

  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day, 12, 0);
    if (!isNaN(d.getTime())) return d;
  }

  const standardParsed = new Date(str);
  if (!isNaN(standardParsed.getTime())) return standardParsed;

  return new Date();
}

/**
 * Suggest a category ID based on Turkish keywords in the description
 */
export function suggestCategory(description: string, categories: Account[], defaultExpenseCatId: string, defaultIncomeCatId: string, isIncome: boolean): string {
  if (isIncome) {
    const incomeCat = categories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('maaş') || c.name.toLowerCase().includes('gelir')));
    return incomeCat?.id || defaultIncomeCatId || 'maas';
  }

  const text = (description || '').toLocaleUpperCase('tr-TR');

  const rules: { keywords: string[]; matchName: string }[] = [
    { keywords: ['MİGROS', 'MIGROS', 'BİM', 'BIM', 'A101', 'ŞOK', 'SOK', 'CARREFOUR', 'MARKET', 'BAKKAL', 'FILE', 'FİLE', 'TARIM KREDİ', 'GROSS'], matchName: 'Market' },
    { keywords: ['SHELL', 'BP', 'OPET', 'PETROL', 'TOTAL', 'PO ', 'AKARYAKIT', 'BENZIN', 'İSTANBULKART', 'ISTANBULKART', 'UBER', 'BITAXI', 'TAKSİ', 'MARTI', 'BINBIN', 'METRO', 'TCDD', 'OTOBUS', 'OTOPARK', 'HGS', 'OGS'], matchName: 'Ulaşım' },
    { keywords: ['KİRA', 'KIRA', 'AİDAT', 'AIDAT', 'YÖNETİM', 'KONUT', 'EMLAK', 'EV SAHİBİ'], matchName: 'Kira' },
    { keywords: ['TURKCELL', 'VODAFONE', 'TÜRK TELEKOM', 'TURK TELEKOM', 'İSKİ', 'ISKI', 'BEDAŞ', 'BEDAS', 'ENERJİSA', 'ENERJISA', 'AYEDAŞ', 'İGDAŞ', 'IGDAS', 'DOĞALGAZ', 'DOGALGAZ', 'FATURA', 'ELEKTRİK', 'SU FATURASI', 'SUPERONLINE', 'KABLONET', 'D-SMART'], matchName: 'Fatura' },
    { keywords: ['RESTORAN', 'CAFE', 'KAFE', 'YEMEK', 'STARBUCKS', 'GETİR', 'GETIR', 'YEMEKSEPETİ', 'YEMEKSEPETI', 'TRENDYOL YEMEK', 'MCDONALDS', 'BURGER', 'KÖFTE', 'PIZZA', 'PİDEDE', 'LOKANTA', 'FIRIN', 'PASTANE', 'KAHVE', 'ESPRESSOLAB'], matchName: 'Eğlence' },
    { keywords: ['NETFLIX', 'SPOTIFY', 'YOUTUBE', 'APPLE.COM', 'GOOGLE', 'DISNEY', 'PRIME', 'BLUTV', 'EXXEN', 'PLAYSTATION', 'STEAM', 'BEIN'], matchName: 'Eğlence' },
    { keywords: ['ECZANE', 'HASTANE', 'SAĞLIK', 'SAGLIK', 'TIP', 'DOKTOR', 'DİŞ', 'DIS', 'MEDİCAL', 'OPTİK', 'OPTIK', 'KLİNİK', 'LABORATUVAR'], matchName: 'Sağlık' },
    { keywords: ['ZARA', 'MANGO', 'LCW', 'LC WAIKIKI', 'BOYNER', 'DEFACTO', 'KOTON', 'MAVİ', 'MAVI', 'H&M', 'TRENDYOL', 'HEPSIBURADA', 'AMAZON', 'PAZARAMA', 'N11', 'ÇİÇEKSEPETİ', 'IKEA', 'DECATHLON', 'TEKNOSA', 'VATAN', 'MEDIAMARKT'], matchName: 'Market' },
    { keywords: ['KREDİ', 'KREDI', 'TAKSİT', 'TAKSIT', 'FAİZ', 'BORÇ', 'BORC', 'KK BORCU', 'EKSTRE ÖDEME'], matchName: 'Borç Ödemesi' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      const matched = categories.find(c => c.name.toLowerCase().includes(rule.matchName.toLowerCase()) || (c as any).icon === rule.matchName.toLowerCase());
      if (matched) return matched.id;
    }
  }

  // Fallback to first expense category
  const firstExpense = categories.find(c => c.type === 'expense');
  return firstExpense?.id || defaultExpenseCatId || 'market';
}

/**
 * Check if a row matches an existing transaction
 */
export function isPotentialDuplicate(
  date: Date,
  amount: number,
  description: string,
  existingTxs: Transaction[]
): boolean {
  if (!existingTxs || existingTxs.length === 0) return false;
  const rowDateStr = date.toISOString().split('T')[0];
  const cleanDesc = description.trim().toLowerCase();

  return existingTxs.some(tx => {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
    const txDateStr = txDate.toISOString().split('T')[0];
    const amountMatch = Math.abs(tx.amount - amount) < 0.01;
    const sameDay = txDateStr === rowDateStr;
    const descMatch = tx.description.toLowerCase().includes(cleanDesc) || cleanDesc.includes(tx.description.toLowerCase());
    return sameDay && amountMatch && (descMatch || tx.amount === amount);
  });
}

/**
 * Decode file buffer handling Turkish character encodings (UTF-8, Windows-1254 / ISO-8859-9)
 */
export async function readTextWithTurkishEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  
  // Try UTF-8 first
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    const text = utf8Decoder.decode(buffer);
    // Check if there are strange replacement characters
    if (!text.includes('')) {
      return text;
    }
  } catch (e) {
    // UTF-8 failed, fallback to Windows-1254 (Turkish standard for Excel/CSV export)
  }

  try {
    const trDecoder = new TextDecoder('windows-1254');
    return trDecoder.decode(buffer);
  } catch (e) {
    const fallback = new TextDecoder('iso-8859-9');
    return fallback.decode(buffer);
  }
}

/**
 * Master parser function for CSV / Excel / TXT
 */
export async function parseStatementFile(
  file: File,
  bankPreset: string,
  targetAccountId: string,
  targetOwnerId: string,
  categories: Account[],
  existingTxs: Transaction[] = []
): Promise<ParsedStatementRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  let rawRows: any[][] = [];

  if (extension === 'xlsx' || extension === 'xls') {
    try {
      const sheets = await readXlsxFile(file);
      const firstSheet = Array.isArray(sheets) && sheets.length > 0 ? sheets[0] : null;
      const sheetRows: any[] = firstSheet && 'data' in firstSheet ? firstSheet.data : (Array.isArray(sheets) ? sheets : []);
      rawRows = sheetRows.map((row: any) => (Array.isArray(row) ? row.map((cell: any) => (cell === null || cell === undefined ? '' : cell)) : []));
    } catch {
      // Fallback: If read-excel-file fails (e.g. CSV/HTML disguised with xls extension), try reading as text
      const text = await readTextWithTurkishEncoding(file);
      const parsed = Papa.parse<string[]>(text, {
        skipEmptyLines: 'greedy',
      });
      rawRows = parsed.data || [];
    }
  } else {
    // CSV / TXT / TSV
    const text = await readTextWithTurkishEncoding(file);
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: 'greedy',
    });
    rawRows = parsed.data || [];
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Dosya içeriği boş veya okunamadı.');
  }

  // Find header row or starting data row
  let headerIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let balanceCol = -1;
  let typeCol = -1;

  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const rowStrings = row.map(c => String(c).trim().toLowerCase());
    
    // Look for column headers
    const dIdx = rowStrings.findIndex(c => c.includes('tarih') || c === 'date' || c.includes('işlem tarihi') || c.includes('valör') || c.includes('zaman'));
    const descIdx = rowStrings.findIndex(c => c.includes('açıklama') || c.includes('aciklama') || c.includes('işlem') || c === 'description' || c.includes('detay') || c.includes('tanım') || c.includes('üye işyeri'));
    const amtIdx = rowStrings.findIndex(c => (c.includes('tutar') || c === 'amount' || c.includes('işlem tutarı')) && !c.includes('bakiye'));
    const debIdx = rowStrings.findIndex(c => c.includes('borç') || c.includes('borc') || c.includes('çekilen') || c.includes('gider') || c.includes('harcama'));
    const crdIdx = rowStrings.findIndex(c => c.includes('alacak') || c.includes('yatırılan') || c.includes('gelir') || c.includes('tahsilat'));
    const balIdx = rowStrings.findIndex(c => c.includes('bakiye') || c === 'balance');
    const tIdx = rowStrings.findIndex(c => c.includes('tür') || c.includes('tip') || c === 'type' || c.includes('işlem türü') || c.includes('kanal'));

    if (dIdx !== -1 && (descIdx !== -1 || amtIdx !== -1 || debIdx !== -1)) {
      headerIndex = i;
      dateCol = dIdx;
      descCol = descIdx;
      amountCol = amtIdx;
      debitCol = debIdx;
      creditCol = crdIdx;
      balanceCol = balIdx;
      typeCol = tIdx;
      break;
    }
  }

  // If no header found, guess based on data structure
  if (headerIndex === -1) {
    headerIndex = 0;
    // Check first 5 rows to guess columns
    for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c]).trim();
        if (dateCol === -1 && /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(val)) {
          dateCol = c;
        } else if (amountCol === -1 && /^[-+]?[\d.,]+$/.test(val.replace(/[₺$€TL\s]/gi, '')) && val.length > 0) {
          amountCol = c;
        } else if (descCol === -1 && val.length > 4 && isNaN(Number(val))) {
          descCol = c;
        }
      }
    }
  }

  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1;
  if (amountCol === -1 && debitCol === -1) amountCol = 2;

  const defaultExpenseCat = categories.find(c => c.type === 'expense')?.id || 'market';
  const defaultIncomeCat = categories.find(c => c.type === 'income')?.id || 'maas';

  const result: ParsedStatementRow[] = [];

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawDate = row[dateCol];
    const rawDesc = descCol !== -1 ? row[descCol] : 'Hesap Hareketi';
    const rawAmount = amountCol !== -1 ? row[amountCol] : undefined;
    const rawDebit = debitCol !== -1 ? row[debitCol] : undefined;
    const rawCredit = creditCol !== -1 ? row[creditCol] : undefined;
    const rawBalance = balanceCol !== -1 ? row[balanceCol] : undefined;
    const rawType = typeCol !== -1 ? String(row[typeCol]).trim() : '';

    const description = String(rawDesc || '').trim();
    if (!description && !rawDate && !rawAmount && !rawDebit && !rawCredit) continue;

    // Skip footer summaries like "Toplam Borç: ...", "Devir Bakiye", etc.
    const descLower = description.toLowerCase();
    if (descLower.includes('toplam') || descLower.includes('dönem sonu bakiye') || descLower.includes('devreden') || descLower.includes('sayfa')) {
      if (!rawDate) continue;
    }

    const date = parseTurkishDate(rawDate);
    if (isNaN(date.getTime())) continue;

    let finalAmount = 0;
    let isIncome = false;

    if (debitCol !== -1 && creditCol !== -1 && (rawDebit || rawCredit)) {
      const debitParsed = parseTurkishNumber(rawDebit);
      const creditParsed = parseTurkishNumber(rawCredit);

      if (creditParsed.amount > 0) {
        finalAmount = creditParsed.amount;
        isIncome = true;
      } else if (debitParsed.amount > 0) {
        finalAmount = debitParsed.amount;
        isIncome = false;
      }
    } else {
      const parsed = parseTurkishNumber(rawAmount);
      finalAmount = parsed.amount;

      // Determine income vs expense
      if (parsed.isNegative) {
        isIncome = false;
      } else if (rawType.toLowerCase().includes('gelir') || rawType.toLowerCase().includes('alacak') || rawType.toLowerCase().includes('yatırılan') || rawType.toLowerCase().includes('tahsilat')) {
        isIncome = true;
      } else if (rawType.toLowerCase().includes('gider') || rawType.toLowerCase().includes('borç') || rawType.toLowerCase().includes('harcama') || rawType.toLowerCase().includes('çekilen')) {
        isIncome = false;
      } else if (descLower.includes('maaş') || descLower.includes('gelen havale') || descLower.includes('gelen eft') || descLower.includes('fast gelen') || descLower.includes('alacak faizi')) {
        isIncome = true;
      } else {
        // By default in statements, positive is money coming in or expense depending on account type.
        // For credit cards, statement amounts are typically expenses.
        isIncome = false;
      }
    }

    if (finalAmount <= 0) continue;

    const balanceParsed = balanceCol !== -1 ? parseTurkishNumber(rawBalance).amount : undefined;
    const suggestedCatId = suggestCategory(description, categories, defaultExpenseCat, defaultIncomeCat, isIncome);
    const duplicate = isPotentialDuplicate(date, finalAmount, description, existingTxs);

    result.push({
      id: `parsed-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      originalDate: String(rawDate || ''),
      date,
      description: description || 'Banka Hareketi',
      amount: finalAmount,
      type: isIncome ? 'income' : 'expense',
      rawType,
      balance: balanceParsed,
      suggestedCategoryId: suggestedCatId,
      selectedCategoryId: suggestedCatId,
      selectedAccountId: targetAccountId,
      selectedOwnerId: targetOwnerId,
      isDuplicate: duplicate,
      selected: !duplicate, // Don't pre-check potential duplicates
      notes: ''
    });
  }

  return result;
}
