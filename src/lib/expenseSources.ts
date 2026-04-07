import { localDB } from '../db';
import { ExpenseSource, ExpectedExpense } from '../types';
import { db, doc, setDoc, deleteDoc, handleFirestoreError, OperationType } from './firebase';

export async function createExpenseSource(householdId: string, sourceData: Omit<ExpenseSource, 'id' | 'createdAt'>) {
  const id = `es-${Date.now()}`;
  const now = new Date();
  
  const newSource = {
    ...sourceData,
    id,
    createdAt: now,
  } as ExpenseSource;

  try {
    await localDB.expenseSources.add(newSource);
    const path = `households/${householdId}/expenseSources/${id}`;
    try {
      await setDoc(doc(db, path), newSource);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }

    // Generate first expected expense if it's fixed or subscription
    if (sourceData.periodDay) {
      const expectedDate = new Date();
      expectedDate.setDate(sourceData.periodDay);
      if (expectedDate < new Date()) expectedDate.setMonth(expectedDate.getMonth() + 1);

      await createExpectedExpense(householdId, {
        sourceId: id,
        sourceName: sourceData.name,
        amount: sourceData.amount,
        currency: sourceData.currency,
        expectedDate,
        status: 'pending',
        sourceAccountId: sourceData.sourceAccountId,
        categoryId: sourceData.categoryId,
        ownerId: sourceData.ownerId,
      });
    }

    return newSource;
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error creating expense source:', error);
    throw error;
  }
}

export async function updateExpenseSource(householdId: string, sourceId: string, updates: Partial<ExpenseSource>) {
  try {
    await localDB.expenseSources.update(sourceId, updates);
    const path = `households/${householdId}/expenseSources/${sourceId}`;
    try {
      await setDoc(doc(db, path), updates, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }

    // If name is updated, update all related expected expenses
    if (updates.name) {
      const relatedExpected = await localDB.expectedExpenses
        .where('sourceId').equals(sourceId)
        .toArray();
      
      for (const ee of relatedExpected) {
        await updateExpectedExpense(householdId, ee.id, { sourceName: updates.name });
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error updating expense source:', error);
    throw error;
  }
}

export async function deleteExpenseSource(householdId: string, sourceId: string) {
  try {
    await localDB.expenseSources.delete(sourceId);
    const path = `households/${householdId}/expenseSources/${sourceId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }

    // Also delete pending expected expenses for this source
    const pending = await localDB.expectedExpenses
      .where('sourceId').equals(sourceId)
      .and(ee => ee.status === 'pending')
      .toArray();
    
    for (const ee of pending) {
      await deleteExpectedExpense(householdId, ee.id);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error deleting expense source:', error);
    throw error;
  }
}

export async function createExpectedExpense(householdId: string, expenseData: Omit<ExpectedExpense, 'id' | 'createdAt'>) {
  const id = `ee-${Date.now()}`;
  const now = new Date();
  
  const newExpected = {
    ...expenseData,
    id,
    createdAt: now,
  } as ExpectedExpense;

  try {
    await localDB.expectedExpenses.add(newExpected);
    const path = `households/${householdId}/expectedExpenses/${id}`;
    try {
      await setDoc(doc(db, path), newExpected);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
    return newExpected;
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error creating expected expense:', error);
    throw error;
  }
}

export async function updateExpectedExpense(householdId: string, expenseId: string, updates: Partial<ExpectedExpense>) {
  try {
    await localDB.expectedExpenses.update(expenseId, updates);
    const path = `households/${householdId}/expectedExpenses/${expenseId}`;
    try {
      await setDoc(doc(db, path), updates, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error updating expected expense:', error);
    throw error;
  }
}

export async function deleteExpectedExpense(householdId: string, expenseId: string) {
  try {
    await localDB.expectedExpenses.delete(expenseId);
    const path = `households/${householdId}/expectedExpenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error deleting expected expense:', error);
    throw error;
  }
}
