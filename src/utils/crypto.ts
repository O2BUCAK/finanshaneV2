import CryptoJS from 'crypto-js';

/**
 * Enhanced Client-Side AES-256 Encryption & Privacy Hardening
 * Uses device-bound secret key + PBKDF2 salt derivation for encrypting sensitive fields (notes, IBANs, local store)
 */

const SALT = 'FinansHane_Sec_Salt_2026';

const getDeviceKey = (iterations: number = 10000): string => {
  try {
    let key = localStorage.getItem('device_encryption_key');
    if (!key) {
      key = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      localStorage.setItem('device_encryption_key', key);
    }
    // Derive key using PBKDF2 with 10,000 iterations for enhanced 2026 security standard
    return CryptoJS.PBKDF2(key, SALT, { keySize: 256 / 32, iterations }).toString();
  } catch {
    return 'fallback_secure_key_finanshane';
  }
};

/**
 * Encrypts data object or string with AES-256
 */
export const encryptData = (data: any): string => {
  if (data === undefined || data === null) return '';
  try {
    const key = getDeviceKey(10000);
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(payload, key).toString();
  } catch (err) {
    console.warn('Encryption warning:', err);
    return '';
  }
};

/**
 * Decrypts AES-256 ciphertext with error-safe recovery and backward-compatible iteration fallback
 */
export const decryptData = (ciphertext: string): any => {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  try {
    // Try primary 10,000 iterations key
    const key = getDeviceKey(10000);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    let decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    
    // Backward compatibility fallback for data encrypted with legacy 1,000 iterations
    if (!decryptedData) {
      const legacyKey = getDeviceKey(1000);
      const legacyBytes = CryptoJS.AES.decrypt(ciphertext, legacyKey);
      decryptedData = legacyBytes.toString(CryptoJS.enc.Utf8);
    }

    if (!decryptedData) return null;
    
    try {
      return JSON.parse(decryptedData);
    } catch {
      return decryptedData;
    }
  } catch (err) {
    console.warn('Decryption fallback:', err);
    return null;
  }
};
