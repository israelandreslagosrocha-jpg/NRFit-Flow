'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { getStudentProfileByUserId } from '../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../lib/supabase/membership-helpers';
import { UUID_PATTERN, validObservation, isNegotiatedPrice, chileToday } from '../lib/student-follow-up';
import type { PlaybackObservation, VideoProgress, CoachNote, Measurement } from '../lib/student-follow-up';

type Result = { success: boolean; message: string };
export type DetailMembership = {
  id: string; price_contracted: number | null; status: string;
  gateway_subscription_id: string | null; is_complimentary: boolean | null;
};
export type StudentDetail = {
  measurements: Measurement[]; videos: VideoProgress[]; notes: CoachNote[];
  membership: DetailMembership | null;
  availability: { measurements: boolean; videos: boolean; notes: boolean; membership: boolean };
};

async function staffIdentity() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error('STAFF_REQUIRED');
  const { data: profile, error } = await auth.from('profiles').select('id, role').eq('user_id', user.id).maybeSingle();
  if (error || !profile || !['ADMIN', 'OWNER'].includes(profile.role)) throw new Error('STAFF_REQUIRED');
  return profile.id as string;
}

function videoDTO(rows: any[]): VideoProgress[] {
  return rows.flatMap((row) => {
    const item = Array.isArray(row.content) ? row.content[0] : row.content;
    // Una URL editada por Natalia invalida la observación de la versión anterior.
    if (!item || item.media_url !== row.media_url) return [];
    return [{ content_item_id: row.content_item_id, title: item.title,
      watched_seconds: Number(row.watched_seconds), last_position_seconds: row.last_position_seconds,
      duration_seconds: row.duration_seconds, completed_at: row.completed_at, last_watched_at: row.last_watched_at }];
  });
}
const VIDEO_COLUMNS = 'content_item_id, media_url, watched_seconds, last_position_seconds, duration_seconds, completed_at, last_watched_at, content:content_items(title, media_url)';
const NOTE_COLUMNS = 'id, title, message, resource_url, visible_to_student, created_at';

/** Devuelve sólo la ficha seleccionada, nunca todas las medidas en la carga del panel. */
export async function getStudentDetailAction(studentId: string): Promise<{ success: true; detail: StudentDetail } | { success: false; message: string }> {
  try {
    await staffIdentity();
    if (!UUID_PATTERN.test(studentId)) return { success: false, message: 'Alumna no válida.' };
    const admin = createAdminClient();
    const { data: student, error } = await admin.from('students').select('id, profile:profiles!inner(role)').eq('id', studentId).maybeSingle();
    const profile = Array.isArray(student?.profile) ? student.profile[0] : student?.profile;
    if (error || !student || profile?.role !== 'STUDENT') return { success: false, message: 'No se encontró una ficha de alumna.' };
    const [measurements, videos, notes, membership] = await Promise.all([
      admin.from('body_measurements').select('id, date, weight_kg, waist_cm, hips_cm, notes').eq('student_id', studentId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(120),
      admin.from('student_video_progress').select(VIDEO_COLUMNS).eq('student_id', studentId).order('last_watched_at', { ascending: false }).limit(100),
      admin.from('student_coach_notes').select(NOTE_COLUMNS).eq('student_id', studentId).order('created_at', { ascending: false }).limit(50),
      admin.from('memberships').select('id, price_contracted, status, gateway_subscription_id, is_complimentary').eq('student_id', studentId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { success: true, detail: {
      measurements: measurements.data || [], videos: videoDTO(videos.data || []), notes: notes.data || [], membership: membership.data,
      availability: { measurements: !measurements.error, videos: !videos.error, notes: !notes.error, membership: !membership.error },
    } };
  } catch { return { success: false, message: 'No fue posible abrir la ficha. Verifica tu sesión e inténtalo nuevamente.' }; }
}

/** La destinataria nunca se deriva de un correo ni de un perfil enviado por el navegador. */
export async function sendStudentNoteAction(input: { studentId: string; title: string; message: string; resourceUrl: string; shared: boolean }): Promise<Result> {
  try {
    const actor = await staffIdentity();
    if (!input || !UUID_PATTERN.test(input.studentId) || typeof input.title !== 'string' || typeof input.message !== 'string' || typeof input.resourceUrl !== 'string' || typeof input.shared !== 'boolean') return { success: false, message: 'Datos no válidos.' };
    const title = input.title.trim(), message = input.message.trim(), resource = input.resourceUrl.trim();
    if (!title || title.length > 160 || !message || message.length > 3000 || resource.length > 2048) return { success: false, message: 'Revisa el título y el mensaje.' };
    if (resource) {
      const url = new URL(resource);
      if (url.protocol !== 'https:' || url.username || url.password) return { success: false, message: 'El material debe tener un enlace HTTPS seguro.' };
    }
    const { error } = await createAdminClient().rpc('send_student_coach_note', {
      p_actor: actor, p_student: input.studentId, p_title: title, p_message: message, p_resource: resource || null, p_shared: input.shared,
    });
    if (error) return { success: false, message: error.message.includes('NOTE_RATE_LIMIT') ? 'Espera unos segundos antes de enviar otro mensaje.' : 'No se pudo guardar. Verifica que el SQL de acompañamiento esté aplicado.' };
    revalidatePath('/para-ti');
    return { success: true, message: input.shared ? 'Mensaje personal enviado al portal de esta alumna.' : 'Nota interna guardada. Sólo administración puede verla.' };
  } catch { return { success: false, message: 'No fue posible guardar. Revisa la sesión y el enlace del material.' }; }
}

export async function setStudentPriceAction(input: { studentId: string; membershipId: string; expectedPrice: number | null; price: number }): Promise<Result> {
  try {
    const actor = await staffIdentity();
    if (!input || !UUID_PATTERN.test(input.studentId) || !UUID_PATTERN.test(input.membershipId) || !isNegotiatedPrice(input.price) || (input.expectedPrice !== null && !Number.isFinite(input.expectedPrice))) return { success: false, message: 'Elige $21.000 o $25.000.' };
    const { error } = await createAdminClient().rpc('set_student_monthly_price', {
      p_actor: actor, p_student: input.studentId, p_membership: input.membershipId, p_expected_price: input.expectedPrice, p_price: input.price,
    });
    if (error) {
      if (error.message.includes('FLOW_PRICE_SYNC_REQUIRED')) return { success: false, message: 'Hay una suscripción o pago Flow en curso. El valor no se cambió: requiere sincronizar Flow sin ajustes al ciclo ya pagado.' };
      if (error.message.includes('STALE_MEMBERSHIP')) return { success: false, message: 'La membresía cambió. Actualiza la ficha y revisa su valor antes de guardar.' };
      if (error.message.includes('COMPLIMENTARY_PRICE_BLOCKED')) return { success: false, message: 'Esta alumna tiene cortesía. No se convierte una cortesía en una membresía pagada al cambiar el precio.' };
      return { success: false, message: 'No se pudo guardar el valor. Verifica que el SQL de acompañamiento esté aplicado.' };
    }
    revalidatePath('/admin'); revalidatePath('/para-ti'); revalidatePath('/checkout');
    return { success: true, message: 'Valor acordado para próximos pagos. No se realizó ningún cobro ni se modificaron pagos anteriores.' };
  } catch { return { success: false, message: 'No fue posible guardar. Verifica tu sesión.' }; }
}

export async function getMyFollowUpAction(): Promise<{ videos: VideoProgress[]; notes: CoachNote[]; available: boolean }> {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { videos: [], notes: [], available: false };
    const { student } = await getStudentProfileByUserId(auth, user.id);
    if (!student) return { videos: [], notes: [], available: false };
    const [videos, notes] = await Promise.all([
      auth.from('student_video_progress').select(VIDEO_COLUMNS).eq('student_id', student.id).order('last_watched_at', { ascending: false }).limit(100),
      auth.from('student_coach_notes').select(NOTE_COLUMNS).eq('student_id', student.id).eq('visible_to_student', true).order('created_at', { ascending: false }).limit(50),
    ]);
    return { videos: videoDTO(videos.data || []), notes: notes.data || [], available: !videos.error && !notes.error };
  } catch { return { videos: [], notes: [], available: false }; }
}

export async function recordPlaybackAction(input: PlaybackObservation): Promise<Result & { progress?: VideoProgress }> {
  if (!validObservation(input)) return { success: false, message: 'Observación de reproducción no válida.' };
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return { success: false, message: 'Tu sesión expiró.' };
    const { student } = await getStudentProfileByUserId(auth, user.id);
    if (!student) return { success: false, message: 'No se encontró tu ficha.' };
    const admin = createAdminClient();
    const access = await checkStudentMembershipAccess(admin, student.id);
    if (!access.hasAccess) return { success: false, message: 'Tu membresía no está vigente.' };
    const { data: content } = await admin.from('content_items').select('id').eq('id', input.contentId).eq('media_url', input.mediaUrl).eq('type', 'VIDEO').eq('is_active', true).or(`publish_date.is.null,publish_date.lte.${chileToday()}`).maybeSingle();
    if (!content) return { success: false, message: 'El contenido cambió o ya no está disponible.' };
    const { error } = await admin.rpc('record_student_playback', {
      p_student: student.id, p_content: input.contentId, p_media: input.mediaUrl,
      p_duration: input.duration, p_position: Math.floor(input.position), p_segments: input.segments,
    });
    if (error) return { success: false, message: 'El video puede reproducirse, pero no se pudo guardar el progreso.' };
    const { data: progress } = await admin.from('student_video_progress').select('content_item_id, watched_seconds, last_position_seconds, duration_seconds, completed_at, last_watched_at').eq('student_id', student.id).eq('content_item_id', input.contentId).maybeSingle();
    return { success: true, message: 'Progreso de reproducción guardado.', progress: progress ? { ...progress, watched_seconds: Number(progress.watched_seconds) } : undefined };
  } catch { return { success: false, message: 'El video puede reproducirse, pero no se pudo guardar el progreso.' }; }
}
