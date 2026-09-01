'use client';

import React from 'react';
import '../components/landing/Landing.css';
import HeroSection from '../components/landing/HeroSection';
import IdentificationSection from '../components/landing/IdentificationSection';
import ParadigmShiftSection from '../components/landing/ParadigmShiftSection';
import NataliaAuthoritySection from '../components/landing/NataliaAuthoritySection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import ProgressionSection from '../components/landing/ProgressionSection';
import DashboardPreviewSection from '../components/landing/DashboardPreviewSection';
import CommunitySection from '../components/landing/CommunitySection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import OfferPricingSection from '../components/landing/OfferPricingSection';
import ReferralSection from '../components/landing/ReferralSection';
import FaqSection from '../components/landing/FaqSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';

export default function Home() {
  return (
    <main className="landing-page" style={{ background: '#0A0A0C', color: '#FFFFFF', minHeight: '100vh' }}>
      {/* 1. Hero Principal */}
      <HeroSection />

      {/* 2. Identificación y Empatía */}
      <IdentificationSection />

      {/* 3. Cambio de Paradigma (Antes vs Después) */}
      <ParadigmShiftSection />

      {/* 4. Natalia Riquelme (Autoridad y Frase Personal) */}
      <NataliaAuthoritySection />

      {/* 5. Cómo Funciona (Lunes VOD + Martes/Jueves LIVE 20:00) */}
      <HowItWorksSection />

      {/* 6. Progresión (20-30 / 30-45 / 45-60 min) */}
      <ProgressionSection />

      {/* 7. Vista Previa del Dashboard de Alumna */}
      <DashboardPreviewSection />

      {/* 8. Comunidad Team Naty */}
      <CommunitySection />

      {/* 9. Testimonios Reales */}
      <TestimonialsSection />

      {/* 10. Oferta Oficial ($25.000 CLP Precio Fundador + 7 Días Gratis) */}
      <OfferPricingSection />

      {/* 11. Programa de Referidos ($25.000 CLP para amigas) */}
      <ReferralSection />

      {/* 12. Preguntas Frecuentes (12 FAQs) */}
      <FaqSection />

      {/* 13. CTA Final */}
      <FinalCtaSection />
    </main>
  );
}
