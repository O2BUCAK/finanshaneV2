import { localDB } from '../db';
import { IncomeSource, ExpectedIncome } from '../types';
import { db, doc, setDoc, collection, deleteDoc } from './firebase';

export async function createIncomeSource(householdId: string, sourceData: Omit<IncomeSource, 'id' | 'createdAt'>) {
  try {
    const id = `is-${Date.now()}`;
    const now = new Date();
    
    const newSource = {
      ...sourceData,
      id,
      createdAt: now,
    } as IncomeSource;

    // Save to localDB
    await localDB.incomeSources.add(newSource);

    // Save to Firestore
    await setDoc(doc(db, `households/${householdId}/incomeSources/${id}`), newSource);

    // Generate first expected income if it's not spot
    if (sourceData.flowType !== 'spot' && sourceData.periodDay) {
      const expectedDate = new Date();
      expectedDate.setDate(sourceData.periodDay);
      if (expectedDate < new Date()) expectedDate.setMonth(expectedDate.getMonth() + 1);

      await createExpectedIncome(householdId, {
        sourceId: id,
        sourceName: sourceData.name,
        amount: sourceData.amount,
        currency: sourceData.currency,
        expectedDate,
        status: 'pending',
        targetAccountId: sourceData.targetAccountId,
        ownerId: sourceData.ownerId,
      });
    }

    return newSource;
  } catch (error) {
    console.error('Error creating income source:', error);
    throw error;
  }
}

export async function updateIncomeSource(householdId: string, sourceId: string, updates: Partial<IncomeSource>) {
  try {
    await localDB.incomeSources.update(sourceId, updates);
    await setDoc(doc(db, `households/${householdId}/incomeSources/${sourceId}`), updates, { merge: true });
  } catch (error) {
    console.error('Error updating income source:', error);
    throw error;
  }
}

export async function deleteIncomeSource(householdId: string, sourceId: string) {
  try {
    // Delete from localDB
    await localDB.incomeSources.delete(sourceId);
    
    // Delete from Firestore
    await deleteDoc(doc(db, `households/${householdId}/incomeSources/${sourceId}`));

    // Also delete pending expected incomes for this source
    const pending = await localDB.expectedIncomes
      .where('sourceId').equals(sourceId)
      .and(ee => ee.status === 'pending')
      .toArray();
    
    for (const ee of pending) {
      await deleteExpectedIncome(householdId, ee.id);
    }
  } catch (error) {
    console.error('Error deleting income source:', error);
    throw error;
  }
}

export async function createExpectedIncome(householdId: string, incomeData: Omit<ExpectedIncome, 'id' | 'createdAt'>) {
  try {
    const id = `ei-${Date.now()}`;
    const now = new Date();
    
    const newExpected = {
      ...incomeData,
      id,
      createdAt: now,
    } as ExpectedIncome;

    await localDB.expectedIncomes.add(newExpected);
    await setDoc(doc(db, `households/${householdId}/expectedIncomes/${id}`), newExpected);
    
    return newExpected;
  } catch (error) {
    console.error('Error creating expected income:', error);
    throw error;
  }
}

export async function updateExpectedIncome(householdId: string, incomeId: string, updates: Partial<ExpectedIncome>) {
  try {
    await localDB.expectedIncomes.update(incomeId, updates);
    await setDoc(doc(db, `households/${householdId}/expectedIncomes/${incomeId}`), updates, { merge: true });
  } catch (error) {
    console.error('Error updating expected income:', error);
    throw error;
  }
}

export async function deleteExpectedIncome(householdId: string, incomeId: string) {
  try {
    await localDB.expectedIncomes.delete(incomeId);
    await deleteDoc(doc(db, `households/${householdId}/expectedIncomes/${incomeId}`));
  } catch (error) {
    console.error('Error deleting expected income:', error);
    throw error;
  }
}
