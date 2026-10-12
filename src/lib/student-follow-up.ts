/** Datos de acompañamiento. Nunca se envían a Analytics ni representan ejercicio realizado. */
export type VideoProgress = {
  content_item_id: string;
  title?: string;
  watched_seconds: number;
  last_position_seconds: number;
  duration_seconds: number;
  completed_at: string | null;
  last_watched_at: string;
};
export type CoachNote = {
  id: string; title: string; message: string; resource_url: string | null;
  visible_to_student: boolean; created_at: string;
};
export type Measurement = {
  id: string; date: string; weight_kg: number | null; waist_cm: number | null;
  hips_cm: number | null; notes: string | null;
};
export type PlaybackObservation = {
  contentId: string; mediaUrl: string; duration: number; position: number;
  segments: Array<[number, number]>;
};
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isNegotiatedPrice(value: unknown): value is 21000 | 25000 {
  return value === 21000 || value === 25000;
}
export function chileToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function playbackPercent(progress: Pick<VideoProgress, 'watched_seconds' | 'duration_seconds'>): number {
  return progress.duration_seconds > 0 ? Math.min(100, Math.round(progress.watched_seconds / progress.duration_seconds * 100)) : 0;
}
/** Un salto del cabezal no cuenta como segundos vistos. Las repeticiones se unen en SQL. */
export function observedSegment(previous: number, current: number, elapsedSeconds: number, playbackRate: number): [number, number] | null {
  if (![previous, current, elapsedSeconds, playbackRate].every(Number.isFinite)) return null;
  const delta = current - previous;
  if (delta <= 0 || elapsedSeconds <= 0 || elapsedSeconds > 3 || playbackRate <= 0 || playbackRate > 4 || delta > elapsedSeconds * playbackRate + 0.6) return null;
  const start = Math.floor(previous);
  const end = Math.floor(current);
  return end > start ? [start, end] : null;
}
export function validObservation(input: PlaybackObservation): boolean {
  if (!input || !UUID_PATTERN.test(input.contentId) || typeof input.mediaUrl !== 'string' || input.mediaUrl.length > 2048) return false;
  if (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > 21600 || !Number.isFinite(input.position) || input.position < 0 || input.position > input.duration) return false;
  if (!Array.isArray(input.segments) || input.segments.length > 60) return false;
  let total = 0;
  for (const segment of input.segments) {
    if (!Array.isArray(segment) || segment.length !== 2) return false;
    const [start, end] = segment;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > input.duration) return false;
    total += end - start;
  }
  return total <= 60;
}
export function youtubeId(mediaUrl: string): string | null {
  try {
    const url = new URL(mediaUrl);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.split('/')[1] : ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host) ? url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
