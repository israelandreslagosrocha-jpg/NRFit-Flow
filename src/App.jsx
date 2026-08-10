import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UserDataProvider } from './context/UserDataContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Metodo403 from './pages/Metodo403';
import Presencial from './pages/Presencial';
import PostParto from './pages/PostParto';

import AlumnaDashboardLayout from './pages/alumna/AlumnaDashboardLayout';
import AdminDashboardLayout from './pages/admin/AdminDashboardLayout';

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
                    <Route path="/metodo-40-3" element={<Metodo403 />} />
                    <Route path="/presencial" element={<Presencial />} />
                    <Route path="/post-parto" element={<PostParto />} />
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
