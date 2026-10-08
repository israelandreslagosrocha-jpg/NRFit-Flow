import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { createAdminClient } from '../../lib/supabase/admin';
import AdminDashboardClient from './AdminDashboardClient';
import './admin.css';

const STAFF_ROLES = new Set(['ADMIN', 'OWNER']);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirectedFrom=/admin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const isStaff = Boolean(profile && STAFF_ROLES.has(profile.role));
  if (!isStaff) redirect('/para-ti');

  const profileName = profile?.full_name || user.user_metadata?.full_name || 'Natalia';
  const query = await searchParams;

  let students: any[] = [];
  let content: any[] = [];
  let sessions: any[] = [];
  let transactions: any[] = [];

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);

    const [studentsResult, contentResult, sessionsResult, transactionsResult] = await Promise.all([
      admin
        .from('students')
        .select('id, created_at, profile:profiles!inner(id, full_name, user_id), memberships(id, status, start_date, end_date, trial_ends_at, current_period_end, created_at, price_contracted, billing_email, gateway, gateway_subscription_id, membership_source, is_complimentary, complimentary_expires_at, complimentary_revoked_at, discount_percent, discount_status, discount_code, discount_expires_at), membership_discounts(id, source, discount_percent, status, expires_at, membership_id, coupon:coupons(code, expires_at))')
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('content_items')
        .select('id, title, description, type, category, duration_seconds, publish_date, is_active, media_url, thumbnail_url')
        .order('created_at', { ascending: false })
        .limit(24),
      admin
        .from('sessions')
        .select('id, title, session_date, start_time, zoom_join_url, max_capacity')
        .eq('delivery_type', 'ONLINE')
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(10),
      admin
        .from('payment_transactions')
        .select('id, amount, currency, status, payment_method, payment_date, gateway_payment_id')
        .order('payment_date', { ascending: false })
        .limit(20),
    ]);

    students = (studentsResult.data || []).map((s: any) => ({
      ...s,
      profile: Array.isArray(s.profile) ? s.profile[0] : s.profile,
      memberships: [...(s.memberships || [])].sort(
        (a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))
      ),
      membership_discounts: [...(s.membership_discounts || [])].sort(
        (a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))
      ),
    }));

    // Un pago externo o una cuenta sin membresía pueden no tener billing_email.
    // Resolver sólo esos casos desde Auth, después de autorizar al administrador,
    // y entregar al cliente únicamente el correo (nunca el objeto de usuario).
    students = await Promise.all(students.map(async (student) => {
      if (student.memberships[0]?.billing_email?.trim() || !student.profile?.user_id) {
        return student;
      }

      try {
        const { data, error } = await admin.auth.admin.getUserById(student.profile.user_id);
        return { ...student, account_email: error ? null : data.user?.email || null };
      } catch {
        // Un fallo de lectura de Auth no debe ocultar la ficha ni la membresía.
        return { ...student, account_email: null };
      }
    }));
    content = contentResult.data || [];
    sessions = sessionsResult.data || [];
    transactions = transactionsResult.data || [];
  } catch (err) {
    console.error('[AdminPage] Error fetching dashboard data:', err);
  }

  return (
    <AdminDashboardClient
      profileName={profileName}
      students={students}
      content={content}
      sessions={sessions}
      transactions={transactions}
      message={{
        success: query.success,
        error: query.error,
      }}
    />
  );
}
