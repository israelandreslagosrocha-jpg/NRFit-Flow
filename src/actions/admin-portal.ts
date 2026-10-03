'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { isTeamNatyLiveDay, isValidIsoDate } from '../lib/team-naty-schedule';

const CONTENT_TYPES = new Set(['VIDEO', 'TIP', 'ARTICLE', 'PDF_GUIDE', 'BONUS']);
const STAFF_ROLES = new Set(['ADMIN', 'OWNER']);

type StaffProfile = {
  id: string;
  full_name: string;
  role: string;
};

function messageRedirect(kind: 'success' | 'error', message: string): never {
  redirect(`/admin?${kind}=${encodeURIComponent(message)}`);
}

function value(formData: FormData, field: string, maxLength: number): string {
  const raw = formData.get(field);
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLength);
}

function isIsoDate(input: string): boolean {
  return isValidIsoDate(input);
}

function isTime(input: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(input);
}

function safeHttpsUrl(input: string): string | null {
  if (!input) return null;
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeZoomUrl(input: string): string | null {
  const url = safeHttpsUrl(input);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase();
  return host === 'zoom.us' || host.endsWith('.zoom.us') ? url : null;
}

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function contentFields(formData: FormData) {
  const title = value(formData, 'title', 255);
  const description = value(formData, 'description', 2000);
  const contentType = value(formData, 'type', 30);
  const mediaUrlInput = value(formData, 'media_url', 500);
  const thumbnailUrlInput = value(formData, 'thumbnail_url', 500);
  const mediaUrl = safeHttpsUrl(mediaUrlInput);
  const thumbnailUrl = safeHttpsUrl(thumbnailUrlInput);
  const category = value(formData, 'category', 100);
  const publishDate = value(formData, 'publish_date', 10) || new Date().toISOString().slice(0, 10);
  const durationRaw = value(formData, 'duration_seconds', 8);
  const durationSeconds = durationRaw ? Number(durationRaw) : null;

  if (!title || !CONTENT_TYPES.has(contentType) || !isIsoDate(publishDate)) {
    messageRedirect('error', 'Revisa título, tipo y fecha de publicación.');
  }
  if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86_400)) {
    messageRedirect('error', 'La duración debe ser un número válido de segundos.');
  }
  if (mediaUrlInput && !mediaUrl) {
    messageRedirect('error', 'El enlace de contenido debe comenzar con https://.');
  }
  if (thumbnailUrlInput && !thumbnailUrl) {
    messageRedirect('error', 'La miniatura debe comenzar con https://.');
  }

  return {
    title,
    description: description || null,
    type: contentType,
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl,
    duration_seconds: durationSeconds,
    category: category || null,
    publish_date: publishDate,
  };
}

async function requireStaff(): Promise<StaffProfile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirectedFrom=/admin');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isStaff = Boolean(profile && STAFF_ROLES.has(profile.role));
  if (!isStaff) {
    redirect('/para-ti');
  }

  return profile as StaffProfile;
}

async function notifyActiveStudents(title: string, message: string) {
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from('memberships')
    .select('status, start_date, trial_ends_at, current_period_end, end_date, student:students!inner(profile_id)')
    .in('status', ['TRIAL', 'ACTIVE', 'CANCELLED']);

  if (error) throw new Error('NOTIFICATION_TARGETS_UNAVAILABLE');

  const now = new Date();
  const hasAccess = (membership: any) => {
    if (!membership.start_date || new Date(membership.start_date) > now) return false;
    if (membership.status === 'TRIAL') {
      return Boolean(membership.trial_ends_at && new Date(membership.trial_ends_at) >= now);
    }
    const periodEnd = membership.current_period_end || membership.end_date;
    return Boolean(periodEnd && new Date(periodEnd) >= now);
  };

  const profileIds = [...new Set(
    (memberships || [])
      .filter(hasAccess)
      .map((membership: any) => membership.student?.profile_id)
      .filter((profileId: unknown): profileId is string => typeof profileId === 'string')
  )];

  if (!profileIds.length) return 0;

  const { error: insertError } = await admin.from('notifications').insert(
    profileIds.map((profile_id) => ({
      profile_id,
      title,
      message,
      type: 'NEW_CONTENT',
    }))
  );

  if (insertError) throw new Error('NOTIFICATION_CREATE_FAILED');
  return profileIds.length;
}

export async function publishContentAction(formData: FormData) {
  await requireStaff();
  const content = contentFields(formData);

  const admin = createAdminClient();
  const { error } = await admin.from('content_items').insert({
    ...content,
    access_level: 'MEMBER',
    is_active: true,
  });

  if (error) {
    messageRedirect('error', 'No fue posible publicar el contenido. Inténtalo nuevamente.');
  }

  const recipients = await notifyActiveStudents(
    'Nuevo contenido disponible',
    `${content.title} ya está disponible en tu portal.`
  );

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Contenido publicado y aviso enviado a ${recipients} alumna(s).`);
}

export async function createLiveSessionAction(formData: FormData) {
  const staff = await requireStaff();
  const title = value(formData, 'title', 255);
  const sessionDate = value(formData, 'session_date', 10);
  const startTime = value(formData, 'start_time', 5);
  const zoomUrl = safeZoomUrl(value(formData, 'zoom_join_url', 500));
  const capacityRaw = value(formData, 'max_capacity', 4) || '100';
  const maxCapacity = Number(capacityRaw);

  if (!title || !isIsoDate(sessionDate) || !isTime(startTime) || !zoomUrl) {
    messageRedirect('error', 'Completa título, fecha, hora y un enlace válido de Zoom.');
  }
  if (!isTeamNatyLiveDay(sessionDate)) {
    messageRedirect('error', 'Las sesiones en vivo de Team Naty se programan únicamente los lunes y miércoles.');
  }
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 10_000) {
    messageRedirect('error', 'La capacidad debe ser un número entre 1 y 10.000.');
  }

  const admin = createAdminClient();
  const { data: coach, error: coachError } = await admin
    .from('coaches')
    .upsert({ profile_id: staff.id }, { onConflict: 'profile_id' })
    .select('id')
    .single();

  if (coachError || !coach) {
    messageRedirect('error', 'No fue posible preparar el perfil de instructora.');
  }

  const { error } = await admin.from('sessions').insert({
    title,
    coach_id: coach.id,
    delivery_type: 'ONLINE',
    session_date: sessionDate,
    start_time: startTime,
    max_capacity: maxCapacity,
    zoom_join_url: zoomUrl,
  });

  if (error) {
    messageRedirect('error', 'No fue posible publicar la sesión en vivo.');
  }

  const recipients = await notifyActiveStudents(
    'Nueva sesión en vivo',
    `${title}: ${sessionDate} a las ${startTime}. Podrás entrar a Zoom desde tu portal 15 minutos antes de la clase.`
  );

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Sesión en vivo creada y aviso enviado a ${recipients} alumna(s).`);
}

export async function archiveContentAction(formData: FormData) {
  await requireStaff();
  const contentId = value(formData, 'content_id', 36);

  if (!isUuid(contentId)) {
    messageRedirect('error', 'No se reconoció el contenido que deseas archivar.');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('content_items')
    .update({ is_active: false })
    .eq('id', contentId);

  if (error) {
    messageRedirect('error', 'No fue posible archivar el contenido.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Contenido archivado. Ya no estará visible para las alumnas.');
}

export async function updateContentAction(formData: FormData) {
  await requireStaff();
  const contentId = value(formData, 'content_id', 36);
  if (!isUuid(contentId)) {
    messageRedirect('error', 'No se reconoció el contenido que deseas editar.');
  }

  const content = contentFields(formData);
  const admin = createAdminClient();
  const { error } = await admin
    .from('content_items')
    .update(content)
    .eq('id', contentId);

  if (error) {
    messageRedirect('error', 'No fue posible guardar los cambios del contenido.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Contenido actualizado. El portal de alumnas ya muestra la información nueva.');
}

export async function deleteContentAction(formData: FormData) {
  await requireStaff();
  const contentId = value(formData, 'content_id', 36);
  if (!isUuid(contentId)) {
    messageRedirect('error', 'No se reconoció el contenido que deseas eliminar.');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('content_items')
    .delete()
    .eq('id', contentId);

  if (error) {
    messageRedirect('error', 'No fue posible eliminar el contenido. Prueba ocultarlo en su lugar.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Contenido eliminado definitivamente.');
}

export async function updateLiveSessionAction(formData: FormData) {
  await requireStaff();
  const sessionId = value(formData, 'session_id', 36);
  const title = value(formData, 'title', 255);
  const sessionDate = value(formData, 'session_date', 10);
  const startTime = value(formData, 'start_time', 5);
  const zoomUrl = safeZoomUrl(value(formData, 'zoom_join_url', 500));
  const capacityRaw = value(formData, 'max_capacity', 4) || '100';
  const maxCapacity = Number(capacityRaw);

  if (!isUuid(sessionId) || !title || !isIsoDate(sessionDate) || !isTime(startTime) || !zoomUrl) {
    messageRedirect('error', 'Completa título, fecha, hora y un enlace válido de Zoom.');
  }
  if (!isTeamNatyLiveDay(sessionDate)) {
    messageRedirect('error', 'Las sesiones en vivo de Team Naty se programan únicamente los lunes y miércoles.');
  }
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 10_000) {
    messageRedirect('error', 'La capacidad debe ser un número entre 1 y 10.000.');
  }

  const admin = createAdminClient();
  const { data: existingSession, error: lookupError } = await admin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('delivery_type', 'ONLINE')
    .maybeSingle();

  if (lookupError || !existingSession) {
    messageRedirect('error', 'La clase ya no está disponible para editar.');
  }

  const { error } = await admin
    .from('sessions')
    .update({
      title,
      session_date: sessionDate,
      start_time: startTime,
      zoom_join_url: zoomUrl,
      max_capacity: maxCapacity,
    })
    .eq('id', sessionId)
    .eq('delivery_type', 'ONLINE');

  if (error) {
    messageRedirect('error', 'No fue posible guardar los cambios de la clase.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Clase actualizada. Las alumnas verán los nuevos datos en su portal.');
}

export async function deleteLiveSessionAction(formData: FormData) {
  await requireStaff();
  const sessionId = value(formData, 'session_id', 36);
  if (!isUuid(sessionId)) {
    messageRedirect('error', 'No se reconoció la clase que deseas eliminar.');
  }

  const admin = createAdminClient();
  const { count: bookingCount, error: bookingError } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (bookingError) {
    messageRedirect('error', 'No fue posible comprobar las reservas de esta clase.');
  }
  if ((bookingCount || 0) > 0) {
    messageRedirect('error', 'Esta clase tiene reservas o asistencia. No se elimina automáticamente para proteger el registro de las alumnas.');
  }

  const { error } = await admin
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('delivery_type', 'ONLINE');

  if (error) {
    messageRedirect('error', 'No fue posible eliminar la clase.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Clase eliminada de la agenda.');
}

export async function sendBroadcastNotificationAction(formData: FormData) {
  await requireStaff();
  const title = value(formData, 'title', 255);
  const message = value(formData, 'message', 2000);

  if (!title || !message) {
    messageRedirect('error', 'Por favor ingresa un título y mensaje para la notificación.');
  }

  const recipients = await notifyActiveStudents(title, message);
  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Notificación enviada con éxito a ${recipients} alumna(s).`);
}
