import { localDB } from '../db';
import { ExpenseSource, ExpectedExpense } from '../types';
import { db, doc, setDoc, deleteDoc } from './firebase';

export async function createExpenseSource(householdId: string, sourceData: Omit<ExpenseSource, 'id' | 'createdAt'>) {
  try {
    const id = `es-${Date.now()}`;
    const now = new Date();
    
    const newSource = {
      ...sourceData,
      id,
      createdAt: now,
    } as ExpenseSource;

    await localDB.expenseSources.add(newSource);
    await setDoc(doc(db, `households/${householdId}/expenseSources/${id}`), newSource);

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
    console.error('Error creating expense source:', error);
    throw error;
  }
}

export async function updateExpenseSource(householdId: string, sourceId: string, updates: Partial<ExpenseSource>) {
  try {
    await localDB.expenseSources.update(sourceId, updates);
    await setDoc(doc(db, `households/${householdId}/expenseSources/${sourceId}`), updates, { merge: true });

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
    console.error('Error updating expense source:', error);
    throw error;
  }
}

export async function deleteExpenseSource(householdId: string, sourceId: string) {
  try {
    await localDB.expenseSources.delete(sourceId);
    await deleteDoc(doc(db, `households/${householdId}/expenseSources/${sourceId}`));

    // Also delete pending expected expenses for this source
    const pending = await localDB.expectedExpenses
      .where('sourceId').equals(sourceId)
      .and(ee => ee.status === 'pending')
      .toArray();
    
    for (const ee of pending) {
      await deleteExpectedExpense(householdId, ee.id);
    }
  } catch (error) {
    console.error('Error deleting expense source:', error);
    throw error;
  }
}

export async function createExpectedExpense(householdId: string, expenseData: Omit<ExpectedExpense, 'id' | 'createdAt'>) {
  try {
    const id = `ee-${Date.now()}`;
    const now = new Date();
    
    const newExpected = {
      ...expenseData,
      id,
      createdAt: now,
    } as ExpectedExpense;

    await localDB.expectedExpenses.add(newExpected);
    await setDoc(doc(db, `households/${householdId}/expectedExpenses/${id}`), newExpected);
    return newExpected;
  } catch (error) {
    console.error('Error creating expected expense:', error);
    throw error;
  }
}

export async function updateExpectedExpense(householdId: string, expenseId: string, updates: Partial<ExpectedExpense>) {
  try {
    await localDB.expectedExpenses.update(expenseId, updates);
    await setDoc(doc(db, `households/${householdId}/expectedExpenses/${expenseId}`), updates, { merge: true });
  } catch (error) {
    console.error('Error updating expected expense:', error);
    throw error;
  }
}

export async function deleteExpectedExpense(householdId: string, expenseId: string) {
  try {
    await localDB.expectedExpenses.delete(expenseId);
    await deleteDoc(doc(db, `households/${householdId}/expectedExpenses/${expenseId}`));
  } catch (error) {
    console.error('Error deleting expected expense:', error);
    throw error;
  }
}
