'use client';

import React from 'react';
import HeaderDashboard from '../../components/ui/HeaderDashboard';
import SidebarAlumna from '../../components/layout/SidebarAlumna';
import BottomNavAlumna from '../../components/layout/BottomNavAlumna';
import '../../views/alumna/AlumnaDashboardLayout.css';

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="alumna-dashboard-layout container">
      <HeaderDashboard />

      <div className="dashboard-content-wrapper">
        <SidebarAlumna />

        <main className="dashboard-main-view">
          {children}
        </main>
      </div>

      <BottomNavAlumna />
    </div>
  );
}
