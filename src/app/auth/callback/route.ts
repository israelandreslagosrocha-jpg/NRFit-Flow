import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getStudentProfileByUserId } from '../../../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../../../lib/supabase/membership-helpers';

const STAFF_ROLES = new Set(['OWNER', 'ADMIN']);
const ONBOARDING_PATH = '/auth/onboarding';

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * Completa el intercambio PKCE iniciado por Supabase Auth después de Google.
 * El parámetro `next` no se utiliza como URL arbitraria: solo se admite el
 * onboarding interno para impedir redirecciones abiertas.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedOnboarding = request.nextUrl.searchParams.get('next') === ONBOARDING_PATH;

  if (!code) {
    return redirectTo(request, '/auth/login?error=google');
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectTo(request, '/auth/login?error=google');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo(request, '/auth/login?error=google');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  // La identidad de Google solo autentica. El acceso administrativo depende
  // siempre del rol persistido y protegido en profiles.
  if (profile && STAFF_ROLES.has(profile.role)) {
    return redirectTo(request, '/admin');
  }

  if (requestedOnboarding) {
    return redirectTo(request, ONBOARDING_PATH);
  }

  const resolution = await getStudentProfileByUserId(supabase, user.id);
  if (!resolution.student) {
    return redirectTo(request, ONBOARDING_PATH);
  }

  const access = await checkStudentMembershipAccess(supabase, resolution.student.id);
  return redirectTo(request, access.hasAccess ? '/para-ti' : '/checkout');
}
