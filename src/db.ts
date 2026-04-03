import Dexie, { Table } from 'dexie';
import { 
  Account, 
  Transaction, 
  Category, 
  UserProfile, 
  Household, 
  IncomeSource, 
  ExpectedIncome, 
  ExpenseSource,
  ExpectedExpense,
  PlannedExpense,
  SharedBudget
} from './types';

export class AppDatabase extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  users!: Table<UserProfile>;
  households!: Table<Household>;
  incomeSources!: Table<IncomeSource>;
  expectedIncomes!: Table<ExpectedIncome>;
  expenseSources!: Table<ExpenseSource>;
  expectedExpenses!: Table<ExpectedExpense>;
  plannedExpenses!: Table<PlannedExpense>;
  sharedBudgets!: Table<SharedBudget>;
  auditLogs!: Table<{ id: string; timestamp: Date; action: string; userId: string; details?: string }>;

  constructor() {
    super('FinansHaneDB');
    this.version(1).stores({
      accounts: 'id, name, type, branch, subType, ownerId',
      transactions: 'id, date, debitAccountId, creditAccountId, categoryId, userId',
      categories: 'id, name, type',
      users: 'id, email',
      households: 'id, name, ownerId',
      incomeSources: 'id, name, ownerId',
      expectedIncomes: 'id, sourceId, ownerId, expectedDate, status',
      expenseSources: 'id, name, ownerId',
      expectedExpenses: 'id, sourceId, ownerId, expectedDate, status',
      plannedExpenses: 'id, ownerId, dueDate, status',
      sharedBudgets: 'id, name, joinCode',
      auditLogs: 'id, timestamp, action, userId'
    });
  }
}

export const localDB = new AppDatabase();
