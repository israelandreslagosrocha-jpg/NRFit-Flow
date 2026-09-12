import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import HeaderDashboard from '../../components/ui/HeaderDashboard';
import SidebarAlumna from '../../components/layout/SidebarAlumna';
import BottomNavAlumna from '../../components/layout/BottomNavAlumna';
import '../../views/alumna/AlumnaDashboardLayout.css';

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Autorización server-side real: getUser() contacta el auth server y verifica la firma del JWT
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login?redirectedFrom=/para-ti');
  }

  // 2. Consulta de perfil y rol en base de datos mediante RLS
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .single();

  return (
    <div className="alumna-dashboard-layout container">
      <HeaderDashboard serverUser={profile || user} />

      <div className="dashboard-content-wrapper">
        <SidebarAlumna />

        <main className="dashboard-main-view">
          {children}
        </main>
      </div>

      <BottomNavAlumna />
    </div>
  );
}
