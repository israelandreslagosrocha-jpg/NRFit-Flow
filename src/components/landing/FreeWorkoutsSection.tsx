'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ExternalLink, Play } from 'lucide-react';
import { YouTubeMark, InstagramMark } from '../SocialMarks';
import { FREE_WORKOUTS, PUBLIC_SOCIAL, freeWorkoutEmbed } from '../../lib/public-social';
import { emitConversion } from '../../lib/analytics-client';
import './FreeWorkoutsSection.css';

export default function FreeWorkoutsSection() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  return <section id="entrenamientos-gratis" className="landing-section free-workouts" aria-labelledby="free-workouts-title">
    <div className="landing-container">
      <div className="free-workouts-heading">
        <div><span className="nt-badge">EMPIEZA POR UNA CLASE GRATIS</span>
          <h2 id="free-workouts-title" className="nt-title">Antes de decidir,<br /><span className="nt-highlight">entrena conmigo.</span></h2>
        </div>
        <p className="nt-subtitle">Conoce mi forma de guiarte con estas clases gratuitas de YouTube. Sin crear una cuenta en la plataforma y a tu ritmo.</p>
      </div>
      <div className="free-workouts-benefits"><span><Check size={16} aria-hidden="true" />Acceso gratuito</span><span><Check size={16} aria-hidden="true" />Desde casa</span><span><Check size={16} aria-hidden="true" />Sin inscripción en la web</span></div>
      <div className="free-workouts-grid">
        {FREE_WORKOUTS.map((video) => <article key={video.id} className="free-workout-card">
          <div className="free-workout-media">
            {activeVideo === video.id && video.playback === 'embedded' ? <iframe title={video.title + ' · Clase gratuita de Naty Entrenadora'} src={freeWorkoutEmbed(video.id)!} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : video.playback === 'youtube' ?
              <a className="free-workout-cover" href={'https://www.youtube.com/watch?v=' + video.id} target="_blank" rel="noopener noreferrer" aria-label={'Ver ' + video.title + ' gratis en YouTube (nueva pestaña)'} onClick={() => emitConversion({ event: 'social_click', network: 'youtube' })}>
                <img src={video.thumbnail} width={640} height={360} loading="lazy" alt={'Miniatura de ' + video.title + ' con Natalia'} />
                <span className="free-workout-play"><Play size={25} fill="currentColor" aria-hidden="true" /><span>Ver en YouTube <ExternalLink size={14} aria-hidden="true" /></span></span>
              </a> :
              <button type="button" className="free-workout-cover" aria-label={'Cargar video de YouTube: ' + video.title} onClick={() => { setActiveVideo(video.id); emitConversion({ event: 'free_workout_open', video: video.id }); }}>
                <img src={video.thumbnail} width={640} height={360} loading="lazy" alt={'Miniatura de ' + video.title + ' con Natalia'} />
                <span className="free-workout-play"><Play size={25} fill="currentColor" aria-hidden="true" /><span>Ver clase gratis</span></span>
              </button>}
          </div>
          <div className="free-workout-info"><span className="free-workout-category">{video.category}</span><h3>{video.title}</h3><p>{video.description}</p>
            {video.playback === 'youtube' && <p className="free-workout-external-note">Esta clase se reproduce directamente en YouTube.</p>}
            <div className="free-workout-links"><a href={'https://www.youtube.com/watch?v=' + video.id} target="_blank" rel="noopener noreferrer" onClick={() => emitConversion({ event: 'social_click', network: 'youtube' })}>Abrir en YouTube <ExternalLink size={14} aria-hidden="true" /><span className="social-sr-only"> (nueva pestaña)</span></a>
              {activeVideo === video.id && <button type="button" onClick={() => setActiveVideo(null)}>Cerrar video</button>}
            </div>
          </div>
        </article>)}
      </div>
      <p className="free-workouts-privacy">Los videos sólo se conectan a YouTube cuando eliges cargarlos. Al hacerlo, se aplica la <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">política de privacidad de Google<span className="social-sr-only"> (nueva pestaña)</span></a>. Si una clase no se reproduce aquí, puedes abrirla en YouTube.</p>
      <a className="free-workouts-channel-link" href={PUBLIC_SOCIAL.youtube + '/videos'} target="_blank" rel="noopener noreferrer" onClick={() => emitConversion({ event: 'social_click', network: 'youtube' })}>Ver todos los videos del canal <ExternalLink size={15} aria-hidden="true" /><span className="social-sr-only"> (nueva pestaña)</span></a>
      <div className="free-workouts-social">
        <div><span className="free-workout-category">SIGAMOS EN CONTACTO</span><h3>Más movimiento, también en tus redes.</h3><p>Suscríbete al canal y sigue a Natalia en Instagram para descubrir nuevas publicaciones.</p></div>
        <div className="free-workouts-social-actions">
          <a className="free-social-button free-social-youtube" href={PUBLIC_SOCIAL.subscribe} target="_blank" rel="noopener noreferrer" onClick={() => emitConversion({ event: 'social_click', network: 'youtube' })}><YouTubeMark size={22} />Suscribirme en YouTube<span className="social-sr-only"> (nueva pestaña)</span></a>
          <a className="free-social-button" href={PUBLIC_SOCIAL.instagram} target="_blank" rel="noopener noreferrer" onClick={() => emitConversion({ event: 'social_click', network: 'instagram' })}><InstagramMark size={21} />Seguir en Instagram<span className="social-sr-only"> (nueva pestaña)</span></a>
        </div>
      </div>
      <div className="free-workouts-membership">
        <div><span className="free-workout-category">¿TE GUSTÓ ENTRENAR CONMIGO?</span><h3>Dale continuidad con el Team Naty.</h3><p>Estas clases son una muestra pública. La membresía suma dos clases en vivo semanales, biblioteca privada y acompañamiento en tu portal.</p></div>
        <Link className="nt-btn nt-btn-primary" href="/auth/register?trial=true" data-conversion-event="enrollment_start" data-conversion-placement="free_workouts">Probar el Team 7 días gratis <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </div>
  </section>;
}
