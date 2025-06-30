// frontend/src/components/layout/Sidebar.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Context-aware sidebar based on current route
  const currentContext = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/courses')) return 'courses';
    if (path.includes('/students')) return 'students';
    if (path.includes('/attendance')) return 'attendance';
    if (path.includes('/lessons')) return 'lessons';
    if (path.includes('/technician')) return 'technician';
    return 'dashboard';
  }, [location.pathname]);
  
  // Check if link is active
  const isActive = (path: string): boolean => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  
  // Desktop toggle
  const toggleCollapse = (): void => {
    onToggleCollapse(!isCollapsed);
  };

  // Mobile toggle
  const toggleMobile = (): void => {
    setIsMobileOpen(!isMobileOpen);
  };
  
  // Handle swipe gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (diff > 50) {
      setIsMobileOpen(false);
    }
    
    setTouchStart(null);
  };
  
  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };
  
  // Helper for avatar initials
  const getInitials = (user: UserProps | null): string => {
    if (!user) return 'A';
    return `${user.name?.[0] || ''}${user.surname?.[0] || ''}` || 'A';
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const navigationLinks = [
    {
      to: '/admin',
      labelKey: 'navigation.dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      color: 'from-blue-500 to-cyan-500',
      context: 'dashboard'
    },
    {
      to: '/admin/courses',
      labelKey: 'navigation.courses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      color: 'from-orange-500 to-red-500',
      context: 'courses'
    },
        {
      to: '/admin/classrooms',
      labelKey: 'navigation.classrooms',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'from-amber-500 to-yellow-500',
      context: 'classrooms'
    },
    {
      to: '/admin/subjects',
      labelKey: 'navigation.subjects',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'from-pink-500 to-rose-500',
      context: 'subjects'
    },
    {
      to: '/admin/lessons',
      labelKey: 'navigation.lessons',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-indigo-500 to-blue-500',
      context: 'lessons'
    },
    {
      to: '/admin/students',
      labelKey: 'navigation.students',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-emerald-500 to-teal-500',
      context: 'students'
    },
    {
      to: '/admin/attendance',
      labelKey: 'navigation.attendance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-green-500 to-emerald-500',
      badge: 'New',
      context: 'attendance'
    },
    {
      to: '/admin/screenshots',
      labelKey: 'navigation.screenshots',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <circle cx="12" cy="13" r="3" strokeWidth={2} />
        </svg>
      ),
      color: 'from-slate-500 to-gray-500',
      context: 'screenshots'
    },
    {
      to: '/admin/technician/register',
      labelKey: 'technician.panel.registerStudents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      color: 'from-violet-500 to-purple-500',
      context: 'technician'
    }
  ];

  // Render sidebar content
  const renderSidebarContent = () => {
    return (
      <div className="h-full flex flex-col relative">
        {/* Decorative background patterns */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl" />
        </div>
      
        {/* Header - Responsive height */}
        <div className="relative flex-shrink-0 p-4 lg:p-5 border-b border-gray-200/50 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {/* Logo and Title */}
            <div className={`flex items-center ${isCollapsed ? 'space-x-0' : 'space-x-3'}`}>
              {isCollapsed ? (
                <button
                  onClick={toggleCollapse}
                  className="relative flex-shrink-0 hover:scale-110 transition-transform duration-200 group"
                  title={t('navigation.expandSidebar')}
                >
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:bg-white/30 transition-all duration-200">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                </button>
              ) : (
                <>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div className="text-white">
                    <h1 className="text-base lg:text-lg font-bold leading-tight">{t('navigation.adminPanel')}</h1>
                    <p className="text-xs text-blue-100 opacity-90">{t('auth.systemTitle')}</p>
                  </div>
                </>
              )}
              
            </div>
            
            {/* Collapse button - Desktop only */}
            {!isCollapsed && (
              <button 
                className="hidden lg:block p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                onClick={toggleCollapse}
                title={t('navigation.collapseSidebar')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Navigation - Optimized spacing */}
        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 lg:px-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {navigationLinks.map((link, index) => {
            const active = isActive(link.to);
            const isContextActive = link.context === currentContext;
            return (
              <NavLink
                key={index}
                to={link.to}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  group relative flex items-center px-3 py-2.5 rounded-xl font-medium text-sm
                  transition-all duration-300 ease-out transform
                  ${active 
                    ? `bg-gradient-to-r ${link.color} text-white shadow-lg scale-[1.02]` 
                    : isContextActive
                      ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? t(link.labelKey) : undefined}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" />
                )}
                
                {/* Icon with dynamic sizing */}
                <div className={`relative flex-shrink-0 transition-all duration-300 ${isCollapsed ? '' : 'mr-3'} ${active ? 'scale-110' : ''}`}>
                  {link.icon}
                </div>
                
                {/* Label and Badge */}
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{t(link.labelKey)}</span>
                    
                    {link.badge && (
                      <span className={`
                        px-2 py-0.5 text-xs font-bold rounded-full ml-2 animate-pulse
                        ${active ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}
                      `}>
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg 
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                    transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                    {t(link.labelKey)}
                    {link.badge && (
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">
                        {link.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* User Profile Section - Responsive */}
        <div className="relative flex-shrink-0 border-t border-gray-200/50 p-3 lg:p-4 bg-gray-50/50">
          {/* Language Switcher - Compact on mobile */}
          {!isCollapsed && (
            <div className="mb-2.5">
              <LanguageSwitcher />
            </div>
          )}
          
          {/* User info card */}
          <div className={`
            mb-2.5 p-2.5 rounded-xl bg-white border border-gray-200/50
            shadow-sm hover:shadow-md transition-all duration-300
            ${isCollapsed ? 'flex justify-center' : ''}
          `}>
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {getInitials(user)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
                    {user?.name || 'Admin'} {user?.surname}
                  </p>
                  <p className="text-xs text-gray-600">
                    {user?.role || t('navigation.adminPanel')}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Logout button - Responsive */}
          <button 
            onClick={handleLogout}
            className={`
              w-full group flex items-center px-3 py-2.5 rounded-xl font-medium text-sm
              bg-gradient-to-r from-red-500 to-pink-500 text-white
              hover:from-red-600 hover:to-pink-600 hover:shadow-lg
              transition-all duration-300 transform hover:scale-[1.02]
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? t('common.logout') : undefined}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 group-hover:rotate-12 ${isCollapsed ? '' : 'mr-2.5'}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span>{t('common.logout')}</span>}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
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
      {/* Mobile backdrop with blur */}
      <div 
        className={`
          fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden
          transition-opacity duration-300
          ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={toggleMobile}
      />
      
      {/* Mobile toggle button - Floating */}
      <button 
        className="fixed top-4 left-4 z-50 lg:hidden p-2.5 bg-white/95 backdrop-blur-md rounded-xl 
          shadow-lg border border-gray-200/50 hover:scale-110 active:scale-95 
          transition-all duration-200"
        onClick={toggleMobile}
        aria-label="Toggle menu"
      >
        <div className="relative w-6 h-6">
          <span className={`absolute top-0 left-0 w-6 h-0.5 bg-gray-700 transform transition-all duration-300 ${isMobileOpen ? 'rotate-45 translate-y-2.5' : ''}`} />
          <span className={`absolute top-2.5 left-0 w-6 h-0.5 bg-gray-700 transition-opacity duration-300 ${isMobileOpen ? 'opacity-0' : ''}`} />
          <span className={`absolute top-5 left-0 w-6 h-0.5 bg-gray-700 transform transition-all duration-300 ${isMobileOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
        </div>
      </button>
      
      {/* Desktop Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-out
        ${isCollapsed ? 'w-20' : 'w-64 xl:w-72'}
        hidden lg:block
      `}>
        <div className="h-full bg-white/95 backdrop-blur-xl shadow-xl border-r border-gray-200/50">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile Sidebar with swipe support */}
      <div 
        className={`
          lg:hidden fixed top-0 left-0 z-50 h-full transition-transform duration-300 ease-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          w-72 sm:w-80
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full bg-white/98 backdrop-blur-xl shadow-2xl">
          {renderSidebarContent()}
        </div>
      </div>
    </>
  );
};

export default Sidebar;