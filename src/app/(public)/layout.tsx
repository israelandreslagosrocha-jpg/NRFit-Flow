import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ConversionEvents from '../../components/analytics/ConversionEvents';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-app-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ConversionEvents />
      <Navbar />
      <main style={{ flex: '1 0 auto', paddingTop: '80px' }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
