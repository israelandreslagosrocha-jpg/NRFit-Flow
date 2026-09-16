import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { getStudentProfileByUserId, ensureStudentProfile } from '../../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../../lib/supabase/membership-helpers';
import { MembershipGate } from '../../components/ui/MembershipGate';
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

  // 1. Autorización server-side perimetral: getUser() valida la sesión directamente en Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login?redirectedFrom=/para-ti');
  }

  // 2. Jerarquía de identidad estricta: auth.users.id -> profiles.user_id -> students.profile_id
  let resolution = await getStudentProfileByUserId(supabase, user.id);
  if (!resolution.profile) {
    // Fallback de aprovisionamiento si el usuario se registró antes del trigger
    resolution = await ensureStudentProfile(supabase, user);
  }

  const { profile, student } = resolution;

  // Si el perfil no es de rol estudiante (ej: ADMIN, OWNER, COACH), permitir acceso administrativo
  const isStaff = profile && ['ADMIN', 'OWNER', 'COACH'].includes(profile.role);
  if (isStaff) {
    const staffUser = {
      id: profile.id,
      full_name: profile.full_name,
      email: user.email,
      role: profile.role,
    };

    return (
      <div className="alumna-dashboard-layout container">
        <HeaderDashboard serverUser={staffUser} />
        <div className="dashboard-content-wrapper">
          <SidebarAlumna />
          <main className="dashboard-main-view">{children}</main>
        </div>
        <BottomNavAlumna />
      </div>
    );
  }

  // 3. Validación estricta de membresía server-side
  if (!student) {
    // Perfil sin registro en students -> sin acceso
    return (
      <MembershipGate
        evaluation={{
          hasAccess: false,
          status: 'NO_MEMBERSHIP',
          reason: 'No se encontró ficha de alumna asociada a la cuenta',
        }}
        userEmail={user.email}
        userName={profile?.full_name}
      />
    );
  }

  const accessEvaluation = await checkStudentMembershipAccess(supabase, student.id);

  if (!accessEvaluation.hasAccess) {
    // CERO fuga de información: no se renderizan {children} si no hay membresía válida
    return (
      <MembershipGate
        evaluation={accessEvaluation}
        userEmail={user.email}
        userName={profile?.full_name}
      />
    );
  }

  const studentUser = {
    id: profile?.id || user.id,
    full_name: profile?.full_name || 'Alumna',
    email: user.email,
    role: profile?.role || 'STUDENT',
  };

  return (
    <div className="alumna-dashboard-layout container">
      <HeaderDashboard serverUser={studentUser} />

      <div className="dashboard-content-wrapper">
        <SidebarAlumna />

        <main className="dashboard-main-view">{children}</main>
      </div>

      <BottomNavAlumna />
    </div>
  );
}
