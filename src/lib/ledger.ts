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

  try {
    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const debitAccount = await localDB.accounts.get(txData.debitAccountId);
      const creditAccount = await localDB.accounts.get(txData.creditAccountId);
      
      if (!debitAccount) {
        throw new Error(`Hesap bulunamadı (Borç): ${txData.debitAccountId}`);
      }
      if (!creditAccount) {
        throw new Error(`Hesap bulunamadı (Alacak): ${txData.creditAccountId}`);
      }
      
      await localDB.transactions.add(newTx);
      
      const updateBalance = (account: Account, amount: number, isDebit: boolean) => {
        const type = account.type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.balance + (amount * multiplier);
      };

      await localDB.accounts.update(txData.debitAccountId, {
        balance: updateBalance(debitAccount, txData.amount, true)
      });
      
      await localDB.accounts.update(txData.creditAccountId, {
        balance: updateBalance(creditAccount, txData.amount, false)
      });
    });

    // Sync to Firestore
    const path = `households/${householdId}/transactions/${id}`;
    try {
      await setDoc(doc(db, path), newTx);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
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
    return await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const debitAccount = await localDB.accounts.get(txData.debitAccountId);
      const creditAccount = await localDB.accounts.get(txData.creditAccountId);
      
      if (!debitAccount) {
        throw new Error(`Hesap bulunamadı (Borç): ${txData.debitAccountId}`);
      }
      if (!creditAccount) {
        throw new Error(`Hesap bulunamadı (Alacak): ${txData.creditAccountId}`);
      }

      const parentId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ptx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const baseDate = new Date(txData.date);
      
      const updateBalance = (account: Account, amount: number, isDebit: boolean) => {
        const type = account.type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.balance + (amount * multiplier);
      };

      let currentDebitBalance = debitAccount.balance;
      let currentCreditBalance = creditAccount.balance;

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

        if (installmentDate <= now) {
          currentDebitBalance = updateBalance({ ...debitAccount, balance: currentDebitBalance }, installmentAmount, true);
          currentCreditBalance = updateBalance({ ...creditAccount, balance: currentCreditBalance }, installmentAmount, false);
        }
      }

      await localDB.accounts.update(txData.debitAccountId, { balance: currentDebitBalance });
      await localDB.accounts.update(txData.creditAccountId, { balance: currentCreditBalance });
      
      return parentId;
    });
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
    await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const tx = await localDB.transactions.get(transactionId);
      if (!tx) throw new Error('İşlem bulunamadı');
      
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
        await localDB.accounts.update(tx.debitAccountId, {
          balance: reverseBalance(debitAccount, tx.amount, true)
        });
      }
      
      if (creditAccount) {
        await localDB.accounts.update(tx.creditAccountId, {
          balance: reverseBalance(creditAccount, tx.amount, false)
        });
      }
      
      await localDB.transactions.delete(transactionId);
    });

    // Sync to Firestore
    await deleteDoc(doc(db, `households/${householdId}/transactions/${transactionId}`));
  } catch (error) {
    console.error('Delete transaction error:', error);
    throw error;
  }
}

export async function updateLedgerTransaction(
  householdId: string,
  transactionId: string,
  newTxData: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
) {
  try {
    return await localDB.transaction('rw', [localDB.accounts, localDB.transactions], async () => {
      const oldTx = await localDB.transactions.get(transactionId);
      if (!oldTx) throw new Error('İşlem bulunamadı');
      
      const mergedTx = { ...oldTx, ...newTxData };
      
      const accountIds = Array.from(new Set([
        oldTx.debitAccountId, 
        oldTx.creditAccountId, 
        mergedTx.debitAccountId, 
        mergedTx.creditAccountId
      ]));
      
      const accounts: Record<string, Account> = {};
      const balances: Record<string, number> = {};

      for (const id of accountIds) {
        const acc = await localDB.accounts.get(id);
        if (!acc) throw new Error(`Hesap bulunamadı: ${id}`);
        accounts[id] = acc;
        balances[id] = acc.balance;
      }

      const getMultiplier = (type: string, isDebit: boolean) => {
        return (type === 'asset' || type === 'expense') ? (isDebit ? 1 : -1) : (isDebit ? -1 : 1);
      };

      balances[oldTx.debitAccountId] -= oldTx.amount * getMultiplier(accounts[oldTx.debitAccountId].type, true);
      balances[oldTx.creditAccountId] -= oldTx.amount * getMultiplier(accounts[oldTx.creditAccountId].type, false);

      balances[mergedTx.debitAccountId] += mergedTx.amount * getMultiplier(accounts[mergedTx.debitAccountId].type, true);
      balances[mergedTx.creditAccountId] += mergedTx.amount * getMultiplier(accounts[mergedTx.creditAccountId].type, false);

      for (const id of accountIds) {
        await localDB.accounts.update(id, { balance: balances[id] });
      }

      await localDB.transactions.update(transactionId, {
        ...newTxData,
        updatedAt: new Date()
      });
    });
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
  } catch (error) {
    console.error('Update account error:', error);
    throw error;
  }
}
