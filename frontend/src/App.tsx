// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppProvider, useAppContext } from './context/AppContext';
import AdminLayout from './components/layout/AdminLayout';
import TeacherLayout from './components/layout/TeacherLayout';
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
import TechnicianDashboard from './components/technician/TechnicianDashboard';
import TechnicianLayout from './components/layout/TechnicianLayout';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import ActiveLesson from './components/teacher/ActiveLesson';
import LessonImages from './components/teacher/LessonImages';
import CreateLesson from './components/teacher/CreateLesson';
import './i18n/i18n';

// ProtectedRoute aggiornato con redirect intelligente
interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles = ['admin'] }) => {
  const { user, isAuthenticated, isLoading } = useAppContext();
  const { t } = useTranslation();
  
  if (isLoading) {
    return <div className="loading-container">{t('common.loading')}</div>;
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
      case 'teacher':
        return <Navigate to="/teacher" replace />;
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
  const { t } = useTranslation();
  
  if (isLoading) {
    return <div className="loading-container">{t('common.loading')}</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect basato sul ruolo
  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'teacher':
      return <Navigate to="/teacher" replace />;
    case 'technician':
      return <Navigate to="/technician" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
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
      }>
        <Route index element={<TechnicianDashboard />} />
        <Route path="register" element={<StudentRegistration />} />
      </Route>
      
      {/* Route per docenti */}
      <Route path="/teacher" element={
        <ProtectedRoute roles={['teacher']}>
          <TeacherLayout />
        </ProtectedRoute>
      }>
        <Route index element={<TeacherDashboard />} />
        <Route path="lessons/create" element={<CreateLesson />} />
        <Route path="lessons/:id" element={<ActiveLesson />} />
        <Route path="lessons/:id/images" element={<LessonImages />} />
      </Route>
      
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