// frontend/src/context/AppContext.tsx - CON DEBUG
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import authService from '../services/authService';

interface User {
  id: number;
  name: string;
  surname?: string;
  email: string;
  role: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await authService.login({ email, password });
      
      setUser(result.user);
      
      return true;
    } catch (error: any) {
      console.error('❌ AppContext.login ERROR:', error);
      setError(error.response?.data?.message || 'Errore durante il login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    authService.logout();
  };

  const refreshUser = async () => {
    try {
      setError(null);      
      const currentUser = await authService.getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
      } else {
        // SOLO pulisci se il token non c'è nel localStorage
        const stillHasToken = localStorage.getItem('token');
        if (!stillHasToken) {
          setUser(null);
          localStorage.removeItem('user');
        }
      }
    } catch (error: any) {
      console.error('❌ AppContext.refreshUser ERROR:', error);
      
      // SOLO per errori di autenticazione (401), pulisci tutto
      if (error.response?.status === 401 || 
          error.response?.data?.code === 'INVALID_TOKEN' ||
          error.response?.data?.code === 'USER_NOT_FOUND') {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else {
        // Per errori di server/database, NON fare logout
        setError('Errore temporaneo del server');
      }
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Inizializzazione una sola volta
  useEffect(() => {
    const initializeAuth = async () => {
      if (isInitialized) {
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Debug: controlla localStorage all'inizio - DIRETTAMENTE
        const directToken = localStorage.getItem('token');
        const token = authService.getToken();
        
        // USA IL TOKEN DIRETTO se authService fallisce
        const tokenToUse = token || directToken;
        
        if (tokenToUse) {
          await refreshUser();
        }
      } catch (error) {
        console.error('❌ Errore inizializzazione auth:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [isInitialized]);

  const contextValue: AppContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    clearError
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Export per compatibilità con componenti esistenti
export const useAppContext = useApp;