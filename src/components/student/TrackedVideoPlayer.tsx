'use client';

import { useEffect, useRef, useState } from 'react';
import { recordPlaybackAction } from '../../actions/student-follow-up';
import { observedSegment, youtubeId } from '../../lib/student-follow-up';
import type { VideoProgress } from '../../lib/student-follow-up';

type YouTubePlayer = {
  getCurrentTime(): number; getDuration(): number; getPlaybackRate(): number;
  getPlayerState(): number; seekTo(seconds: number, allowSeekAhead: boolean): void; destroy(): void;
};
type YouTubeAPI = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let youtubeReady: Promise<YouTubeAPI> | null = null;
function loadYoutubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeReady) return youtubeReady;
  youtubeReady = new Promise<YouTubeAPI>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => { youtubeReady = null; reject(new Error('YOUTUBE_API_TIMEOUT')); }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else { youtubeReady = null; reject(new Error('YOUTUBE_API_UNAVAILABLE')); }
    };
    const existing = document.getElementById('team-naty-youtube-api');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'team-naty-youtube-api'; script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
      script.onerror = () => { window.clearTimeout(timer); script.remove(); youtubeReady = null; reject(new Error('YOUTUBE_API_UNAVAILABLE')); };
      document.head.appendChild(script);
    }
  });
  return youtubeReady;
}

export default function TrackedVideoPlayer({ contentId, mediaUrl, title, embedUrl, progress, onSaved }: {
  contentId: string; mediaUrl: string; title: string; embedUrl: string | null;
  progress?: VideoProgress; onSaved: (progress: VideoProgress) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const native = useRef<HTMLVideoElement>(null);
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  const [fallback, setFallback] = useState(false);
  const [notice, setNotice] = useState('El progreso se guarda durante la reproducción. Completa al menos el 90% para marcarlo como visto.');

  useEffect(() => {
    let disposed = false;
    let player: YouTubePlayer | null = null;
    let previous: { position: number; at: number } | null = null;
    let pending: Array<[number, number]> = [];
    let duration = 0, position = 0, playing = false, busy = false;
    let lastFlush = Date.now();
    let lastSubmittedPosition = -1;
    let everPlayed = false;
    const mountElement = mount.current;
    const id = youtubeId(mediaUrl);

    const flush = async () => {
      if (busy || !everPlayed || duration < 1 || (!pending.length && (position < 1 || Math.floor(position) === lastSubmittedPosition))) return;
      busy = true;
      const batch: Array<[number, number]> = [];
      let seconds = 0;
      while (pending.length && batch.length < 60 && seconds + pending[0][1] - pending[0][0] <= 60) {
        const segment = pending.shift()!; batch.push(segment); seconds += segment[1] - segment[0];
      }
      let wasSaved = false;
      const submittedPosition = Math.min(duration, Math.max(0, Math.floor(position)));
      try {
        const result = await recordPlaybackAction({ contentId, mediaUrl, duration, position: submittedPosition, segments: batch });
        if (result.success) {
          wasSaved = true;
          lastSubmittedPosition = submittedPosition;
          if (result.progress) savedCallback.current(result.progress);
          if (!disposed) setNotice('Progreso de reproducción guardado.');
        } else {
          pending = [...batch, ...pending].slice(-60);
          if (!disposed) setNotice(result.message);
        }
      } catch {
        pending = [...batch, ...pending].slice(-60);
        if (!disposed) setNotice('No pudimos guardar el progreso. Puedes continuar viendo el video.');
      } finally {
        busy = false;
        // El cierre puede ocurrir mientras había un guardado en curso.
        if (disposed && wasSaved && pending.length) void flush();
      }
    };
    const sample = () => {
      const element = native.current;
      const currentDuration = player ? player.getDuration() : element?.duration;
      const currentPosition = player ? player.getCurrentTime() : element?.currentTime;
      const currentPlaying = player ? player.getPlayerState() === 1 : Boolean(element && !element.paused && !element.ended && !element.seeking);
      const rate = player ? player.getPlaybackRate() : element?.playbackRate || 1;
      const at = performance.now();
      if (!Number.isFinite(currentDuration) || !Number.isFinite(currentPosition) || !currentDuration || currentDuration > 21600) return;
      duration = Math.ceil(currentDuration!); position = currentPosition!;
      if (currentPlaying) everPlayed = true;
      if (previous && playing && currentPlaying) {
        const segment = observedSegment(previous.position, position, (at - previous.at) / 1000, rate);
        if (segment) pending.push(segment);
      }
      if (playing && !currentPlaying) void flush();
      playing = currentPlaying;
      previous = { position, at };
      if (pending.length >= 15 || Date.now() - lastFlush >= 15000) { lastFlush = Date.now(); void flush(); }
    };
    if (id && mount.current) {
      void loadYoutubeAPI().then((api) => {
        if (disposed || !mount.current) return;
        const target = document.createElement('div');
        mount.current.appendChild(target);
        player = new api.Player(target, {
          host: 'https://www.youtube-nocookie.com', videoId: id,
          playerVars: { rel: 0, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: () => { if (!disposed && progress && !progress.completed_at && progress.last_position_seconds > 0) player?.seekTo(progress.last_position_seconds, true); },
            onStateChange: sample,
            onError: () => { if (!disposed) setNotice('YouTube no permite reproducir este video. Natalia debe comprobar que esté no listado y permita inserción.'); },
          },
        });
      }).catch(() => { if (!disposed) { setFallback(true); setNotice('Reproductor disponible sin seguimiento: no se pudo cargar la conexión con YouTube.'); } });
    }
    const onNativeReady = () => {
      if (native.current && progress && !progress.completed_at) native.current.currentTime = Math.min(progress.last_position_seconds, native.current.duration || 0);
      sample();
    };
    const element = native.current;
    element?.addEventListener('loadedmetadata', onNativeReady);
    const onSeeking = () => { previous = null; playing = false; };
    element?.addEventListener('seeking', onSeeking);
    element?.addEventListener('pause', sample);
    element?.addEventListener('ended', sample);
    const interval = window.setInterval(sample, 1000);
    const onPageHide = () => { sample(); void flush(); };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      sample(); disposed = true; void flush(); window.clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      element?.removeEventListener('loadedmetadata', onNativeReady);
      element?.removeEventListener('seeking', onSeeking);
      element?.removeEventListener('pause', sample); element?.removeEventListener('ended', sample);
      player?.destroy(); mountElement?.replaceChildren();
    };
    // Sólo se inicializa una vez por versión de video. El progreso actualizado no reinicia el player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, mediaUrl]);

  return <><div className="student-video-frame">
    {embedUrl ? fallback ? <iframe src={embedUrl} title={title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div ref={mount} className="tracked-youtube-player" /> : <video ref={native} controls controlsList="nodownload noremoteplayback" disablePictureInPicture src={mediaUrl}>Tu navegador no permite reproducir este video.</video>}
  </div><p className="student-video-note" role="status">{notice}</p></>;
}
