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
  
  // Check if link is active - Fixed dashboard selection issue
  const isActive = (path: string): boolean => {
    // Per la dashboard, controlla solo il match esatto
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    // Per gli altri path, usa la logica originale
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      )
    },
    {
      to: '/admin/courses',
      labelKey: 'navigation.courses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      to: '/admin/classrooms',
      labelKey: 'navigation.classrooms',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      to: '/admin/subjects',
      labelKey: 'navigation.subjects',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      to: '/admin/lessons',
      labelKey: 'navigation.lessons',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      to: '/admin/students',
      labelKey: 'navigation.students',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      to: '/admin/attendance',
      labelKey: 'navigation.attendance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      badge: 'NEW'
    },
    {
      to: '/admin/screenshots',
      labelKey: 'navigation.screenshots',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <circle cx="12" cy="13" r="3" strokeWidth={1.5} />
        </svg>
      )
    },
    {
      to: '/admin/technician/register',
      labelKey: 'technician.panel.registerStudents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    }
  ];

  // Render sidebar content
  const renderSidebarContent = () => {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        {/* Header - Design coordinato con dashboard */}
        <div className="flex-shrink-0 border-b border-gray-700">
          <div className={`flex items-center ${isCollapsed ? 'justify-center px-3 py-3' : 'justify-between px-4 py-3'}`}>
            {/* Logo e Title - Coordinato con dashboard */}
            <div className={`flex items-center ${isCollapsed ? 'space-x-0' : 'space-x-2'}`}>
              {isCollapsed ? (
                <button
                  onClick={toggleCollapse}
                  className="group relative"
                  title={t('navigation.expandSidebar')}
                >
                  <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors duration-200">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                    </svg>
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-gray-900" />
                </button>
              ) : (
                <>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                      </svg>
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-gray-900" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-white tracking-tight mb-0">{t('navigation.adminPanel')}</h1>
                    <p className="text-xs text-gray-400 font-medium mb-0">{t('auth.systemTitle')}</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Collapse button - Desktop only */}
            {!isCollapsed && (
              <button 
                className="hidden lg:block p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-all duration-200"
                onClick={toggleCollapse}
                title={t('navigation.collapseSidebar')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M11 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Navigation - Coordinata con dashboard */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navigationLinks.map((link, index) => {
            const active = isActive(link.to);
            return (
              <NavLink
                key={index}
                to={link.to}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  group relative flex items-center px-3 py-2.5 rounded-lg font-medium text-sm
                  transition-all duration-200
                  ${active 
                    ? 'bg-gray-700 text-white border border-gray-600 hover:text-blue-400' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? t(link.labelKey) : undefined}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 transition-all duration-200 ${isCollapsed ? '' : 'mr-3'}`}>
                  {link.icon}
                </div>
                
                {/* Label and Badge */}
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{t(link.labelKey)}</span>
                    
                    {link.badge && (
                      <span className={`
                        px-2 py-0.5 text-xs font-semibold rounded
                        ${active ? 'bg-emerald-400 text-gray-900' : 'bg-emerald-400/20 text-emerald-400'}
                      `}>
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg 
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                    transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-gray-700">
                    {t(link.labelKey)}
                    {link.badge && (
                      <span className="ml-2 px-1.5 py-0.5 bg-emerald-400 text-gray-900 text-xs rounded">
                        {link.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* User Profile Section - Coordinata con dashboard */}
        <div className="flex-shrink-0 border-t border-gray-700 p-3">
          {/* Language Switcher */}
          {!isCollapsed && (
            <div className="mb-4">
              <LanguageSwitcher />
            </div>
          )}
          
          {/* User info - Coordinato con dashboard */}
          <div className={`
            mb-2 p-2.5 rounded-lg bg-gray-800 border border-gray-700
            ${isCollapsed ? 'flex justify-center' : ''}
          `}>
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-2.5'}`}>
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                  {getInitials(user)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-gray-800" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white text-sm truncate mb-0">
                    {user?.name || 'Admin'} {user?.surname}
                  </p>
                  <p className="text-xs text-gray-400 font-medium mb-0">
                    {user?.role || t('navigation.adminPanel')}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Logout button - Coordinato con dashboard */}
          <button 
            onClick={handleLogout}
            className={`
              w-full group flex items-center px-2.5 py-2 rounded-lg font-medium text-sm
              bg-gray-800 border border-gray-700 text-gray-400 hover:bg-red-600 hover:text-white hover:border-red-600
              transition-all duration-200
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? t('common.logout') : undefined}
          >
            <svg className={`w-4 h-4 ${isCollapsed ? '' : 'mr-2.5'}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span className="text-sm">{t('common.logout')}</span>}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-gray-700">
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
      {/* Mobile backdrop - Coordinato con tema dark */}
      <div 
        className={`
          fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden
          transition-opacity duration-300
          ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={toggleMobile}
      />
      
      {/* Mobile toggle button - Coordinato con tema dark */}
      <button 
        className="fixed top-4 left-4 z-50 lg:hidden p-3 bg-gray-800 border border-gray-700 rounded-lg"
        onClick={toggleMobile}
        aria-label="Toggle menu"
      >
        <div className="relative w-5 h-5">
          <span className={`absolute top-0 left-0 w-5 h-0.5 bg-gray-300 transform transition-all duration-300 ${isMobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`absolute top-2 left-0 w-5 h-0.5 bg-gray-300 transition-opacity duration-300 ${isMobileOpen ? 'opacity-0' : ''}`} />
          <span className={`absolute top-4 left-0 w-5 h-0.5 bg-gray-300 transform transition-all duration-300 ${isMobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </div>
      </button>
      
      {/* Desktop Sidebar - Coordinato con dashboard dark */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-out
        ${isCollapsed ? 'w-20' : 'w-64'}
        hidden lg:block
      `}>
        <div className="h-full shadow-2xl border-r border-gray-700">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile Sidebar - Coordinato con dashboard dark */}
      <div 
        className={`
          lg:hidden fixed top-0 left-0 z-50 h-full transition-transform duration-300 ease-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          w-72 sm:w-80
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full shadow-2xl border-r border-gray-700">
          {renderSidebarContent()}
        </div>
      </div>
    </>
  );
};

export default Sidebar;