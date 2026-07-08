import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Metodo403 from './pages/Metodo403';
import Presencial from './pages/Presencial';
import PostParto from './pages/PostParto';

// Helper component to reset scroll position on navigation
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        
        {/* Main content pushed below the fixed header */}
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
    </Router>
  );
}
