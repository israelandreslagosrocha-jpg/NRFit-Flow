import Link from 'next/link';
import { ArrowRight, CalendarDays, Radio, Video } from 'lucide-react';

const campaignVideo = 'https://res.cloudinary.com/dhgifjpkh/video/upload/v1790524410/publicidad_natyentrenadora_i2yefn.mp4';
const campaignPoster = 'https://res.cloudinary.com/dhgifjpkh/image/upload/v1790524324/compressed_ChatGPT_Image_22_sept_2026_02_03_31_p.m._rokwh6.webp';

export default function PreLaunchCampaignSection() {
  return (
    <section id="preventa" className="campaign-section">
      <div className="landing-container campaign-grid">
        <div className="campaign-copy">
          <span className="nt-badge">PREVENTA DE LANZAMIENTO</span>
          <h2 className="nt-title">Cinco entrenamientos cada semana, <span className="nt-highlight">desde tu nivel.</span></h2>
          <p className="nt-subtitle">Una estructura para entrenar desde casa, sostener el hábito y volver a elegirte sin pedirle más horas a tu semana.</p>

          <div className="campaign-details" aria-label="Detalles de la preventa">
            <span><Radio size={17} /> 2 clases en vivo por Zoom</span>
            <span><Video size={17} /> 3 entrenamientos grabados</span>
            <span><CalendarDays size={17} /> Sesiones de 10 a 40 minutos</span>
          </div>

          <div className="campaign-price"><span>PREVENTA</span><strong>$21.000 <small>CLP / mes</small></strong><p>Precio regular: $25.000 CLP / mes.</p></div>

          <Link href="/auth/register?trial=true" className="nt-btn nt-btn-primary" data-conversion-event="enrollment_start" data-conversion-placement="campaign">
            QUIERO RESERVAR MI CUPO <ArrowRight size={18} />
          </Link>
        </div>

        <div className="campaign-video-frame">
          <video controls playsInline preload="metadata" poster={campaignPoster} aria-label="Video de preventa Naty Entrenadora">
            <source src={campaignVideo} type="video/mp4" />
            Tu navegador no puede reproducir este video.
          </video>
        </div>
      </div>
    </section>
  );
}
