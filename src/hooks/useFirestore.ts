import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDB } from '../db';
import { Table } from 'dexie';
import { db, collection, query, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';

// Helper to convert Firestore timestamps to Dates
const convertTimestamps = (data: any) => {
  if (!data) return data;
  const result = { ...data };
  for (const key in result) {
    if (result[key] && typeof result[key].toDate === 'function') {
      result[key] = result[key].toDate();
    } else if (Array.isArray(result[key])) {
      result[key] = result[key].map((item: any) => 
        (typeof item === 'object' && item !== null) ? convertTimestamps(item) : item
      );
    } else if (typeof result[key] === 'object' && result[key] !== null && !(result[key] instanceof Date)) {
      result[key] = convertTimestamps(result[key]);
    }
  }
  return result;
};

export function useCollection<T>(
  path: string,
  constraints: any[] = []
) {
  // Map Firestore paths to Dexie table names
  const getTableName = (p: string): keyof typeof localDB | null => {
    if (p.includes('accounts')) return 'accounts';
    if (p.includes('transactions')) return 'transactions';
    if (p.includes('categories')) return 'categories';
    if (p.includes('incomeSources')) return 'incomeSources';
    if (p.includes('expectedIncomes')) return 'expectedIncomes';
    if (p.includes('expenseSources')) return 'expenseSources';
    if (p.includes('expectedExpenses')) return 'expectedExpenses';
    if (p.includes('plannedExpenses')) return 'plannedExpenses';
    if (p.includes('sharedBudgets')) return 'sharedBudgets';
    if (p.includes('users')) return 'users';
    if (p.includes('households')) return 'households';
    return null;
  };

  const tableName = getTableName(path);
  const table = tableName ? (localDB[tableName] as Table<any>) : null;
  
  // Real-time sync from Firestore to Dexie
  useEffect(() => {
    if (!path || !table) return;

    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(q, async (snap) => {
      for (const change of snap.docChanges()) {
        const docId = change.doc.id;
        const docData = { ...convertTimestamps(change.doc.data()), id: docId };
        
        if (change.type === 'removed') {
          await table.delete(docId);
        } else {
          await table.put(docData);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [path, table, JSON.stringify(constraints)]);

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
