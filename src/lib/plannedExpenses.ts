import { 
  collection, 
  doc, 
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { PlannedExpense } from '../types';
import { handleFirestoreError, OperationType } from './error-handler';

export async function createPlannedExpense(householdId: string, expenseData: Omit<PlannedExpense, 'id' | 'createdAt'>) {
  try {
    const expenseRef = doc(collection(db, `households/${householdId}/plannedExpenses`));
    const now = Timestamp.now();
    
    const newExpense = {
      ...expenseData,
      id: expenseRef.id,
      createdAt: now,
    };

    await setDoc(expenseRef, newExpense);
    return newExpense;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/plannedExpenses`);
    throw error;
  }
}

export async function updatePlannedExpense(householdId: string, expenseId: string, updates: Partial<PlannedExpense>) {
  try {
    const expenseRef = doc(db, `households/${householdId}/plannedExpenses/${expenseId}`);
    await updateDoc(expenseRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/plannedExpenses/${expenseId}`);
    throw error;
  }
}

export async function deletePlannedExpense(householdId: string, expenseId: string) {
  try {
    const expenseRef = doc(db, `households/${householdId}/plannedExpenses/${expenseId}`);
    await deleteDoc(expenseRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/plannedExpenses/${expenseId}`);
    throw error;
  }
}
