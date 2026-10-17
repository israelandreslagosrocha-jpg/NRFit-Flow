import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import StudentPortal from '../../../components/student/StudentPortal';
import { getMyFollowUpAction } from '../../../actions/student-follow-up';
import { readAllPortalRows } from '../../../lib/portal-pagination';
import { chileToday } from '../../../lib/student-follow-up';
import { getStudentProfileByUserId } from '../../../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../../../lib/supabase/membership-helpers';

export const metadata: Metadata = {
  title: 'Para ti | Portal de Alumna | Naty Entrenadora',
  description: 'Tu plan diario de entrenamiento, tip de Naty y avance semanal.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudentParaTiPage({
  searchParams,
}: {
  searchParams: Promise<{ zoom?: string; seccion?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectedFrom=/para-ti');

  const identity = await getStudentProfileByUserId(supabase, user.id);
  if (identity.error) throw new Error('PORTAL_IDENTITY_UNAVAILABLE');
  const { profile, student: authorizedStudent } = identity;
  if (profile && ['ADMIN', 'OWNER'].includes(profile.role)) redirect('/admin');
  if (profile?.role !== 'STUDENT' || !authorizedStudent) redirect('/auth/onboarding');
  const access = await checkStudentMembershipAccess(supabase, authorizedStudent.id);
  if (!access.hasAccess) redirect('/checkout');

  const today = chileToday();
  // El layout ya autentica la sesión y valida la membresía antes de renderizar
  // esta página. Usamos el cliente de servidor para que el material publicado
  // se entregue también a cortesías legítimas, sin exponer enlaces Zoom al
  // navegador (se eliminan antes de pasar las props al componente cliente).
  const admin = createAdminClient();

  // Consultar simultáneamente contenido, clases en vivo, notificaciones y ficha de alumna
  const [contentResult, sessionsResult, notificationsResult, studentResult] = await Promise.all([
    readAllPortalRows((from, to) => admin
      .from('content_items')
      .select('id, title, description, media_url, thumbnail_url, type, category, duration_seconds, publish_date')
      .eq('is_active', true)
      .or(`publish_date.is.null,publish_date.lte.${today}`)
      .order('publish_date', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)),
    readAllPortalRows((from, to) => admin
      .from('sessions')
      .select('id, title, session_date, start_time, zoom_join_url')
      .eq('delivery_type', 'ONLINE')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)),
    profile
      ? readAllPortalRows((from, to) => supabase
          .from('notifications')
          .select('id, title, message, created_at, is_read')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to))
      : Promise.resolve([]),
    profile
      ? supabase
          .from('students')
          .select('id, memberships(status, start_date, trial_ends_at, current_period_start, current_period_end, price_contracted, auto_renew, renewal_mode, gateway_status, membership_source, is_complimentary, complimentary_expires_at, discount_percent, discount_status, discount_code, discount_expires_at, created_at)')
          .eq('profile_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const student = studentResult.data;
  let measurements: any[] = [];
  let attendance = { booked: 0, attended: 0, excused: 0, absent: 0 };

  if (student?.id) {
    // El usuario ya fue autenticado y su student.id se resolvió desde su
    // profile. Las métricas agregadas se consultan sólo para esa alumna,
    // nunca para otra cuenta del portal.
    const [measurementsResult, bookingsResult] = await Promise.all([
      supabase
        .from('body_measurements')
        .select('id, date, weight_kg, waist_cm, hips_cm, notes, created_at')
        .eq('student_id', student.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(120),
      admin
        .from('bookings')
        .select('id, attendance(status)')
        .eq('student_id', student.id)
        .limit(100),
    ]);

    measurements = measurementsResult.data || [];
    const bookings = bookingsResult.data || [];
    attendance.booked = bookings.length;
    for (const booking of bookings as Array<{ attendance?: { status?: string } | Array<{ status?: string }> | null }>) {
      const record = Array.isArray(booking.attendance) ? booking.attendance[0] : booking.attendance;
      if (record?.status === 'ATTENDED') attendance.attended += 1;
      if (record?.status === 'ABSENT_EXCUSED') attendance.excused += 1;
      if (record?.status === 'ABSENT_UNEXCUSED') attendance.absent += 1;
    }
  }

  const rawMemberships = student?.memberships as any[] | undefined;
  const activeMembership = rawMemberships && rawMemberships.length > 0
    ? [...rawMemberships].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    : null;

  const safeSessions = sessionsResult.map(({ zoom_join_url, ...session }) => ({
    ...session,
    has_zoom_link: Boolean(zoom_join_url),
  }));
  const query = await searchParams;
  const followUp = await getMyFollowUpAction();

  return (
    <StudentPortal
      name={profile?.full_name || user.email?.split('@')[0] || 'Alumna'}
      content={contentResult}
      sessions={safeSessions}
      notifications={notificationsResult}
      membership={activeMembership}
      measurements={measurements}
      attendance={attendance}
      followUp={followUp}
      initialSection={query.seccion}
      zoomState={query.zoom}
    />
  );
}
