import CryptoJS from 'crypto-js';

/**
 * Enhanced Client-Side AES-256 Encryption & Privacy Hardening
 * Uses device-bound secret key + PBKDF2 salt derivation for encrypting sensitive fields (notes, IBANs, local store)
 */

const SALT = 'FinansHane_Sec_Salt_2026';

const getDeviceKey = (): string => {
  try {
    let key = localStorage.getItem('device_encryption_key');
    if (!key) {
      key = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      localStorage.setItem('device_encryption_key', key);
    }
    // Derive key using PBKDF2 with 1000 iterations for defense-in-depth
    return CryptoJS.PBKDF2(key, SALT, { keySize: 256 / 32, iterations: 1000 }).toString();
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
    const key = getDeviceKey();
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(payload, key).toString();
  } catch (err) {
    console.warn('Encryption warning:', err);
    return '';
  }
};

/**
 * Decrypts AES-256 ciphertext with error-safe recovery
 */
export const decryptData = (ciphertext: string): any => {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  try {
    const key = getDeviceKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
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
