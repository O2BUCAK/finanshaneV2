import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDB } from '../db';
import { Table } from 'dexie';

export function useLocalCollection<T>(tableName: keyof typeof localDB) {
  const table = localDB[tableName] as Table<T>;
  const data = useLiveQuery(() => table.toArray()) || [];
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data !== undefined) {
      setLoading(false);
    }
  }, [data]);

  const add = async (item: T) => {
    return await table.add(item);
  };

  const update = async (id: string, changes: Partial<T>) => {
    return await (table as any).update(id, changes);
  };

  const remove = async (id: string) => {
    return await table.delete(id);
  };

  return { data, loading, add, update, remove };
}
