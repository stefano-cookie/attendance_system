import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useTranslation } from 'react-i18next';

const TeacherLayout: React.FC = () => {
  const { user, logout } = useAppContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50 shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo e titolo */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">{t('teacher.panel.title')}</h1>
                <p className="text-sm text-gray-300">{t('auth.systemName')}</p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-lg font-bold text-white">{t('navigation.teacherPanel')}</h1>
              </div>
            </div>
            
            {/* User info e logout */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-sm font-semibold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user?.name} {user?.surname}</p>
                  <p className="text-xs text-gray-300 capitalize">{user?.role}</p>
                </div>
              </div>
              
              <div className="h-6 w-px bg-gray-600 hidden md:block"></div>
              
              <button 
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-200 shadow-sm"
                title="Logout"
              >
                <svg className="w-5 h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">{t('common.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default TeacherLayout;