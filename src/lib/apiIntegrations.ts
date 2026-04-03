import CryptoJS from 'crypto-js';
import { Account, Transaction } from '../types';
import { createLedgerTransaction, updateAccount } from './ledger';
import { db, collection, addDoc } from './firebase';

export interface ApiSyncResult {
  balance?: number;
  transactions?: any[];
  error?: string;
}

/**
 * Syncs an account with its connected API
 */
export async function syncAccountWithApi(householdId: string, account: Account): Promise<ApiSyncResult> {
  return { error: 'No API integration currently active' };
}
