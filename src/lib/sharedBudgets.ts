import { 
  collection, 
  doc, 
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { SharedBudget } from '../types';
import { handleFirestoreError, OperationType } from './error-handler';

export async function createSharedBudget(householdId: string, budgetData: Omit<SharedBudget, 'id' | 'createdAt' | 'joinCode'>) {
  try {
    const budgetRef = doc(collection(db, `households/${householdId}/sharedBudgets`));
    const now = Timestamp.now();
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newBudget = {
      ...budgetData,
      id: budgetRef.id,
      householdId,
      joinCode,
      createdAt: now,
    };

    await setDoc(budgetRef, newBudget);
    return newBudget;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/sharedBudgets`);
    throw error;
  }
}

export async function updateSharedBudget(householdId: string, budgetId: string, updates: Partial<SharedBudget>) {
  try {
    const budgetRef = doc(db, `households/${householdId}/sharedBudgets/${budgetId}`);
    await updateDoc(budgetRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}

export async function deleteSharedBudget(householdId: string, budgetId: string) {
  try {
    const budgetRef = doc(db, `households/${householdId}/sharedBudgets/${budgetId}`);
    await deleteDoc(budgetRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}
