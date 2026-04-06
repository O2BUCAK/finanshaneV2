export type AccountType = 'asset' | 'liability' | 'income' | 'expense';

export type AccountBranch = 'banking' | 'crypto' | 'social_gift';

export type AccountSubType = 
  | 'liquidity_deposit' | 'investment' | 'credit_debt' | 'credit_card' // Banking
  | 'global_exchange' | 'local_exchange' // Crypto
  | 'transport' | 'food' | 'corporate_gift'; // Social/Gift

export type IncomeFlowType = 'fixed' | 'variable' | 'spot';
export type IncomeCalculationType = 'fixed' | 'daily_rate';
export type ExpenseFlowType = 'fixed' | 'variable' | 'subscription';

export interface IncomeSource {
  id: string;
  name: string;
  ownerId: string; // Added to track which family member owns this income
  flowType: IncomeFlowType;
  calculationType?: IncomeCalculationType; // Added for daily rate vs fixed
  dailyRate?: number; // Added
  workDaysPerWeek?: number; // Added
  amount: number;
  currency: string;
  targetAccountId: string;
  periodDay?: number; // For fixed/variable
  isArchived?: boolean;
  revisions?: {
    date: Date;
    amount: number;
  }[];
  createdAt: Date;
}

export interface ExpectedIncome {
  id: string;
  ownerId: string; // Added
  sourceId: string;
  sourceName: string;
  amount: number;
  currency: string;
  expectedDate: Date;
  status: 'pending' | 'realized' | 'cancelled';
  targetAccountId: string;
  transactionId?: string;
  isRetroactive?: boolean;
  parentSourceId?: string; // For retroactive differences linked to a source
  createdAt: Date;
}

export interface ExpenseSource {
  id: string;
  name: string;
  ownerId: string;
  flowType: ExpenseFlowType;
  amount: number;
  currency: string;
  sourceAccountId: string;
  categoryId: string;
  periodDay?: number;
  isArchived?: boolean;
  status?: 'active' | 'suspended';
  createdAt: Date;
}

export interface ExpectedExpense {
  id: string;
  ownerId: string;
  sourceId: string;
  sourceName: string;
  amount: number;
  currency: string;
  expectedDate: Date;
  status: 'pending' | 'paid' | 'cancelled';
  sourceAccountId: string;
  categoryId: string;
  transactionId?: string;
  createdAt: Date;
}

export interface PlannedExpense {
  id: string;
  ownerId: string; // Added
  title: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'pending' | 'paid';
  categoryId: string;
  sourceAccountId?: string;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  activeHouseholdId?: string;
  joinedBudgetIds?: string[];
  role?: 'adult' | 'child' | 'elderly' | 'other'; // Updated to include elderly and adult
  isAdmin?: boolean;
  kvkkAccepted?: boolean;
  kvkkAcceptedAt?: Date;
  createdAt: Date;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  currency: string;
  joinCode?: string; // Added for family members to join
  members: Record<string, { 
    role: 'owner' | 'member'; 
    type: 'adult' | 'child' | 'elderly' | 'other'; // Updated
    salaryVisible: boolean;
    displayName: string;
    email: string;
  }>;
  createdAt: Date;
}

export interface Account {
  id: string;
  name: string;
  ownerId: string; // Added
  institution?: string;
  type: AccountType;
  branch: AccountBranch;
  subType: AccountSubType;
  balance: number;
  currency: string;
  assetDetails?: {
    symbol: string;
    assetType: 'stock' | 'crypto' | 'fund';
    quantity: number;
    purchasePrice: number;
    purchaseDate: string;
  };
  icon?: string;
  color?: string;
  isCreditCard?: boolean;
  creditLimit?: number;
  statementDay?: number;
  statementBalance?: number; // Ekstre Borcu
  minimumPayment?: number; // Asgari Tutar
  isArchived?: boolean;
  depositDetails?: {
    isTimeDeposit: boolean;
    interestRate?: number;
    period?: 'daily' | 'monthly' | 'yearly';
    maturityDate?: string;
  };
  apiConfig?: {
    apiKey: string;
    apiSecret: string;
    lastSync?: string;
  };
  points?: {
    name: string;
    amount: number;
  }[];
  createdAt: Date;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: Date;
  debitAccountId: string;
  creditAccountId: string;
  categoryId: string;
  userId: string;
  notes?: string;
  receiptUrl?: string;
  isInstallment?: boolean;
  installmentCount?: number;
  installmentNumber?: number;
  parentTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedBudgetParticipant {
  id: string;
  name: string;
  weight: number;
  adultCount?: number;
  childCount?: number;
  elderlyCount?: number;
}

export interface SharedBudgetExpense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'by_weight' | 'exact';
  exactAmounts?: Record<string, number>;
  participantIds?: string[]; // The participants who share this expense
  date: Date;
}

export interface SharedBudget {
  id: string;
  name: string;
  joinCode?: string;
  date: Date;
  participants: SharedBudgetParticipant[];
  expenses: SharedBudgetExpense[];
  isSettled: boolean;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  isSystem?: boolean;
  createdAt: Date;
}

export interface JoinRequest {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
}
