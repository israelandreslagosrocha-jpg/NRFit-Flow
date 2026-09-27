'use client';

import React from 'react';
import '../components/landing/Landing.css';
import HeroSection from '../components/landing/HeroSection';
import PreLaunchCampaignSection from '../components/landing/PreLaunchCampaignSection';
import IdentificationSection from '../components/landing/IdentificationSection';
import ParadigmShiftSection from '../components/landing/ParadigmShiftSection';
import NataliaAuthoritySection from '../components/landing/NataliaAuthoritySection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import ProgressionSection from '../components/landing/ProgressionSection';
import DashboardPreviewSection from '../components/landing/DashboardPreviewSection';
import CommunitySection from '../components/landing/CommunitySection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import OfferPricingSection from '../components/landing/OfferPricingSection';
import FaqSection from '../components/landing/FaqSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';

export default function Home() {
  return (
    <main className="landing-page" style={{ background: '#0A0A0C', color: '#FFFFFF', minHeight: '100vh' }}>
      {/* 1. Hero Principal */}
      <HeroSection />

      {/* 2. Campaña de preventa: 5 entrenamientos semanales */}
      <PreLaunchCampaignSection />

      {/* 3. Identificación y Empatía */}
      <IdentificationSection />

      {/* 4. Cambio de Paradigma (Antes vs Después) */}
      <ParadigmShiftSection />

      {/* 5. Natalia Riquelme (Autoridad y Frase Personal) */}
      <NataliaAuthoritySection />

      {/* 6. Cómo Funciona (3 grabados + 2 sesiones LIVE) */}
      <HowItWorksSection />

      {/* 7. Entrenamiento adaptable (todas las rutinas: 10–40 min) */}
      <ProgressionSection />

      {/* 8. Vista Previa del Dashboard de Alumna */}
      <DashboardPreviewSection />

      {/* 9. Comunidad Team Naty */}
      <CommunitySection />

      {/* 10. Testimonios Reales */}
      <TestimonialsSection />

      {/* 11. Oferta oficial de preventa ($21.000 CLP + 7 días gratis) */}
      <OfferPricingSection />

      {/* 12. Preguntas Frecuentes (12 FAQs) */}
      <FaqSection />

      {/* 13. CTA Final */}
      <FinalCtaSection />
    </main>
  );
}
