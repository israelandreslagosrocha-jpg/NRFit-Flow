'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { isTeamNatyLiveDay, isValidIsoDate } from '../lib/team-naty-schedule';
import {
  isDiscountPercentage,
  nextCalendarMonthDate,
} from '../lib/memberships/admin-membership';

const CONTENT_TYPES = new Set(['VIDEO', 'TIP', 'ARTICLE', 'PDF_GUIDE', 'BONUS']);
const STAFF_ROLES = new Set(['ADMIN', 'OWNER']);

type StaffProfile = {
  id: string;
  full_name: string;
  role: string;
};

type AdminMembership = {
  id: string;
  plan_id: string;
  status: string;
  gateway: string | null;
  gateway_subscription_id: string | null;
  current_period_end: string | null;
  is_complimentary: boolean | null;
  membership_source: string | null;
  discount_status: string | null;
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

function asDateTimestamp(date: string): string {
  // Se conserva la semántica de fecha de Chile sin depender del huso horario
  // del runtime serverless. El portal presenta estas fechas como calendario.
  return `${date}T12:00:00.000Z`;
}

function todayDate(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validatedOptionalEndDate(input: string, startDate: string, fieldLabel: string): string | null {
  if (!input) return null;
  if (!isIsoDate(input) || input < startDate) {
    messageRedirect('error', `${fieldLabel} debe ser una fecha válida igual o posterior al inicio.`);
  }
  return input;
}

function flowMembershipInProgress(membership: AdminMembership | null): boolean {
  if (!membership || membership.gateway !== 'FLOW') return false;
  return Boolean(membership.gateway_subscription_id) || membership.status === 'PENDING_PAYMENT';
}

async function getLatestMembership(admin: ReturnType<typeof createAdminClient>, studentId: string): Promise<AdminMembership | null> {
  const { data, error } = await admin
    .from('memberships')
    .select('id, plan_id, status, gateway, gateway_subscription_id, current_period_end, is_complimentary, membership_source, discount_status')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('MEMBERSHIP_LOOKUP_FAILED');
  return data as AdminMembership | null;
}

async function getPlanIdForAdminMembership(
  admin: ReturnType<typeof createAdminClient>,
  membership: AdminMembership | null
): Promise<string | null> {
  if (membership?.plan_id) return membership.plan_id;
  const { data, error } = await admin
    .from('plans')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('PLAN_LOOKUP_FAILED');
  return data?.id || null;
}

async function appendMembershipAudit(
  admin: ReturnType<typeof createAdminClient>,
  staff: StaffProfile,
  action: string,
  entityId: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown>,
  entityType = 'memberships'
) {
  const { error } = await admin.from('audit_logs').insert({
    actor_id: staff.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_data: oldData,
    new_data: newData,
  });

  if (error) throw new Error('AUDIT_WRITE_FAILED');
}

function discountCode(): string {
  return `NATY-${randomBytes(4).toString('hex').toUpperCase()}`;
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

/**
 * Registra un pago que Natalia verificó fuera de Flow. Es deliberadamente una
 * renovación manual: no guarda tarjeta ni crea una suscripción en la pasarela.
 */
export async function recordExternalMembershipPaymentAction(formData: FormData) {
  const staff = await requireStaff();
  const studentId = value(formData, 'student_id', 36);
  const paidFrom = value(formData, 'paid_from', 10);
  const amount = Number(value(formData, 'amount', 8));
  const paymentMethod = value(formData, 'payment_method', 40);
  const reference = value(formData, 'payment_reference', 120);

  if (!isUuid(studentId) || !isIsoDate(paidFrom) || paidFrom > todayDate() || !Number.isInteger(amount) || amount <= 0 || amount > 9_999_999) {
    messageRedirect('error', 'Revisa la alumna, fecha y monto del pago externo.');
  }
  if (!['TRANSFERENCIA', 'EFECTIVO', 'OTRO'].includes(paymentMethod) || reference.length < 3) {
    messageRedirect('error', 'Indica el medio y una referencia de pago de al menos 3 caracteres.');
  }

  const nextRenewalDate = nextCalendarMonthDate(paidFrom);
  if (!nextRenewalDate) {
    messageRedirect('error', 'No fue posible calcular la próxima renovación desde esa fecha.');
  }

  const admin = createAdminClient();
  let currentMembership: AdminMembership | null;
  let planId: string | null;
  try {
    currentMembership = await getLatestMembership(admin, studentId);
    planId = await getPlanIdForAdminMembership(admin, currentMembership);
  } catch {
    messageRedirect('error', 'No fue posible preparar la membresía de esta alumna.');
  }

  if (!planId) {
    messageRedirect('error', 'No existe un plan activo para registrar esta membresía.');
  }
  if (flowMembershipInProgress(currentMembership)) {
    messageRedirect('error', 'Esta alumna tiene una suscripción Flow vigente o pendiente. Cancélala primero en Flow antes de registrar un pago externo.');
  }

  const membershipPayload = {
    plan_id: planId,
    status: 'ACTIVE',
    price_contracted: amount,
    start_date: paidFrom,
    end_date: nextRenewalDate,
    current_period_start: asDateTimestamp(paidFrom),
    current_period_end: asDateTimestamp(nextRenewalDate),
    trial_ends_at: null,
    auto_renew: false,
    renewal_mode: 'MANUAL_RENEWAL',
    gateway: 'EXTERNAL',
    gateway_customer_id: null,
    gateway_plan_id: null,
    gateway_subscription_id: null,
    gateway_status: 'external_payment_recorded',
    membership_source: 'EXTERNAL_PAYMENT',
    is_complimentary: false,
    complimentary_expires_at: null,
    complimentary_revoked_at: null,
    discount_percent: null,
    discount_status: 'NONE',
    discount_code: null,
    discount_expires_at: null,
    discount_applied_at: null,
  };

  let membershipId: string;
  const oldData = currentMembership ? {
    status: currentMembership.status,
    gateway: currentMembership.gateway,
    current_period_end: currentMembership.current_period_end,
  } : null;

  if (currentMembership) {
    const { data, error } = await admin
      .from('memberships')
      .update(membershipPayload)
      .eq('id', currentMembership.id)
      .select('id')
      .single();
    if (error || !data) {
      messageRedirect('error', 'No fue posible actualizar la membresía con el pago externo.');
    }
    membershipId = data.id;
  } else {
    const { data, error } = await admin
      .from('memberships')
      .insert({ student_id: studentId, ...membershipPayload })
      .select('id')
      .single();
    if (error || !data) {
      messageRedirect('error', 'No fue posible crear la membresía con el pago externo.');
    }
    membershipId = data.id;
  }

  const { error: transactionError } = await admin.from('payment_transactions').insert({
    membership_id: membershipId,
    gateway_payment_id: `external:${randomUUID()}`,
    gateway: 'EXTERNAL',
    external_reference: reference,
    amount,
    currency: 'CLP',
    status: 'APPROVED',
    payment_method: paymentMethod,
    payment_date: asDateTimestamp(paidFrom),
  });
  if (transactionError) {
    messageRedirect('error', 'La membresía se actualizó, pero no fue posible registrar el comprobante. Revisa la referencia antes de reintentar.');
  }

  try {
    await appendMembershipAudit(admin, staff, 'EXTERNAL_MEMBERSHIP_PAYMENT_RECORDED', membershipId, oldData, {
      amount,
      currency: 'CLP',
      payment_method: paymentMethod,
      reference,
      start_date: paidFrom,
      next_renewal_date: nextRenewalDate,
      source: 'EXTERNAL_PAYMENT',
    });
  } catch {
    messageRedirect('error', 'El pago fue registrado, pero falló su auditoría. No dupliques el registro: contacta a soporte técnico.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Pago externo registrado. La próxima renovación queda para el ${nextRenewalDate}.`);
}

/** Asigna una cortesía temporal o indefinida sin tocar la pasarela Flow. */
export async function assignComplimentaryMembershipAction(formData: FormData) {
  const staff = await requireStaff();
  const studentId = value(formData, 'student_id', 36);
  const startDate = value(formData, 'complimentary_start_date', 10);
  const expiresAt = validatedOptionalEndDate(value(formData, 'complimentary_end_date', 10), startDate, 'La fecha de término');

  if (!isUuid(studentId) || !isIsoDate(startDate)) {
    messageRedirect('error', 'Revisa la alumna y la fecha de inicio de la cortesía.');
  }

  const admin = createAdminClient();
  let currentMembership: AdminMembership | null;
  let planId: string | null;
  try {
    currentMembership = await getLatestMembership(admin, studentId);
    planId = await getPlanIdForAdminMembership(admin, currentMembership);
  } catch {
    messageRedirect('error', 'No fue posible preparar la membresía de esta alumna.');
  }
  if (!planId) messageRedirect('error', 'No existe un plan activo para asignar la cortesía.');
  if (flowMembershipInProgress(currentMembership)) {
    messageRedirect('error', 'Esta alumna tiene una suscripción Flow vigente o pendiente. Cancélala primero en Flow antes de asignar una cortesía.');
  }

  const membershipPayload = {
    plan_id: planId,
    status: 'ACTIVE',
    price_contracted: 0,
    start_date: startDate,
    end_date: expiresAt,
    current_period_start: asDateTimestamp(startDate),
    current_period_end: expiresAt ? asDateTimestamp(expiresAt) : null,
    trial_ends_at: null,
    auto_renew: false,
    renewal_mode: 'EXPIRE_ON_DATE',
    gateway: 'COMPLIMENTARY',
    gateway_customer_id: null,
    gateway_plan_id: null,
    gateway_subscription_id: null,
    gateway_status: 'complimentary_access',
    membership_source: 'COMPLIMENTARY',
    is_complimentary: true,
    complimentary_expires_at: expiresAt ? asDateTimestamp(expiresAt) : null,
    complimentary_revoked_at: null,
    discount_percent: null,
    discount_status: 'NONE',
    discount_code: null,
    discount_expires_at: null,
    discount_applied_at: null,
  };

  let membershipId: string;
  if (currentMembership) {
    const { data, error } = await admin.from('memberships').update(membershipPayload).eq('id', currentMembership.id).select('id').single();
    if (error || !data) messageRedirect('error', 'No fue posible asignar la cortesía.');
    membershipId = data.id;
  } else {
    const { data, error } = await admin.from('memberships').insert({ student_id: studentId, ...membershipPayload }).select('id').single();
    if (error || !data) messageRedirect('error', 'No fue posible crear la cortesía.');
    membershipId = data.id;
  }

  try {
    await appendMembershipAudit(admin, staff, 'COMPLIMENTARY_MEMBERSHIP_ASSIGNED', membershipId, currentMembership ? {
      status: currentMembership.status,
      gateway: currentMembership.gateway,
    } : null, {
      start_date: startDate,
      expires_at: expiresAt,
      revocable: true,
      source: 'COMPLIMENTARY',
    });
  } catch {
    messageRedirect('error', 'La cortesía fue asignada, pero falló su auditoría. No la asignes nuevamente: contacta a soporte técnico.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', expiresAt
    ? `Membresía gratuita asignada hasta el ${expiresAt}.`
    : 'Membresía gratuita asignada hasta que Natalia la revoque.');
}

/** Revoca de forma inmediata una cortesía activa; no altera pagos ni Flow. */
export async function revokeComplimentaryMembershipAction(formData: FormData) {
  const staff = await requireStaff();
  const studentId = value(formData, 'student_id', 36);
  if (!isUuid(studentId)) messageRedirect('error', 'No se reconoció la alumna de esta cortesía.');

  const admin = createAdminClient();
  let membership: AdminMembership | null;
  try {
    membership = await getLatestMembership(admin, studentId);
  } catch {
    messageRedirect('error', 'No fue posible consultar la membresía de esta alumna.');
  }
  if (!membership?.is_complimentary || membership.status !== 'ACTIVE') {
    messageRedirect('error', 'No existe una membresía gratuita activa para revocar.');
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('memberships')
    .update({
      status: 'EXPIRED',
      current_period_end: now,
      complimentary_revoked_at: now,
      gateway_status: 'complimentary_revoked',
      auto_renew: false,
    })
    .eq('id', membership.id);
  if (error) messageRedirect('error', 'No fue posible revocar la membresía gratuita.');

  try {
    await appendMembershipAudit(admin, staff, 'COMPLIMENTARY_MEMBERSHIP_REVOKED', membership.id, {
      status: membership.status,
      is_complimentary: true,
    }, {
      status: 'EXPIRED',
      revoked_at: now,
    });
  } catch {
    messageRedirect('error', 'La cortesía fue revocada, pero falló su auditoría. Contacta a soporte técnico antes de continuar.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', 'Membresía gratuita revocada. El acceso al portal se cerró de inmediato.');
}

/** Asigna un descuento personal al próximo primer mes pagado de una alumna. */
export async function assignPersonalDiscountAction(formData: FormData) {
  const staff = await requireStaff();
  const studentId = value(formData, 'student_id', 36);
  const discountPercent = Number(value(formData, 'discount_percent', 3));
  const expiresAt = value(formData, 'discount_expires_at', 10);

  if (!isUuid(studentId) || !isDiscountPercentage(discountPercent)) {
    messageRedirect('error', 'Selecciona una alumna y un descuento válido de 10%, 15% o 20%.');
  }
  const normalizedExpiry = validatedOptionalEndDate(expiresAt, todayDate(), 'El vencimiento del descuento');

  const admin = createAdminClient();
  let membership: AdminMembership | null;
  try {
    membership = await getLatestMembership(admin, studentId);
  } catch {
    messageRedirect('error', 'No fue posible consultar la cuenta de esta alumna.');
  }

  // También sirve para una prueba que terminó pero nunca llegó a pagar: la
  // alumna conserva su misma membresía, ve el descuento al renovarla y jamás
  // recibe una segunda semana gratuita. Un ciclo que ya tuvo un pago aprobado
  // no puede recibir este beneficio de "primer mes" retrospectivamente.
  let hasApprovedPayment = false;
  if (
    membership
    && !membership.is_complimentary
    && membership.membership_source !== 'EXTERNAL_PAYMENT'
    && ['TRIAL', 'EXPIRED'].includes(membership.status)
  ) {
    const { count, error: paymentHistoryError } = await admin
      .from('payment_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('membership_id', membership.id)
      .in('status', ['APPROVED', 'PAID']);
    if (paymentHistoryError) messageRedirect('error', 'No fue posible validar el historial de pagos de esta alumna.');
    hasApprovedPayment = (count || 0) > 0;
  }

  const targetMembershipId = membership
    && !hasApprovedPayment
    && !membership.is_complimentary
    && membership.membership_source !== 'EXTERNAL_PAYMENT'
    && ['TRIAL', 'EXPIRED'].includes(membership.status)
    && membership.discount_status !== 'APPLIED'
    ? membership.id
    : null;
  const targetStatus = targetMembershipId ? 'RESERVED' : 'AVAILABLE';
  const payload = {
    membership_id: targetMembershipId,
    source: 'PERSONAL',
    discount_percent: discountPercent,
    applies_to: 'FIRST_PAID_CYCLE',
    status: targetStatus,
    expires_at: normalizedExpiry ? asDateTimestamp(normalizedExpiry) : null,
    assigned_by_profile_id: staff.id,
    revoked_at: null,
  };

  const { data: existing } = await admin
    .from('membership_discounts')
    .select('id, membership_id, status')
    .eq('student_id', studentId)
    .eq('source', 'PERSONAL')
    .in('status', ['AVAILABLE', 'RESERVED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let discountId: string;
  if (existing) {
    const { data, error } = await admin.from('membership_discounts').update(payload).eq('id', existing.id).select('id').single();
    if (error || !data) messageRedirect('error', 'No fue posible actualizar el descuento personal.');
    discountId = data.id;
  } else {
    const { data, error } = await admin.from('membership_discounts').insert({ student_id: studentId, coupon_id: null, ...payload }).select('id').single();
    if (error || !data) messageRedirect('error', 'No fue posible asignar el descuento personal.');
    discountId = data.id;
  }

  if (targetMembershipId) {
    const { error } = await admin.from('memberships').update({
      discount_percent: discountPercent,
      discount_status: 'RESERVED',
      discount_code: null,
      discount_expires_at: normalizedExpiry ? asDateTimestamp(normalizedExpiry) : null,
      discount_applied_at: null,
    }).eq('id', targetMembershipId);
    if (error) messageRedirect('error', 'El descuento fue creado, pero no pudo vincularse a la prueba activa.');
  }

  try {
    await appendMembershipAudit(admin, staff, 'PERSONAL_FIRST_CYCLE_DISCOUNT_ASSIGNED', targetMembershipId || discountId, null, {
      student_id: studentId,
      discount_percent: discountPercent,
      expires_at: normalizedExpiry,
      applies_to: 'FIRST_PAID_CYCLE',
      status: targetStatus,
    }, targetMembershipId ? 'memberships' : 'membership_discounts');
  } catch {
    messageRedirect('error', 'El descuento fue asignado, pero falló su auditoría. No lo dupliques: contacta a soporte técnico.');
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Descuento personal de ${discountPercent}% asignado para el primer mes pagado.`);
}

/** Genera un código de invitación de un solo uso para que Natalia lo comparta. */
export async function createReferralCouponAction(formData: FormData) {
  const staff = await requireStaff();
  const studentId = value(formData, 'student_id', 36);
  const discountPercent = Number(value(formData, 'discount_percent', 3));
  const expiresAt = value(formData, 'coupon_expires_at', 10);

  if (!isUuid(studentId) || !isDiscountPercentage(discountPercent)) {
    messageRedirect('error', 'Selecciona una alumna y un descuento válido para la invitada.');
  }
  const normalizedExpiry = validatedOptionalEndDate(expiresAt, todayDate(), 'El vencimiento del cupón');
  if (!normalizedExpiry) messageRedirect('error', 'Todo cupón promocional debe tener una fecha de vencimiento.');

  const admin = createAdminClient();
  let createdCoupon: { id: string; code: string } | null = null;

  // Colisión prácticamente imposible, pero se reintenta para respetar el UNIQUE
  // de base de datos sin aceptar nunca un código duplicado.
  for (let attempt = 0; attempt < 3 && !createdCoupon; attempt += 1) {
    const code = discountCode();
    const { data, error } = await admin
      .from('coupons')
      .insert({
        code,
        discount_type: 'PERCENTAGE',
        discount_value: discountPercent,
        global_max_uses: 1,
        is_active: true,
        issued_to_student_id: studentId,
        issued_by_profile_id: staff.id,
        scope: 'REFERRAL',
        expires_at: asDateTimestamp(normalizedExpiry),
        first_paid_cycle_only: true,
      })
      .select('id, code')
      .maybeSingle();
    if (!error && data) createdCoupon = data;
    if (error && error.code !== '23505') break;
  }

  if (!createdCoupon) {
    messageRedirect('error', 'No fue posible generar el cupón. Inténtalo nuevamente.');
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: staff.id,
    action: 'REFERRAL_COUPON_CREATED',
    entity_type: 'coupons',
    entity_id: createdCoupon.id,
    new_data: {
      code: createdCoupon.code,
      issued_to_student_id: studentId,
      discount_percent: discountPercent,
      expires_at: normalizedExpiry,
      max_uses: 1,
      applies_to: 'FIRST_PAID_CYCLE',
    },
  });
  if (auditError) {
    messageRedirect('error', 'El cupón fue creado, pero falló su auditoría. No generes otro: contacta a soporte técnico.');
  }

  const { data: recipient } = await admin
    .from('students')
    .select('profile_id')
    .eq('id', studentId)
    .maybeSingle();
  if (recipient?.profile_id) {
    const { error: notificationError } = await admin.from('notifications').insert({
      profile_id: recipient.profile_id,
      title: 'Tienes un cupón para invitar a una amiga',
      message: `Comparte el código ${createdCoupon.code}. Da ${discountPercent}% de descuento en su primer mes pagado, mantiene sus 7 días gratis y vence el ${normalizedExpiry}.`,
      type: 'NEW_CONTENT',
    });
    if (notificationError) {
      messageRedirect('error', 'El cupón fue creado y auditado, pero no se pudo enviar el aviso al portal de la alumna.');
    }
  }

  revalidatePath('/admin');
  revalidatePath('/para-ti');
  messageRedirect('success', `Cupón creado: ${createdCoupon.code}. Entrega este código a la invitada; vence el ${normalizedExpiry}.`);
}
