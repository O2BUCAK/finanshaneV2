import { localDB } from '../db';
import { SharedBudget } from '../types';
import { handleFirestoreError, OperationType } from './error-handler';

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
    return newBudget;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/sharedBudgets`);
    throw error;
  }
}

export async function updateSharedBudget(householdId: string, budgetId: string, updates: Partial<SharedBudget>) {
  try {
    await localDB.sharedBudgets.update(budgetId, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}

export async function deleteSharedBudget(householdId: string, budgetId: string) {
  try {
    await localDB.sharedBudgets.delete(budgetId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/sharedBudgets/${budgetId}`);
    throw error;
  }
}
