import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  QueryConstraint, 
  DocumentData 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export function useCollection<T = DocumentData>(
  path: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) return;

    const q = query(collection(db, path), ...constraints);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Error fetching collection ${path}:`, err);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [path, JSON.stringify(constraints)]);

  return { data, loading, error };
}
