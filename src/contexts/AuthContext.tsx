import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, AppSettings } from "@/types";
import { StorageService } from "@/services/StorageService";
import { firebaseStorageService } from "@/services/FirebaseStorageService";
import { mockStorageService } from "@/services/MockStorageService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserSettings?: (settings: AppSettings) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = "4stash_cached_user";

function serializeCachedUser(user: User): string {
  return JSON.stringify({
    ...user,
    createdAt: user.createdAt.toISOString(),
  });
}

function parseCachedUser(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as Omit<User, "createdAt"> & {
      createdAt: string;
    };
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
    };
  } catch {
    return null;
  }
}

function readCachedUser(): User | null {
  const cached = localStorage.getItem(AUTH_CACHE_KEY);
  if (!cached) return null;
  const user = parseCachedUser(cached);
  if (!user) {
    localStorage.removeItem(AUTH_CACHE_KEY);
  }
  return user;
}

function writeCachedUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }
  localStorage.setItem(AUTH_CACHE_KEY, serializeCachedUser(user));
}

// Service instance — swap to mock when VITE_USE_MOCK is set (e.g. in Playwright tests)
const storageService: StorageService =
  import.meta.env.VITE_USE_MOCK === "true"
    ? mockStorageService
    : firebaseStorageService;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedUser = readCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
    }

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const currentUser = await storageService.getCurrentUser();
        if (cancelled) return;
        setUser(currentUser);
        writeCachedUser(currentUser);
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = async () => {
    const refreshedUser = await storageService.getCurrentUser();
    setUser(refreshedUser);
    writeCachedUser(refreshedUser);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithGoogle();
      setUser(user);
      writeCachedUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithTwitter = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithTwitter();
      setUser(user);
      writeCachedUser(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Twitter",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithEmail(email, password);
      setUser(user);
      writeCachedUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signUpWithEmail(
        email,
        password,
        displayName,
      );
      setUser(user);
      writeCachedUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await storageService.signOut();
      setUser(null);
      writeCachedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserSettings = async (settings: AppSettings) => {
    if (!user) {
      throw new Error("No user logged in");
    }
    try {
      await storageService.updateUserSettings(user.id, settings);
      const updatedUser = { ...user, settings };
      setUser(updatedUser);
      writeCachedUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        signInWithTwitter,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateUserSettings,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
