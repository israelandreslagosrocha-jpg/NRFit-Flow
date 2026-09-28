import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import {
  getStudentProfileByUserId,
  isStaffRole,
} from '../../../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../../../lib/supabase/membership-helpers';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * Resuelve el portal después de un login con correo/contraseña.
 *
 * El navegador únicamente inicia la sesión. La decisión de llevar a una
 * persona a administración, entrenamiento o checkout se toma en el servidor
 * con el rol almacenado en `profiles`, nunca desde valores del cliente.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return redirectTo(request, '/auth/login?error=session');
  }

  const resolution = await getStudentProfileByUserId(supabase, user.id);

  // Una falla al consultar el perfil nunca debe degradarse a checkout ni a
  // onboarding: se cierra el paso hasta que la identidad pueda verificarse.
  if (resolution.error) {
    return redirectTo(request, '/auth/login?error=profile');
  }

  // El rol persistido en profiles (y protegido por RLS) es la única fuente
  // autorizada para decidir acceso administrativo.
  if (resolution.profile && isStaffRole(resolution.profile.role)) {
    return redirectTo(request, '/admin');
  }

  // Un usuario autenticado sin perfil aún no puede contratar ni ver contenido
  // hasta que se complete su aprovisionamiento.
  if (!resolution.profile || !resolution.student) {
    return redirectTo(request, '/auth/onboarding');
  }

  const access = await checkStudentMembershipAccess(supabase, resolution.student.id);
  return redirectTo(request, access.hasAccess ? '/para-ti' : '/checkout');
}
