// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import AdminLayout from './components/layout/AdminLayout';
import Login from './components/auth/Login';
import Dashboard from './components/admin/Dashboard';
import StudentsPanel from './components/admin/StudentsPanel';
import CoursesPanel from './components/admin/CoursesPanel';
import AttendancePanel from './components/admin/AttendancePanel';
import SubjectsPanel from './components/admin/SubjectsPanel';
import LessonsPanel from './components/admin/LessonsPanel';
import ScreenshotPanel from './components/admin/ScreenshotPanel';
import ClassroomsPanel from './components/admin/ClassroomPanel';
import StudentEdit from './components/admin/StudentEdit';
import StudentRegistration from './components/technician/StudentRegistration';
import './scss/main.scss';

// ProtectedRoute aggiornato con redirect intelligente
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
  
  // Se l'utente non ha i permessi per questa route, reindirizzalo alla sua pagina corretta
  if (user && !roles.includes(user.role)) {
    // Redirect intelligente basato sul ruolo dell'utente
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'technician':
        return <Navigate to="/technician" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }
  
  return <>{children}</>;
};

// Componente per il redirect condizionale basato sul ruolo
const RoleBasedRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAppContext();
  
  if (isLoading) {
    return <div className="loading-container">Caricamento...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect basato sul ruolo
  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'technician':
      return <Navigate to="/technician" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

// Layout per il tecnico (semplificato, solo registrazione studenti)
const TechnicianLayout: React.FC = () => {
  const { user } = useAppContext();
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header compatto e professionale */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Logo e titolo compatti */}
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Registrazione Studenti</h1>
              </div>
            </div>
            
            {/* User info compatte */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 text-sm">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium text-gray-700">{user?.name}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 capitalize">{user?.role}</span>
              </div>
              
              <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
              
              <button 
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200"
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.href = '/login';
                }}
                title="Logout"
              >
                <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content ottimizzato */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Info banner compatto */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-700">
                <span className="font-medium">Registrazione nuovo studente:</span> Compila tutti i campi e scatta una foto chiara per il riconoscimento facciale.
              </p>
            </div>
          </div>
        </div>

        {/* Form container ottimizzato */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <StudentRegistration />
        </div>
      </main>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Route pubbliche */}
      <Route path="/login" element={<Login />} />
      
      {/* Route per tecnici */}
      <Route path="/technician" element={
        <ProtectedRoute roles={['technician']}>
          <TechnicianLayout />
        </ProtectedRoute>
      } />
      
      {/* Route protette con layout admin */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<StudentsPanel />} />
        <Route path="students/edit/:id" element={<StudentEdit />} />
        <Route path="technician/register" element={<StudentRegistration />} />
        <Route path="courses" element={<CoursesPanel />} />
        <Route path="attendance" element={<AttendancePanel />} />
        <Route path="classrooms" element={<ClassroomsPanel />} />
        <Route path="subjects" element={<SubjectsPanel />} />
        <Route path="lessons" element={<LessonsPanel />} />
        <Route path="screenshots" element={<ScreenshotPanel />} />
      </Route>
      
      {/* Redirect intelligente basato sul ruolo */}
      <Route path="/" element={<RoleBasedRedirect />} />
      
      {/* Redirect per qualsiasi altro path */}
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
};

export default App;