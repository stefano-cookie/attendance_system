// frontend/src/components/layout/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const AdminLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-gray-900 relative">

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggleCollapse={setSidebarCollapsed} 
      />
      
      {/* Main content area - Dynamic margin */}
      <main className={`
        min-h-screen overflow-auto relative z-10 transition-all duration-300 ease-out bg-gray-900
        ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
        pt-16 lg:pt-0
      `}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;