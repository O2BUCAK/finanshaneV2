import { localDB } from '../db';
import { Transaction, Account } from '../types';
import { db, doc, deleteDoc, setDoc, handleFirestoreError, OperationType } from './firebase';

export async function createLedgerTransaction(
  householdId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
) {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  
  const newTx: Transaction = {
    ...txData,
    id,
    createdAt: now,
    updatedAt: now
  };

  let debitBalance: number | undefined;
  let creditBalance: number | undefined;

  try {
    let debitAccount: Account | undefined;
    let creditAccount: Account | undefined;

    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      debitAccount = await localDB.accounts.get(txData.debitAccountId);
      creditAccount = await localDB.accounts.get(txData.creditAccountId);
      
      await localDB.transactions.add(newTx);
      
      const updateBalance = (account: Account, amount: number, isDebit: boolean) => {
        const type = account.type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.balance + (amount * multiplier);
      };

      if (debitAccount) {
        debitBalance = updateBalance(debitAccount, txData.amount, true);
        await localDB.accounts.update(txData.debitAccountId, {
          balance: debitBalance
        });
      }

      if (creditAccount) {
        creditBalance = updateBalance(creditAccount, txData.amount, false);
        await localDB.accounts.update(txData.creditAccountId, {
          balance: creditBalance
        });
      }
    });

    // Sync to Firestore outside Dexie transaction callback
    if (householdId && householdId.trim() !== '') {
      const path = `households/${householdId}/transactions/${id}`;
      try {
        await setDoc(doc(db, path), newTx);
        if (debitAccount && debitBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${txData.debitAccountId}`), { balance: debitBalance }, { merge: true });
        }
        if (creditAccount && creditBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${txData.creditAccountId}`), { balance: creditBalance }, { merge: true });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    }
    
    return id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Ledger transaction error:', error);
    throw error;
  }
}

export async function createInstallmentTransactions(
  householdId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isInstallment' | 'installmentCount' | 'installmentNumber' | 'parentTransactionId'>,
  installmentCount: number
) {
  try {
    const parentId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ptx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const createdTxs: Transaction[] = [];
    let finalDebitBalance: number | undefined;
    let finalCreditBalance: number | undefined;

    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const debitAccount = await localDB.accounts.get(txData.debitAccountId);
      const creditAccount = await localDB.accounts.get(txData.creditAccountId);

      const now = new Date();
      const baseDate = new Date(txData.date);
      
      const updateBalance = (account: Account, amount: number, isDebit: boolean) => {
        const type = account.type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.balance + (amount * multiplier);
      };

      let currentDebitBalance = debitAccount ? debitAccount.balance : 0;
      let currentCreditBalance = creditAccount ? creditAccount.balance : 0;

      for (let i = 1; i <= installmentCount; i++) {
        const id = i === 1 ? parentId : (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `itx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));
        
        const installmentAmount = txData.amount / installmentCount;
        
        const newTx: Transaction = {
          ...txData,
          id,
          amount: installmentAmount,
          date: installmentDate,
          isInstallment: true,
          installmentCount,
          installmentNumber: i,
          parentTransactionId: parentId,
          createdAt: now,
          updatedAt: now
        };

        await localDB.transactions.add(newTx);
        createdTxs.push(newTx);

        if (installmentDate <= now) {
          if (debitAccount) {
            currentDebitBalance = updateBalance({ ...debitAccount, balance: currentDebitBalance }, installmentAmount, true);
          }
          if (creditAccount) {
            currentCreditBalance = updateBalance({ ...creditAccount, balance: currentCreditBalance }, installmentAmount, false);
          }
        }
      }

      if (debitAccount) {
        await localDB.accounts.update(txData.debitAccountId, { balance: currentDebitBalance });
        finalDebitBalance = currentDebitBalance;
      }
      if (creditAccount) {
        await localDB.accounts.update(txData.creditAccountId, { balance: currentCreditBalance });
        finalCreditBalance = currentCreditBalance;
      }
    });

    // Sync to Firestore outside Dexie transaction callback
    if (householdId && householdId.trim() !== '') {
      for (const tx of createdTxs) {
        const path = `households/${householdId}/transactions/${tx.id}`;
        try {
          await setDoc(doc(db, path), tx);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, path);
        }
      }

      try {
        if (finalDebitBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${txData.debitAccountId}`), { balance: finalDebitBalance }, { merge: true });
        }
        if (finalCreditBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${txData.creditAccountId}`), { balance: finalCreditBalance }, { merge: true });
        }
      } catch (e) {
        console.error("Error updating account balance in firestore:", e);
      }
    }
    
    return parentId;
  } catch (error) {
    console.error('Installment transaction error:', error);
    throw error;
  }
}

export async function deleteLedgerTransaction(
  householdId: string,
  transactionId: string
) {
  try {
    let debitAccountId: string | undefined;
    let debitBalance: number | undefined;
    let creditAccountId: string | undefined;
    let creditBalance: number | undefined;

    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const tx = await localDB.transactions.get(transactionId);
      if (!tx) return;
      
      debitAccountId = tx.debitAccountId;
      creditAccountId = tx.creditAccountId;

      const debitAccount = await localDB.accounts.get(tx.debitAccountId);
      const creditAccount = await localDB.accounts.get(tx.creditAccountId);
      
      const reverseBalance = (account: Account, amount: number, isDebit: boolean) => {
        const type = account.type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? -1 : 1) 
          : (isDebit ? 1 : -1);
        return account.balance + (amount * multiplier);
      };

      if (debitAccount) {
        debitBalance = reverseBalance(debitAccount, tx.amount, true);
        await localDB.accounts.update(tx.debitAccountId, {
          balance: debitBalance
        });
      }
      
      if (creditAccount) {
        creditBalance = reverseBalance(creditAccount, tx.amount, false);
        await localDB.accounts.update(tx.creditAccountId, {
          balance: creditBalance
        });
      }
      
      await localDB.transactions.delete(transactionId);
    });

    // Sync to Firestore safely if householdId is present outside Dexie transaction
    if (householdId && householdId.trim() !== '') {
      try {
        await deleteDoc(doc(db, `households/${householdId}/transactions/${transactionId}`));
        if (debitAccountId && debitBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${debitAccountId}`), { balance: debitBalance }, { merge: true });
        }
        if (creditAccountId && creditBalance !== undefined) {
          await setDoc(doc(db, `households/${householdId}/accounts/${creditAccountId}`), { balance: creditBalance }, { merge: true });
        }
      } catch (e) {
        console.warn("Firestore deleteDoc error:", e);
      }
    }
  } catch (error) {
    console.error('Delete transaction error:', error);
    throw error;
  }
}

export async function deleteInstallmentGroup(
  householdId: string,
  parentTransactionId: string
) {
  try {
    const allTxs = await localDB.transactions
      .filter(t => t.parentTransactionId === parentTransactionId)
      .toArray();

    const parentTx = await localDB.transactions.get(parentTransactionId);
    
    const txsToDeleteMap = new Map<string, Transaction>();
    if (parentTx) txsToDeleteMap.set(parentTx.id, parentTx);
    allTxs.forEach(t => txsToDeleteMap.set(t.id, t));

    for (const tx of txsToDeleteMap.values()) {
      await deleteLedgerTransaction(householdId, tx.id);
    }
  } catch (error) {
    console.error('Delete installment group error:', error);
    throw error;
  }
}

export async function updateLedgerTransaction(
  householdId: string,
  transactionId: string,
  newTxData: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
) {
  try {
    let updatedTx: Transaction | undefined;
    let balancesToSync: Record<string, number> = {};

    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const oldTx = await localDB.transactions.get(transactionId);
      if (!oldTx) throw new Error('İşlem bulunamadı');
      
      const mergedTx = { ...oldTx, ...newTxData, updatedAt: new Date() };
      updatedTx = mergedTx;

      const accountIds = Array.from(new Set([
        oldTx.debitAccountId, 
        oldTx.creditAccountId, 
        mergedTx.debitAccountId, 
        mergedTx.creditAccountId
      ])).filter(Boolean);
      
      const accounts: Record<string, Account> = {};
      const balances: Record<string, number> = {};

      for (const id of accountIds) {
        const acc = await localDB.accounts.get(id);
        if (acc) {
          accounts[id] = acc;
          balances[id] = acc.balance;
        }
      }

      const getMultiplier = (type: string, isDebit: boolean) => {
        return (type === 'asset' || type === 'expense') ? (isDebit ? 1 : -1) : (isDebit ? -1 : 1);
      };

      if (accounts[oldTx.debitAccountId]) {
        balances[oldTx.debitAccountId] -= oldTx.amount * getMultiplier(accounts[oldTx.debitAccountId].type, true);
      }
      if (accounts[oldTx.creditAccountId]) {
        balances[oldTx.creditAccountId] -= oldTx.amount * getMultiplier(accounts[oldTx.creditAccountId].type, false);
      }

      if (accounts[mergedTx.debitAccountId]) {
        balances[mergedTx.debitAccountId] += mergedTx.amount * getMultiplier(accounts[mergedTx.debitAccountId].type, true);
      }
      if (accounts[mergedTx.creditAccountId]) {
        balances[mergedTx.creditAccountId] += mergedTx.amount * getMultiplier(accounts[mergedTx.creditAccountId].type, false);
      }

      for (const [id, bal] of Object.entries(balances)) {
        await localDB.accounts.update(id, { balance: bal });
      }

      await localDB.transactions.update(transactionId, {
        ...newTxData,
        updatedAt: new Date()
      });

      balancesToSync = balances;
    });

    // Sync to Firestore outside Dexie transaction callback
    if (householdId && householdId.trim() !== '' && updatedTx) {
      try {
        await setDoc(doc(db, `households/${householdId}/transactions/${transactionId}`), updatedTx, { merge: true });
        for (const [accId, bal] of Object.entries(balancesToSync)) {
          await setDoc(doc(db, `households/${householdId}/accounts/${accId}`), { balance: bal }, { merge: true });
        }
      } catch (e) {
        console.warn("Firestore update transaction error:", e);
      }
    }
  } catch (error) {
    console.error('Update transaction error:', error);
    throw error;
  }
}

export async function updateAccount(
  householdId: string,
  accountId: string,
  data: Partial<Account>
) {
  try {
    await localDB.accounts.update(accountId, { ...data });
    if (householdId) {
      const path = `households/${householdId}/accounts/${accountId}`;
      try {
        await setDoc(doc(db, path), data, { merge: true });
      } catch (e) {
        console.error("Error updating account in firestore:", e);
      }
    }
  } catch (error) {
    console.error('Update account error:', error);
    throw error;
  }
}

export async function deleteAccount(
  householdId: string,
  accountId: string
) {
  try {
    await localDB.accounts.delete(accountId);
    if (householdId) {
      const path = `households/${householdId}/accounts/${accountId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  } catch (error) {
    console.error('Delete account error:', error);
    throw error;
  }
}

/**
 * Syncs/Recalculates account balances from transaction history.
 * Especially fixes credit card current debt when expenses were added.
 */
export async function syncAllAccountBalances(
  householdId: string,
  accounts: Account[],
  transactions: Transaction[]
) {
  if (!householdId || !accounts || accounts.length === 0) return;

  const now = new Date();

  for (const acc of accounts) {
    // We focus on liability (credit card) accounts and asset accounts
    if (acc.type !== 'liability' && acc.type !== 'asset') continue;

    // Filter valid posted transactions up to now involving this account
    const accTxs = transactions.filter(tx => {
      const txDate = tx.date instanceof Date 
        ? tx.date 
        : (tx.date as any)?.seconds 
          ? new Date((tx.date as any).seconds * 1000) 
          : new Date(tx.date);

      if (isNaN(txDate.getTime())) return false;
      return txDate <= now && (tx.debitAccountId === acc.id || tx.creditAccountId === acc.id);
    });

    let calculatedBalance = 0;

    accTxs.forEach(tx => {
      if (tx.debitAccountId === acc.id) {
        // Debiting account
        const multiplier = (acc.type === 'asset' || acc.type === 'expense') ? 1 : -1;
        calculatedBalance += tx.amount * multiplier;
      }
      if (tx.creditAccountId === acc.id) {
        // Crediting account
        const multiplier = (acc.type === 'asset' || acc.type === 'expense') ? -1 : 1;
        calculatedBalance += tx.amount * multiplier;
      }
    });

    // If account is liability (credit card) and balance differs from calculated debt
    if (acc.type === 'liability' || acc.subType === 'credit_card') {
      if (Math.abs(acc.balance - calculatedBalance) > 0.01) {
        try {
          await localDB.accounts.update(acc.id, { balance: calculatedBalance });
          await setDoc(doc(db, `households/${householdId}/accounts/${acc.id}`), { balance: calculatedBalance }, { merge: true });
        } catch (e) {
          console.warn('Error syncing balance for credit card account:', acc.id, e);
        }
      }
    }
  }
}
