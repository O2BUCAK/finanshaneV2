import { localDB } from '../db';
import { PlannedExpense } from '../types';
import { db, doc, setDoc, deleteDoc, handleFirestoreError, OperationType } from './firebase';

export async function createPlannedExpense(householdId: string, expenseData: Omit<PlannedExpense, 'id' | 'createdAt'>) {
  const id = `pe-${Date.now()}`;
  const now = new Date();
  
  const newExpense = {
    ...expenseData,
    id,
    householdId,
    createdAt: now,
  } as PlannedExpense;

  try {
    await localDB.plannedExpenses.add(newExpense);
    const path = `households/${householdId}/plannedExpenses/${id}`;
    try {
      await setDoc(doc(db, path), newExpense);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
    return newExpense;
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error creating planned expense:', error);
    throw error;
  }
}

export async function updatePlannedExpense(householdId: string, expenseId: string, updates: Partial<PlannedExpense>) {
  try {
    await localDB.plannedExpenses.update(expenseId, updates);
    const path = `households/${householdId}/plannedExpenses/${expenseId}`;
    try {
      await setDoc(doc(db, path), updates, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error updating planned expense:', error);
    throw error;
  }
}

export async function deletePlannedExpense(householdId: string, expenseId: string) {
  try {
    await localDB.plannedExpenses.delete(expenseId);
    const path = `households/${householdId}/plannedExpenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('FirestoreErrorInfo')) throw error;
    console.error('Error deleting planned expense:', error);
    throw error;
  }
}
