import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Household, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  household: Household | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  household: null,
  loading: true,
  error: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setHousehold(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const profileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const profileData = { id: snap.id, ...snap.data() } as UserProfile;
        setProfile(profileData);
        if (!profileData.activeHouseholdId) {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    }, (err) => {
      console.error('Profile fetch error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

  useEffect(() => {
    const householdId = profile?.activeHouseholdId;
    if (!user || !householdId) {
      setHousehold(null);
      return;
    }

    const householdRef = doc(db, 'households', householdId);
    const unsubHousehold = onSnapshot(householdRef, (snap) => {
      if (snap.exists()) {
        setHousehold({ id: snap.id, ...snap.data() } as Household);
      } else {
        setHousehold(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Household fetch error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubHousehold();
  }, [user, profile?.activeHouseholdId]);

  return (
    <AuthContext.Provider value={{ user, profile, household, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
