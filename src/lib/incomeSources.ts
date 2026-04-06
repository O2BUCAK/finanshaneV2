import { localDB } from '../db';
import { IncomeSource, ExpectedIncome } from '../types';
import { db, doc, setDoc, collection, deleteDoc } from './firebase';
import { isHoliday } from '../utils/holidays';

export function calculateMonthlyAmountFromDailyRate(dailyRate: number, workDaysPerWeek: number, month: number, year: number): number {
  let count = 0;
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const day = date.getDay();
    const isPublicHoliday = isHoliday(date);
    
    if (!isPublicHoliday) {
      if (workDaysPerWeek === 5) {
        if (day !== 0 && day !== 6) count++;
      } else {
        if (day !== 0) count++;
      }
    }
    date.setDate(date.getDate() + 1);
  }
  return dailyRate * count;
}

export async function createIncomeSource(householdId: string, sourceData: Omit<IncomeSource, 'id' | 'createdAt'>) {
  try {
    const id = `is-${Date.now()}`;
    const now = new Date();
    
    let finalAmount = sourceData.amount;
    if (sourceData.calculationType === 'daily_rate' && sourceData.dailyRate && sourceData.workDaysPerWeek && sourceData.periodDay) {
      const nextDate = new Date();
      nextDate.setDate(sourceData.periodDay);
      if (nextDate < new Date()) nextDate.setMonth(nextDate.getMonth() + 1);
      finalAmount = calculateMonthlyAmountFromDailyRate(sourceData.dailyRate, sourceData.workDaysPerWeek, nextDate.getMonth(), nextDate.getFullYear());
    }

    const newSource = {
      ...sourceData,
      amount: finalAmount,
      id,
      createdAt: now,
    } as IncomeSource;

    // Remove undefined fields for Firestore
    const firestoreData = JSON.parse(JSON.stringify(newSource));

    // Save to localDB
    await localDB.incomeSources.add(newSource);

    // Save to Firestore
    await setDoc(doc(db, `households/${householdId}/incomeSources/${id}`), firestoreData);

    // Generate first expected income if it's not spot
    if (sourceData.flowType !== 'spot' && sourceData.periodDay) {
      const expectedDate = new Date();
      expectedDate.setDate(sourceData.periodDay);
      if (expectedDate < new Date()) expectedDate.setMonth(expectedDate.getMonth() + 1);

      await createExpectedIncome(householdId, {
        sourceId: id,
        sourceName: sourceData.name,
        amount: finalAmount,
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
    const current = await localDB.incomeSources.get(sourceId);
    if (!current) throw new Error('Income source not found');

    const merged = { ...current, ...updates };
    let finalAmount = merged.amount;

    if (merged.calculationType === 'daily_rate' && merged.dailyRate && merged.workDaysPerWeek && merged.periodDay) {
      const nextDate = new Date();
      nextDate.setDate(merged.periodDay);
      if (nextDate < new Date()) nextDate.setMonth(nextDate.getMonth() + 1);
      finalAmount = calculateMonthlyAmountFromDailyRate(merged.dailyRate, merged.workDaysPerWeek, nextDate.getMonth(), nextDate.getFullYear());
    }

    const finalUpdates = { ...updates, amount: finalAmount };

    // Remove undefined fields for Firestore
    const firestoreUpdates = JSON.parse(JSON.stringify(finalUpdates));

    await localDB.incomeSources.update(sourceId, finalUpdates);
    await setDoc(doc(db, `households/${householdId}/incomeSources/${sourceId}`), firestoreUpdates, { merge: true });

    // If name or amount is updated, update all related expected incomes
    if (finalUpdates.name || finalUpdates.amount !== current.amount) {
      const relatedExpected = await localDB.expectedIncomes
        .where('sourceId').equals(sourceId)
        .toArray();
      
      for (const ei of relatedExpected) {
        if (ei.status === 'pending') {
          const up: any = {};
          if (finalUpdates.name) up.sourceName = finalUpdates.name;
          if (finalUpdates.amount !== current.amount) up.amount = finalAmount;
          await updateExpectedIncome(householdId, ei.id, up);
        }
      }
    }
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
