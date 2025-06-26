// frontend/src/services/authService.ts
import api from './api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  id: number;
  name: string;
  surname?: string;
  email: string;
  role: string;
}

// Flag per prevenire loop infiniti
let isRefreshing = false;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

export const authService = {
  async login(credentials: LoginCredentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Reset contatori dopo login riuscito
      refreshAttempts = 0;
      isRefreshing = false;
      
      return { token, user };
    } catch (error: any) {
      console.error('Errore durante il login:', error);
      throw error;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      // Se c'è già un refresh in corso, aspetta invece di restituire null
      if (isRefreshing) {
        // Aspetta che il refresh corrente finisca (max 3 secondi)
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!isRefreshing) {
            break;
          }
        }
        
        // Se dopo 3 secondi è ancora in refresh, continua comunque
        if (isRefreshing) {
          isRefreshing = false;
        }
      }

      // Controlla se abbiamo superato il limite di tentativi
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        this.logout();
        return null;
      }

      isRefreshing = true;
      refreshAttempts++;

      const response = await api.get('/auth/me');
      const user = response.data.user || response.data;
      
      localStorage.setItem('user', JSON.stringify(user));
      
      // Reset contatori su successo
      refreshAttempts = 0;
      isRefreshing = false;
      
      return user;
    } catch (error: any) {
      console.error('❌ getCurrentUser: Errore', error);
      isRefreshing = false;
      
      // Se è un errore di database, non fare logout automatico
      if (error.response?.data?.code === 'DB_CONNECTION_ERROR') {
        return null;
      }
      
      // Per altri errori di autenticazione, fai logout
      if (error.response?.status === 401) {
        this.logout();
      }
      
      return null;
    }
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    refreshAttempts = 0;
    isRefreshing = false;
    
    // Ricarica la pagina per fare il redirect al login
    window.location.href = '/login';
    
    // Restituisce una Promise per compatibilità
    return Promise.resolve();
  },

  getToken(): string | null {
    const token = localStorage.getItem('token');
    return token;
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!(token && user);
  },

  hasRole(requiredRole: string | string[]): boolean {
    const user = this.getUser();
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  },

  // Reset dei contatori per retry manuale
  resetRefreshAttempts() {
    refreshAttempts = 0;
    isRefreshing = false;
  }
};

export default authService;