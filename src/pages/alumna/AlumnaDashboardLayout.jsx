import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HeaderDashboard from '../../components/ui/HeaderDashboard';
import SidebarAlumna from '../../components/layout/SidebarAlumna';
import BottomNavAlumna from '../../components/layout/BottomNavAlumna';
import AlumnaParaTi from './AlumnaParaTi';
import AlumnaExplorar from './AlumnaExplorar';
import AlumnaMiPlan from './AlumnaMiPlan';
import AlumnaBiblioteca from './AlumnaBiblioteca';
import AlumnaProgreso from './AlumnaProgreso';
import AlumnaComunidad from './AlumnaComunidad';
import './AlumnaDashboardLayout.css';

export default function AlumnaDashboardLayout() {
  return (
    <div className="alumna-dashboard-layout container">
      <HeaderDashboard />

      <div className="dashboard-content-wrapper">
        <SidebarAlumna />

        <main className="dashboard-main-view">
          <Routes>
            <Route path="/" element={<Navigate to="para-ti" replace />} />
            <Route path="para-ti" element={<AlumnaParaTi />} />
            <Route path="explorar" element={<AlumnaExplorar />} />
            <Route path="mi-plan" element={<AlumnaMiPlan />} />
            <Route path="biblioteca" element={<AlumnaBiblioteca />} />
            <Route path="progreso" element={<AlumnaProgreso />} />
            <Route path="comunidad" element={<AlumnaComunidad />} />
          </Routes>
        </main>
      </div>

      <BottomNavAlumna />
    </div>
  );
}
