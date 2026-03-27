import { 
  collection, 
  doc, 
  runTransaction, 
  Timestamp, 
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, Account } from '../types';
import { handleFirestoreError, OperationType } from './error-handler';

export async function createLedgerTransaction(
  householdId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
) {
  try {
    return await runTransaction(db, async (transaction) => {
      const debitAccountRef = doc(db, `households/${householdId}/accounts/${txData.debitAccountId}`);
      const creditAccountRef = doc(db, `households/${householdId}/accounts/${txData.creditAccountId}`);
      
      const debitAccount = await transaction.get(debitAccountRef);
      const creditAccount = await transaction.get(creditAccountRef);
      
      if (!debitAccount.exists() || !creditAccount.exists()) {
        throw new Error('Hesap bulunamadı');
      }
      
      const txRef = doc(collection(db, `households/${householdId}/transactions`));
      const now = Timestamp.now();
      
      transaction.set(txRef, {
        ...txData,
        createdAt: now,
        updatedAt: now
      });
      
      const updateBalance = (account: any, amount: number, isDebit: boolean) => {
        const type = account.data().type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.data().balance + (amount * multiplier);
      };

      transaction.update(debitAccountRef, {
        balance: updateBalance(debitAccount, txData.amount, true)
      });
      
      transaction.update(creditAccountRef, {
        balance: updateBalance(creditAccount, txData.amount, false)
      });
      
      return txRef.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `households/${householdId}/transactions`);
  }
}

export async function createInstallmentTransactions(
  householdId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isInstallment' | 'installmentCount' | 'installmentNumber' | 'parentTransactionId'>,
  installmentCount: number
) {
  try {
    return await runTransaction(db, async (transaction) => {
      const debitAccountRef = doc(db, `households/${householdId}/accounts/${txData.debitAccountId}`);
      const creditAccountRef = doc(db, `households/${householdId}/accounts/${txData.creditAccountId}`);
      
      const debitAccount = await transaction.get(debitAccountRef);
      const creditAccount = await transaction.get(creditAccountRef);
      
      if (!debitAccount.exists() || !creditAccount.exists()) {
        throw new Error('Hesap bulunamadı');
      }

      const parentTxRef = doc(collection(db, `households/${householdId}/transactions`));
      const now = Timestamp.now();
      const baseDate = txData.date.toDate();
      
      // We only update the balance for the FIRST installment now
      // Future installments will be "realized" when their date comes? 
      // Actually, for simplicity and to match the user's "budget" request, 
      // let's just create them all. 
      // If we want them to affect balance, we update balance for each.
      // But usually, only the first one affects the current balance.
      
      const updateBalance = (account: any, amount: number, isDebit: boolean) => {
        const type = account.data().type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? 1 : -1) 
          : (isDebit ? -1 : 1);
        return account.data().balance + (amount * multiplier);
      };

      let currentDebitBalance = debitAccount.data().balance;
      let currentCreditBalance = creditAccount.data().balance;

      for (let i = 1; i <= installmentCount; i++) {
        const txRef = i === 1 ? parentTxRef : doc(collection(db, `households/${householdId}/transactions`));
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));
        
        const installmentAmount = txData.amount / installmentCount;
        
        transaction.set(txRef, {
          ...txData,
          amount: installmentAmount,
          date: Timestamp.fromDate(installmentDate),
          isInstallment: true,
          installmentCount,
          installmentNumber: i,
          parentTransactionId: parentTxRef.id,
          createdAt: now,
          updatedAt: now
        });

        // Update balance only for the first installment if it's today or in the past
        // Or should we update for all? 
        // If it's a credit card, the debt is usually added as installments hit the statement.
        // Let's only update balance for installments whose date is <= now
        if (installmentDate <= now.toDate()) {
          currentDebitBalance = updateBalance({ data: () => ({ ...debitAccount.data(), balance: currentDebitBalance }) }, installmentAmount, true);
          currentCreditBalance = updateBalance({ data: () => ({ ...creditAccount.data(), balance: currentCreditBalance }) }, installmentAmount, false);
        }
      }

      transaction.update(debitAccountRef, { balance: currentDebitBalance });
      transaction.update(creditAccountRef, { balance: currentCreditBalance });
      
      return parentTxRef.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `households/${householdId}/transactions`);
  }
}

export async function deleteLedgerTransaction(
  householdId: string,
  transactionId: string
) {
  try {
    return await runTransaction(db, async (transaction) => {
      const txRef = doc(db, `households/${householdId}/transactions/${transactionId}`);
      const txSnap = await transaction.get(txRef);
      
      if (!txSnap.exists()) throw new Error('İşlem bulunamadı');
      
      const txData = txSnap.data() as Transaction;
      const debitAccountRef = doc(db, `households/${householdId}/accounts/${txData.debitAccountId}`);
      const creditAccountRef = doc(db, `households/${householdId}/accounts/${txData.creditAccountId}`);
      
      const debitAccount = await transaction.get(debitAccountRef);
      const creditAccount = await transaction.get(creditAccountRef);
      
      const reverseBalance = (account: any, amount: number, isDebit: boolean) => {
        const type = account.data().type;
        const multiplier = (type === 'asset' || type === 'expense') 
          ? (isDebit ? -1 : 1) 
          : (isDebit ? 1 : -1);
        return account.data().balance + (amount * multiplier);
      };

      if (debitAccount.exists()) {
        transaction.update(debitAccountRef, {
          balance: reverseBalance(debitAccount, txData.amount, true)
        });
      }
      
      if (creditAccount.exists()) {
        transaction.update(creditAccountRef, {
          balance: reverseBalance(creditAccount, txData.amount, false)
        });
      }
      
      transaction.delete(txRef);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/transactions/${transactionId}`);
  }
}

export async function updateLedgerTransaction(
  householdId: string,
  transactionId: string,
  newTxData: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
) {
  try {
    return await runTransaction(db, async (transaction) => {
      const txRef = doc(db, `households/${householdId}/transactions/${transactionId}`);
      const txSnap = await transaction.get(txRef);
      if (!txSnap.exists()) throw new Error('İşlem bulunamadı');
      
      const oldTx = txSnap.data() as Transaction;
      const mergedTx = { ...oldTx, ...newTxData };
      
      const accountIds = new Set([
        oldTx.debitAccountId, 
        oldTx.creditAccountId, 
        mergedTx.debitAccountId, 
        mergedTx.creditAccountId
      ]);
      
      const accountRefs: Record<string, any> = {};
      const accountSnaps: Record<string, any> = {};
      const balances: Record<string, number> = {};

      for (const id of accountIds) {
        accountRefs[id] = doc(db, `households/${householdId}/accounts/${id}`);
        accountSnaps[id] = await transaction.get(accountRefs[id]);
        if (!accountSnaps[id].exists()) throw new Error(`Hesap bulunamadı: ${id}`);
        balances[id] = accountSnaps[id].data().balance;
      }

      const getMultiplier = (type: string, isDebit: boolean) => {
        return (type === 'asset' || type === 'expense') ? (isDebit ? 1 : -1) : (isDebit ? -1 : 1);
      };

      balances[oldTx.debitAccountId] -= oldTx.amount * getMultiplier(accountSnaps[oldTx.debitAccountId].data().type, true);
      balances[oldTx.creditAccountId] -= oldTx.amount * getMultiplier(accountSnaps[oldTx.creditAccountId].data().type, false);

      balances[mergedTx.debitAccountId] += mergedTx.amount * getMultiplier(accountSnaps[mergedTx.debitAccountId].data().type, true);
      balances[mergedTx.creditAccountId] += mergedTx.amount * getMultiplier(accountSnaps[mergedTx.creditAccountId].data().type, false);

      for (const id of accountIds) {
        transaction.update(accountRefs[id], { balance: balances[id] });
      }

      transaction.update(txRef, {
        ...newTxData,
        updatedAt: Timestamp.now()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `households/${householdId}/transactions/${transactionId}`);
  }
}

export async function updateAccount(
  householdId: string,
  accountId: string,
  data: Partial<Account>
) {
  try {
    const accRef = doc(db, `households/${householdId}/accounts/${accountId}`);
    await setDoc(accRef, { ...data, updatedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `households/${householdId}/accounts/${accountId}`);
  }
}
