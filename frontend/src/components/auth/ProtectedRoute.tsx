// frontend/src/components/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles = ['admin'] }) => {
  const { user, isAuthenticated, isLoading } = useAppContext();
  
  if (isLoading) {
    return <div className="loading-container">...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user && !roles.includes(user.role)) {
    return (
      <div className="error-container">
        <span className="icon-alert"></span>
        <h2>Accesso negato</h2>
        <p>Non hai i permessi necessari per accedere a questa pagina.</p>
        <button 
          className="btn secondary"
          onClick={() => window.location.href = '/login'}
        >
          Torna al login
        </button>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;