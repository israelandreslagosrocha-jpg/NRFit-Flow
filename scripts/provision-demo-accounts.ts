import { createClient } from '@supabase/supabase-js';

const DEMO_CONFIRMATION = 'CREATE_DEMO_ACCOUNTS';
const TEAM_NATY_PLAN_ID = 'b0000000-0000-0000-0000-000000000001';

type AdminClient = any;
type AuthUser = { id: string; email?: string | null };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

function futureIsoDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function findUserByEmail(supabase: AdminClient, email: string): Promise<AuthUser | null> {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`No fue posible revisar Auth: ${error.message}`);

    const user = data.users.find((candidate: AuthUser) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function ensureAuthUser(
  supabase: AdminClient,
  input: { email: string; password: string; fullName: string }
): Promise<AuthUser> {
  const existing = await findUserByEmail(supabase, input.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, demo_account: true },
  });

  if (error || !data.user) {
    throw new Error(`No fue posible crear ${input.email}: ${error?.message || 'usuario no devuelto'}`);
  }

  return data.user;
}

async function ensureProfile(
  supabase: AdminClient,
  input: { userId: string; fullName: string; role: 'OWNER' | 'STUDENT' }
) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: input.userId, full_name: input.fullName, role: input.role },
      { onConflict: 'user_id' }
    )
    .select('id, user_id, role')
    .single();

  if (error || !data) throw new Error(`No fue posible preparar el perfil ${input.fullName}: ${error?.message || 'sin perfil'}`);
  return data as { id: string; user_id: string; role: 'OWNER' | 'STUDENT' };
}

async function ensureStudent(supabase: AdminClient, profileId: string) {
  const { data, error } = await supabase
    .from('students')
    .upsert({ profile_id: profileId }, { onConflict: 'profile_id' })
    .select('id, profile_id')
    .single();

  if (error || !data) throw new Error(`No fue posible preparar la ficha de alumna: ${error?.message || 'sin ficha'}`);
  return data as { id: string; profile_id: string };
}

async function ensureDemoMembership(supabase: AdminClient, studentId: string) {
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id')
    .eq('id', TEAM_NATY_PLAN_ID)
    .eq('is_active', true)
    .maybeSingle();

  if (planError || !plan) {
    throw new Error('No existe el plan Team Naty de preventa. Aplica primero las migraciones y el seed en el entorno de pruebas.');
  }

  const today = todayIsoDate();
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('id, status, end_date')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (membershipError) throw new Error(`No fue posible revisar la membresía demo: ${membershipError.message}`);

  const activeMembership = (memberships || []).find((membership) =>
    membership.status === 'ACTIVE' && membership.end_date >= today
  );
  if (activeMembership) return activeMembership.id as string;

  const { data: membership, error } = await supabase
    .from('memberships')
    .insert({
      student_id: studentId,
      plan_id: plan.id,
      status: 'ACTIVE',
      auto_renew: false,
      renewal_mode: 'MANUAL_RENEWAL',
      price_contracted: 0,
      start_date: today,
      end_date: futureIsoDate(365),
    })
    .select('id')
    .single();

  if (error || !membership) throw new Error(`No fue posible crear la membresía demo: ${error?.message || 'sin membresía'}`);
  return membership.id as string;
}

async function main() {
  if (process.env.DEMO_PROVISIONING_CONFIRMED !== DEMO_CONFIRMATION) {
    throw new Error(`Operación detenida. Define DEMO_PROVISIONING_CONFIRMED=${DEMO_CONFIRMATION} para crear datos demo en el proyecto Supabase configurado.`);
  }

  const supabase = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const natalia = await ensureAuthUser(supabase, {
    email: required('DEMO_NATALIA_EMAIL'),
    password: required('DEMO_NATALIA_PASSWORD'),
    fullName: 'Natalia Riquelme',
  });
  const alumna = await ensureAuthUser(supabase, {
    email: required('DEMO_ALUMNA_EMAIL'),
    password: required('DEMO_ALUMNA_PASSWORD'),
    fullName: 'Alumna Demo Team Naty',
  });

  const nataliaProfile = await ensureProfile(supabase, {
    userId: natalia.id,
    fullName: 'Natalia Riquelme',
    role: 'OWNER',
  });
  const { error: staleStudentError } = await supabase
    .from('students')
    .delete()
    .eq('profile_id', nataliaProfile.id);
  if (staleStudentError) throw new Error(`No fue posible limpiar la ficha de alumna de Natalia: ${staleStudentError.message}`);

  const alumnaProfile = await ensureProfile(supabase, {
    userId: alumna.id,
    fullName: 'Alumna Demo Team Naty',
    role: 'STUDENT',
  });
  const student = await ensureStudent(supabase, alumnaProfile.id);
  await ensureDemoMembership(supabase, student.id);

  console.log('Cuentas demo listas. No se creó ningún cobro ni se llamó a Flow.');
  console.log(`Natalia (OWNER): ${natalia.email} → /admin`);
  console.log(`Alumna demo (STUDENT con membresía ACTIVE sin cobro): ${alumna.email} → /para-ti`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
