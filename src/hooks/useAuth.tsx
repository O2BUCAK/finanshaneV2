import { useState, useEffect, createContext, useContext } from 'react';
import { db, auth, googleProvider, onAuthStateChanged, signInWithPopup, signOut, browserPopupRedirectResolver, doc, getDoc, setDoc, collection, getDocs } from '../lib/firebase';
import { User } from 'firebase/auth';
import { localDB } from '../db';
import { Household, UserProfile, Account, Transaction, Category, IncomeSource, ExpectedIncome, PlannedExpense, SharedBudget } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';

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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  household: Household | null;
  loading: boolean;
  error: string | null;
  login: (email: string, name: string, kvkkAccepted: boolean) => Promise<void>;
  loginWithGoogle: (kvkkAccepted: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  household: null,
  loading: true,
  error: null,
  login: async (email: string, name: string, kvkkAccepted: boolean) => {},
  loginWithGoogle: async (kvkkAccepted: boolean) => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [localUser, setLocalUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const user = firebaseUser || localUser;

  const profile = useLiveQuery(async () => {
    if (!user) return null;
    return await localDB.users.get(user.uid) || null;
  }, [user?.uid]);

  const household = useLiveQuery(async () => {
    if (!profile?.activeHouseholdId) return null;
    return await localDB.households.get(profile.activeHouseholdId) || null;
  }, [profile?.activeHouseholdId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Sync profile from Firestore to LocalDB on auth change
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const userData = { ...userDoc.data(), id: userDoc.id } as UserProfile;
            await localDB.users.put(userData);
            
            if (userData.activeHouseholdId) {
              const householdDoc = await getDoc(doc(db, 'households', userData.activeHouseholdId));
              if (householdDoc.exists()) {
                await localDB.households.put({ ...householdDoc.data(), id: householdDoc.id } as Household);
              }
            }
          }
        } catch (err) {
          console.error('Sync error:', err);
        }
        setFirebaseUser(u);
        setLocalUser(null);
      } else {
        setFirebaseUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Check for existing local session on mount
  useEffect(() => {
    const checkLocalSession = async () => {
      const profiles = await localDB.users.toArray();
      if (profiles.length > 0 && !firebaseUser) {
        const p = profiles[0];
        setLocalUser({ uid: p.id, email: p.email, displayName: p.fullName });
      }
    };
    checkLocalSession();
  }, [firebaseUser]);

  useEffect(() => {
    const syncAllData = async () => {
      if (!profile?.activeHouseholdId) return;
      const hId = profile.activeHouseholdId;

      try {
        // 1. Sync Categories (Global)
        const catSnap = await getDocs(collection(db, 'categories'));
        for (const d of catSnap.docs) {
          await localDB.categories.put({ ...convertTimestamps(d.data()), id: d.id } as Category);
        }

        // 2. Sync Household Subcollections
        const collectionsToSync = [
          { path: 'accounts', table: localDB.accounts },
          { path: 'transactions', table: localDB.transactions },
          { path: 'incomeSources', table: localDB.incomeSources },
          { path: 'expectedIncomes', table: localDB.expectedIncomes },
          { path: 'plannedExpenses', table: localDB.plannedExpenses },
          { path: 'sharedBudgets', table: localDB.sharedBudgets },
        ];

        for (const col of collectionsToSync) {
          const snap = await getDocs(collection(db, `households/${hId}/${col.path}`));
          for (const d of snap.docs) {
            await col.table.put({ ...convertTimestamps(d.data()), id: d.id } as any);
          }
        }
      } catch (err) {
        console.error('Full sync error:', err);
      }
    };

    syncAllData();
  }, [profile?.activeHouseholdId]);

  const login = async (email: string, name: string, kvkkAccepted: boolean) => {
    if (!kvkkAccepted) throw new Error('KVKK onayı gereklidir.');
    
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newProfile: UserProfile = {
      id,
      email,
      fullName: name,
      createdAt: new Date() as any,
      isAdmin: true,
      kvkkAccepted: true,
      kvkkAcceptedAt: new Date() as any,
    };
    await localDB.users.add(newProfile);
    setLocalUser({ uid: id, email, displayName: name });
  };

  const loginWithGoogle = async (kvkkAccepted: boolean) => {
    if (!kvkkAccepted) throw new Error('KVKK onayı gereklidir.');
    try {
      const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      const u = result.user;
      
      // Check Firestore first
      const userDoc = await getDoc(doc(db, 'users', u.uid));
      let profileData: UserProfile;

      if (userDoc.exists()) {
        profileData = { ...userDoc.data(), id: userDoc.id } as UserProfile;
      } else {
        profileData = {
          id: u.uid,
          email: u.email || '',
          fullName: u.displayName || 'Kullanıcı',
          createdAt: new Date() as any,
          isAdmin: true,
          kvkkAccepted: true,
          kvkkAcceptedAt: new Date() as any,
        };
        await setDoc(doc(db, 'users', u.uid), profileData);
      }

      // Save to localDB
      await localDB.users.put(profileData);

      // If has household, sync it too
      if (profileData.activeHouseholdId) {
        const householdDoc = await getDoc(doc(db, 'households', profileData.activeHouseholdId));
        if (householdDoc.exists()) {
          await localDB.households.put({ ...householdDoc.data(), id: householdDoc.id } as Household);
        }
      }

      setFirebaseUser(u);
      setLocalUser(null);
    } catch (err: any) {
      console.error('Google Login Error:', err);
      throw err;
    }
  };

  const logout = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    // Clear all tables
    const tables = [
      localDB.users,
      localDB.households,
      localDB.accounts,
      localDB.transactions,
      localDB.categories,
      localDB.incomeSources,
      localDB.expectedIncomes,
      localDB.plannedExpenses,
      localDB.sharedBudgets,
      localDB.auditLogs
    ];
    for (const table of tables) {
      await table.clear();
    }
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user: user as any, profile, household, loading, error, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
