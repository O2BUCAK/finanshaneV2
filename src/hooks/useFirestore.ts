import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDB } from '../db';
import { Table } from 'dexie';

export function useCollection<T>(
  path: string,
  _constraints: any[] = []
) {
  // Map Firestore paths to Dexie table names
  const getTableName = (p: string): keyof typeof localDB | null => {
    if (p.includes('accounts')) return 'accounts';
    if (p.includes('transactions')) return 'transactions';
    if (p.includes('categories')) return 'categories';
    if (p.includes('incomeSources')) return 'incomeSources';
    if (p.includes('expectedIncomes')) return 'expectedIncomes';
    if (p.includes('plannedExpenses')) return 'plannedExpenses';
    if (p.includes('sharedBudgets')) return 'sharedBudgets';
    if (p.includes('users')) return 'users';
    if (p.includes('households')) return 'households';
    return null;
  };

  const tableName = getTableName(path);
  const table = tableName ? (localDB[tableName] as Table<any>) : null;
  
  const data = useLiveQuery(async () => {
    if (!table) return [];
    return await table.toArray();
  }, [path]) || [];

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data !== undefined) {
      setLoading(false);
    }
  }, [data]);

  return { data: data as T[], loading, error: null };
}
