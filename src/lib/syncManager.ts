import { useState, useEffect, useCallback } from 'react';
import { db, doc, setDoc, deleteDoc } from './firebase';

export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  collectionPath: string;
  docId: string;
  data?: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'finanshane_offline_queue';

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Could not save offline queue:', err);
  }
}

export function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): void {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };
  queue.push(newAction);
  saveOfflineQueue(queue);
}

export async function processSyncQueue(
  onProgress?: (remaining: number) => void
): Promise<{ success: boolean; processed: number; errors: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, processed: 0, errors: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;
  const remainingQueue: OfflineAction[] = [];

  for (const action of queue) {
    try {
      const docRef = doc(db, action.collectionPath, action.docId);
      if (action.type === 'delete') {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, action.data, { merge: true });
      }
      processed++;
    } catch (err) {
      console.error(`Sync error for action ${action.id}:`, err);
      errors++;
      // Keep in queue if it was network error or transient
      remainingQueue.push(action);
    }
    if (onProgress) {
      onProgress(remainingQueue.length);
    }
  }

  saveOfflineQueue(remainingQueue);
  return { success: errors === 0, processed, errors };
}

/**
 * React hook to observe online/offline status and pending sync queue
 */
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await processSyncQueue((remaining) => setPendingCount(remaining));
    } finally {
      setPendingCount(getOfflineQueue().length);
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setPendingCount(getOfflineQueue().length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncNow: triggerSync
  };
}
