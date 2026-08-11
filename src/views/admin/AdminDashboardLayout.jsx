import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HeaderDashboard from '../../components/ui/HeaderDashboard';
import SidebarAdmin from '../../components/layout/SidebarAdmin';
import AdminDashboardHome from './AdminDashboardHome';
import AdminAlumnas from './AdminAlumnas';
import './AdminDashboardLayout.css';

export default function AdminDashboardLayout() {
  return (
    <div className="admin-dashboard-layout container">
      <HeaderDashboard />

      <div className="dashboard-content-wrapper">
        <SidebarAdmin />

        <main className="dashboard-main-view">
          <Routes>
            <Route path="/" element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardHome />} />
            <Route path="alumnas" element={<AdminAlumnas />} />
            <Route path="planes" element={<AdminDashboardHome />} />
            <Route path="pagos" element={<AdminDashboardHome />} />
            <Route path="contenido" element={<AdminDashboardHome />} />
            <Route path="reportes" element={<AdminDashboardHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
