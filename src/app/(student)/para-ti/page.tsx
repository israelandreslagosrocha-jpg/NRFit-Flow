import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import StudentPortal from '../../../components/student/StudentPortal';

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
  searchParams: Promise<{ zoom?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectedFrom=/para-ti');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  // Consultar simultáneamente contenido, clases en vivo, notificaciones y ficha de alumna
  const [contentResult, sessionsResult, notificationsResult, studentResult] = await Promise.all([
    supabase
      .from('content_items')
      .select('id, title, description, media_url, thumbnail_url, type, category, duration_seconds, publish_date')
      .eq('is_active', true)
      .or(`publish_date.is.null,publish_date.lte.${today}`)
      .order('publish_date', { ascending: false })
      .order('priority', { ascending: false })
      .limit(12),
    supabase
      .from('sessions')
      .select('id, title, session_date, start_time, zoom_join_url')
      .eq('delivery_type', 'ONLINE')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(4),
    profile
      ? supabase
          .from('notifications')
          .select('id, title, message, created_at, is_read')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    profile
      ? supabase
          .from('students')
          .select('id, memberships(status, trial_ends_at, current_period_end, price_contracted, auto_renew, renewal_mode, created_at)')
          .eq('profile_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const student = studentResult.data;
  let measurements: any[] = [];

  if (student?.id) {
    const { data: measurementsData } = await supabase
      .from('body_measurements')
      .select('id, date, weight_kg, waist_cm, hips_cm, notes, created_at')
      .eq('student_id', student.id)
      .order('date', { ascending: false })
      .limit(10);

    measurements = measurementsData || [];
  }

  const rawMemberships = student?.memberships as any[] | undefined;
  const activeMembership = rawMemberships && rawMemberships.length > 0
    ? [...rawMemberships].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    : null;

  const safeSessions = (sessionsResult.data || []).map(({ zoom_join_url, ...session }) => ({
    ...session,
    has_zoom_link: Boolean(zoom_join_url),
  }));
  const query = await searchParams;

  return (
    <StudentPortal
      name={profile?.full_name || user.email?.split('@')[0] || 'Alumna'}
      content={contentResult.data || []}
      sessions={safeSessions}
      notifications={notificationsResult.data || []}
      membership={activeMembership}
      measurements={measurements}
      zoomState={query.zoom}
    />
  );
}
