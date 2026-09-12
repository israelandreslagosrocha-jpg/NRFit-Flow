import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UserDataProvider } from './context/UserDataContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './views/Home';
import Presencial from './views/Presencial';
import PostParto from './views/PostParto';

import AlumnaDashboardLayout from './views/alumna/AlumnaDashboardLayout';
import AdminDashboardLayout from './views/admin/AdminDashboardLayout';

function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <UserDataProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Dashboard Routes (No public navbar/footer needed, they use their own header) */}
            <Route path="/alumna/*" element={<AlumnaDashboardLayout />} />
            <Route path="/admin/*" element={<AdminDashboardLayout />} />

            {/* Public Website Routes */}
            <Route path="/*" element={
              <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Navbar />
                <main style={{ flex: '1 0 auto', paddingTop: '80px' }}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/presencial" element={<Home />} />
                    <Route path="/post-parto" element={<Home />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            } />
          </Routes>
        </Router>
      </UserDataProvider>
    </AuthProvider>
  );
}
