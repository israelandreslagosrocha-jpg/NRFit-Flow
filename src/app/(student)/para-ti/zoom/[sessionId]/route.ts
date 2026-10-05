import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { getStudentProfileByUserId } from '../../../../../lib/supabase/profile-helpers';
import { checkStudentMembershipAccess } from '../../../../../lib/supabase/membership-helpers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SANTIAGO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function portalRedirect(request: NextRequest, state: string) {
  const url = new URL('/para-ti', request.url);
  url.searchParams.set('zoom', state);
  return NextResponse.redirect(url);
}

function santiagoCivilMinutes(now: Date): number {
  const parts = Object.fromEntries(
    SANTIAGO_FORMATTER.formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / 60_000;
}

function sessionCivilMinutes(sessionDate: string, startTime: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sessionDate);
  const time = /^(\d{2}):(\d{2})/.exec(startTime);
  if (!match || !time) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(time[1]),
    Number(time[2])
  ) / 60_000;
}

function safeZoomUrl(input: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'zoom.us' || host.endsWith('.zoom.us'))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Entrega el enlace de Zoom solo a una alumna con membresía vigente y cerca de la sesión. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  if (!UUID_PATTERN.test(sessionId)) return portalRedirect(request, 'invalid');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login?redirectedFrom=/para-ti', request.url));

  const { student } = await getStudentProfileByUserId(supabase, user.id);
  if (!student) return portalRedirect(request, 'unavailable');

  const access = await checkStudentMembershipAccess(supabase, student.id);
  if (!access.hasAccess) return portalRedirect(request, 'membership');

  // La sesión ya fue autenticada y su membresía validada arriba. El cliente
  // administrativo evita que una cortesía legítima quede bloqueada por una
  // policy histórica; el enlace sigue estando sólo en esta ruta server-side.
  const { data: session } = await createAdminClient()
    .from('sessions')
    .select('session_date, start_time, zoom_join_url')
    .eq('id', sessionId)
    .maybeSingle();

  const zoomUrl = safeZoomUrl(session?.zoom_join_url || null);
  const startsAt = session ? sessionCivilMinutes(session.session_date, session.start_time) : null;
  if (!zoomUrl || startsAt === null) return portalRedirect(request, 'unavailable');

  const elapsedMinutes = santiagoCivilMinutes(new Date()) - startsAt;
  if (elapsedMinutes < -15 || elapsedMinutes > 180) return portalRedirect(request, 'not-ready');

  return NextResponse.redirect(zoomUrl);
}
