import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server.js';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Compatibilidad de rutas legadas: Redirección TEMPORAL HTTP 307 de /alumna/* hacia /para-ti
  if (pathname.startsWith('/alumna')) {
    const url = request.nextUrl.clone();
    url.pathname = '/para-ti';
    return NextResponse.redirect(url, { status: 307 });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 2. Refrescar sesión SSR y obtener usuario verificado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Filtro perimetral para rutas protegidas
  const isProtectedPath = pathname.startsWith('/para-ti') || pathname.startsWith('/admin');

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url);
  }

  // 4. Si ya está autenticado y visita login o registro, enviar al portal
  // (El layout server-side de /para-ti evaluará la membresía y mostrará MembershipGate si no tiene acceso)
  const isAuthPath = pathname === '/auth/login' || pathname === '/auth/register';
  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/para-ti';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
