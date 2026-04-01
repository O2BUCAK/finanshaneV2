import CryptoJS from 'crypto-js';

// In a real app, this key should be derived from user password or stored securely
// For this demo, we generate a unique device key stored in localStorage
const getDeviceKey = () => {
  let key = localStorage.getItem('device_encryption_key');
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem('device_encryption_key', key);
  }
  return key;
};

export const encryptData = (data: any): string => {
  const key = getDeviceKey();
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

export const decryptData = (ciphertext: string): any => {
  const key = getDeviceKey();
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData);
};
