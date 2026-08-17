/**
 * FinansHane Security & Sanitization Utilities
 * KVKK and Information Security Hardening (2026 Standards)
 */

/**
 * Escapes HTML characters to prevent XSS (Cross-Site Scripting)
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Sanitizes user input string: trims, removes control characters, and enforces length
 */
export function sanitizeInput(str: string, maxLength: number = 255): string {
  if (!str || typeof str !== 'string') return '';
  // Remove ASCII control characters (0-31 except \n and \t) and null bytes
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, maxLength);
}

/**
 * Masks sensitive financial information (IBAN, Credit Card, Personal Notes) for safe display
 */
export function maskIban(iban: string): string {
  if (!iban || typeof iban !== 'string') return '';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (clean.length < 10) return 'TR** ****';
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start} **** **** **** **** ${end}`;
}

export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || typeof cardNumber !== 'string') return '';
  const clean = cardNumber.replace(/\s+/g, '');
  if (clean.length < 8) return '**** ****';
  const end = clean.slice(-4);
  return `**** **** **** ${end}`;
}

export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '***@***.com';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user.charAt(0)}*@${domain}`;
  }
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

/**
 * Validates file upload for security: Size, Extension, and MIME type
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt'];
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/csv',
  'text/x-csv',
  'application/octet-stream' // sometimes returned for csv/xlsx by browsers
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateUploadedFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'Dosya seçilmedi.' };
  }

  // 1. File size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { 
      valid: false, 
      error: `Dosya boyutu çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Güvenlik sebebiyle maksimum dosya boyutu 5 MB'dir.` 
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Dosya içeriği boş.' };
  }

  // 2. Extension check
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return { 
      valid: false, 
      error: `Geçersiz dosya uzantısı. Yalnızca .CSV, .XLSX, .XLS ve .TXT ekstre dosyaları kabul edilir.` 
    };
  }

  // 3. MIME type check
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `Geçersiz dosya türü (${file.type}). Lütfen geçerli bir banka hesap ekstresi yükleyin.` 
    };
  }

  return { valid: true };
}
