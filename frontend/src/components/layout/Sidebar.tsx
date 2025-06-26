// frontend/src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import LanguageSwitcher from '../common/LanguageSwitcher';

interface UserProps {
  name?: string;
  surname?: string;
  role?: string;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed = false, 
  onToggleCollapse = () => {} 
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAppContext();
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  
  // Controlla se il link è attivo
  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };
  
  // Toggle per desktop
  const toggleCollapse = (): void => {
    onToggleCollapse(!isCollapsed);
  };

  // Toggle per mobile
  const toggleMobile = (): void => {
    setIsMobileOpen(!isMobileOpen);
  };
  
  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };
  
  // Helper per le iniziali dell'avatar
  const getInitials = (user: UserProps | null): string => {
    if (!user) return 'A';
    return `${user.name?.[0] || ''}${user.surname?.[0] || ''}` || 'A';
  };

  const navigationLinks = [
    {
      to: '/admin',
      labelKey: 'navigation.dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      color: 'from-blue-500 to-cyan-500',
      badge: '4'
    },
    {
      to: '/admin/courses',
      labelKey: 'navigation.courses',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      color: 'from-orange-500 to-red-500'
    },
        {
      to: '/admin/classrooms',
      labelKey: 'navigation.classrooms',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'from-amber-500 to-yellow-500'
    },
    {
      to: '/admin/subjects',
      labelKey: 'navigation.subjects',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'from-pink-500 to-rose-500'
    },
    {
      to: '/admin/lessons',
      labelKey: 'navigation.lessons',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-indigo-500 to-blue-500'
    },
    {
      to: '/admin/students',
      labelKey: 'navigation.students',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      color: 'from-emerald-500 to-teal-500'
    },
    {
      to: '/admin/attendance',
      labelKey: 'navigation.attendance',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-green-500 to-emerald-500',
      badge: 'New'
    },
    {
      to: '/admin/screenshots',
      labelKey: 'navigation.screenshots',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
      ),
      color: 'from-slate-500 to-gray-500'
    },
    {
      to: '/admin/technician/register',
      labelKey: 'technician.panel.registerStudents',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      color: 'from-violet-500 to-purple-500'
    }
  ];

  // Funzione helper per renderizzare il contenuto della sidebar
  const renderSidebarContent = () => {
    return (
      <div className="h-full flex flex-col">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-purple-500/3 to-pink-500/3 pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-400/8 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-400/8 to-transparent rounded-full blur-3xl" />
      
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200/50 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className={`flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
            <div className={`flex items-center space-x-4 ${isCollapsed ? 'space-x-0' : ''}`}>
              {/* Logo - diventa pulsante quando collassata */}
              {isCollapsed ? (
                <button
                  onClick={toggleCollapse}
                  className="relative flex-shrink-0 hover:scale-110 transition-transform duration-200 group"
                  title={t('navigation.expandSidebar')}
                >
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:bg-white/30 transition-colors duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-white animate-pulse" />
                </button>
              ) : (
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-white animate-pulse" />
                </div>
              )}
              
              {!isCollapsed && (
                <div className="text-white">
                  <h1 className="text-lg font-bold">{t('navigation.adminPanel')}</h1>
                  <p className="text-xs text-blue-100">{t('auth.systemTitle')}</p>
                </div>
              )}
            </div>
            
            {/* Desktop collapse button - solo quando NON è collassata */}
            {!isCollapsed && (
              <button 
                className="hidden lg:block p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                onClick={toggleCollapse}
                title={t('navigation.collapseSidebar')}
              >
                <svg className="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigationLinks.map((link, index) => {
            const active = isActive(link.to);
            return (
              <NavLink
                key={index}
                to={link.to}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  group relative flex items-center px-3 py-3 rounded-xl font-medium transition-all duration-200
                  ${active 
                    ? `bg-gradient-to-r ${link.color} text-white shadow-lg shadow-current/20` 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? t(link.labelKey) : undefined}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 transition-all duration-200 ${isCollapsed ? '' : 'mr-3'}`}>
                  {link.icon}
                </div>
                
                {/* Label */}
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-sm">{t(link.labelKey)}</span>
                    
                    {/* Badge */}
                    {link.badge && (
                      <div className={`
                        px-2 py-1 text-xs font-bold rounded-full ml-2
                        ${active ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}
                      `}>
                        {link.badge}
                      </div>
                    )}
                  </>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    {t(link.labelKey)}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* User Profile & Logout */}
        <div className="relative border-t border-gray-200/50 p-4 mt-auto">
          {/* User card */}
          <div className={`
            mb-3 p-3 rounded-xl bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200/50
            hover:shadow-md transition-all duration-200
            ${isCollapsed ? 'flex justify-center' : ''}
          `}>
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {getInitials(user)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate text-sm">
                    {user?.name || 'Admin'} {user?.surname}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {user?.role || t('navigation.adminPanel')}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Language Switcher */}
          {!isCollapsed && (
            <div className="mb-3">
              <LanguageSwitcher />
            </div>
          )}
          
          {/* Logout button */}
          <button 
            onClick={handleLogout}
            className={`
              w-full group flex items-center px-3 py-3 rounded-xl font-medium text-sm
              bg-gradient-to-r from-red-500 to-pink-500 text-white
              hover:from-red-600 hover:to-pink-600 hover:shadow-lg hover:shadow-red-500/20
              transition-all duration-200
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? t('common.logout') : undefined}
          >
            <svg className={`w-5 h-5 transition-transform duration-200 group-hover:rotate-12 ${isCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span>{t('common.logout')}</span>}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                {t('common.logout')}
              </div>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={toggleMobile}
        />
      )}
      
      {/* Mobile toggle button */}
      <button 
        className="fixed top-6 left-6 z-50 lg:hidden p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 hover:scale-110 active:scale-95 transition-all duration-200"
        onClick={toggleMobile}
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-72'}
        hidden lg:block
      `}>
        <div className="h-full bg-white/98 backdrop-blur-xl shadow-xl">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile sidebar */}
      <div className={`
        lg:hidden fixed top-0 left-0 z-50 h-full transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        w-80
      `}>
        <div className="h-full bg-white/98 backdrop-blur-xl shadow-xl">
          {renderSidebarContent()}
        </div>
      </div>
    </>
  );
};

export default Sidebar;