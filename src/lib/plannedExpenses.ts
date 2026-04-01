import { localDB } from '../db';
import { PlannedExpense } from '../types';

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
    return newExpense;
  } catch (error) {
    console.error('Error creating planned expense:', error);
    throw error;
  }
}

export async function updatePlannedExpense(householdId: string, expenseId: string, updates: Partial<PlannedExpense>) {
  try {
    await localDB.plannedExpenses.update(expenseId, updates);
  } catch (error) {
    console.error('Error updating planned expense:', error);
    throw error;
  }
}

export async function deletePlannedExpense(householdId: string, expenseId: string) {
  try {
    await localDB.plannedExpenses.delete(expenseId);
  } catch (error) {
    console.error('Error deleting planned expense:', error);
    throw error;
  }
}
