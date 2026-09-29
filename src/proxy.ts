import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server.js';
import { getSupabasePublishableKey, getSupabaseUrl } from './lib/supabase/environment.ts';

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

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
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

  // 4. Si ya está autenticado y visita login o registro, resolver el portal
  // exclusivamente en servidor. Enviar siempre a /para-ti aquí convertiría a
  // un OWNER/ADMIN en una alumna antes de comprobar su rol.
  const isAuthPath = pathname === '/auth/login' || pathname === '/auth/register';
  // Si post-login devuelve un error explícito, se debe permitir que la ruta
  // de acceso lo muestre; volver a post-login aquí produciría un ciclo 302.
  const isLoginError = pathname === '/auth/login' && request.nextUrl.searchParams.has('error');
  if (isAuthPath && user && !isLoginError) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/post-login';
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
