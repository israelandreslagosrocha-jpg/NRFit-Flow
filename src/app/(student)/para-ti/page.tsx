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

export default async function StudentParaTiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectedFrom=/para-ti');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  const [contentResult, sessionsResult, notificationsResult] = await Promise.all([
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
  ]);

  return (
    <StudentPortal
      name={profile?.full_name || user.email?.split('@')[0] || 'Alumna'}
      content={contentResult.data || []}
      sessions={sessionsResult.data || []}
      notifications={notificationsResult.data || []}
    />
  );
}
