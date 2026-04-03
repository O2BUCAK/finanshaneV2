import { localDB } from '../db';
import { PlannedExpense } from '../types';
import { db, doc, setDoc, deleteDoc } from './firebase';

export async function createPlannedExpense(householdId: string, expenseData: Omit<PlannedExpense, 'id' | 'createdAt'>) {
  try {
    const id = `pe-${Date.now()}`;
    const now = new Date();
    
    const newExpense = {
      ...expenseData,
      id,
      householdId,
      createdAt: now,
    } as PlannedExpense;

    await localDB.plannedExpenses.add(newExpense);
    await setDoc(doc(db, `households/${householdId}/plannedExpenses/${id}`), newExpense);
    return newExpense;
  } catch (error) {
    console.error('Error creating planned expense:', error);
    throw error;
  }
}

export async function updatePlannedExpense(householdId: string, expenseId: string, updates: Partial<PlannedExpense>) {
  try {
    await localDB.plannedExpenses.update(expenseId, updates);
    await setDoc(doc(db, `households/${householdId}/plannedExpenses/${expenseId}`), updates, { merge: true });
  } catch (error) {
    console.error('Error updating planned expense:', error);
    throw error;
  }
}

export async function deletePlannedExpense(householdId: string, expenseId: string) {
  try {
    await localDB.plannedExpenses.delete(expenseId);
    await deleteDoc(doc(db, `households/${householdId}/plannedExpenses/${expenseId}`));
  } catch (error) {
    console.error('Error deleting planned expense:', error);
    throw error;
  }
}
