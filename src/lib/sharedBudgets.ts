import { localDB } from '../db';
import { SharedBudget } from '../types';
import { db, doc, setDoc, updateDoc, deleteDoc, handleFirestoreError, OperationType } from './firebase';

export async function createSharedBudget(householdId: string, budgetData: Omit<SharedBudget, 'id' | 'createdAt' | 'joinCode'>) {
  try {
    const id = Math.random().toString(36).substring(2, 15);
    const now = new Date();
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newBudget = {
      ...budgetData,
      id,
      householdId,
      joinCode,
      createdAt: now,
    };

    await localDB.sharedBudgets.add(newBudget as SharedBudget);
    
    // Sync to Firestore
    const path = `households/${householdId}/sharedBudgets/${id}`;
    try {
      await setDoc(doc(db, path), newBudget);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
    
    return newBudget;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/sharedBudgets`);
    throw error;
  }
}

export async function updateSharedBudget(householdId: string, budgetId: string, updates: Partial<SharedBudget>) {
  try {
    await localDB.sharedBudgets.update(budgetId, updates);
    
    // Sync to Firestore
    // We use setDoc with merge: true to handle cases where the doc might not exist yet
    // However, to ensure a complete document if it's new to Firestore, 
    // we fetch the full budget from localDB.
    const fullBudget = await localDB.sharedBudgets.get(budgetId);
    if (!fullBudget) return;

    const path = `households/${householdId}/sharedBudgets/${budgetId}`;
    try {
      await setDoc(doc(db, path), fullBudget);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}

export async function deleteSharedBudget(householdId: string, budgetId: string) {
  try {
    await localDB.sharedBudgets.delete(budgetId);
    
    // Sync to Firestore
    const path = `households/${householdId}/sharedBudgets/${budgetId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}
