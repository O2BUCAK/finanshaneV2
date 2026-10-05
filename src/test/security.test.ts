import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeInput, maskIban, maskCardNumber, maskEmail } from '../utils/security';
import { encryptData, decryptData } from '../utils/crypto';

describe('Security & Sanitization Utilities', () => {
  it('escapes HTML tags to prevent XSS attacks', () => {
    const raw = '<script>alert("xss")</script>&"\'';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
  });

  it('sanitizes input and strips ASCII control characters', () => {
    const dangerous = 'Normal Text\x00\x08\x1F With Hidden Chars   ';
    const sanitized = sanitizeInput(dangerous, 20);
    expect(sanitized).toBe('Normal Text With Hid');
  });

  it('masks IBAN numbers according to KVKK privacy standards', () => {
    const iban = 'TR330006100519789012345678';
    const masked = maskIban(iban);
    expect(masked).toBe('TR33 **** **** **** **** 5678');
  });

  it('masks credit card numbers safely', () => {
    const card = '5428 1234 5678 9012';
    const masked = maskCardNumber(card);
    expect(masked).toBe('**** **** **** 9012');
  });

  it('masks user emails according to KVKK standards', () => {
    const email = 'ersinozbucak@gmail.com';
    const masked = maskEmail(email);
    expect(masked).toBe('er***k@gmail.com');
  });

  it('encrypts and decrypts sensitive data correctly with AES-256', () => {
    const secret = { iban: 'TR123456', note: 'Gizli Aile Notu' };
    const encrypted = encryptData(secret);
    expect(encrypted).not.toBe('');
    expect(encrypted).not.toContain('Gizli Aile Notu');

    const decrypted = decryptData(encrypted);
    expect(decrypted).toEqual(secret);
  });
});
