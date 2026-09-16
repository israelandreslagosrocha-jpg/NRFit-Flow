import { SupabaseClient } from '@supabase/supabase-js';

export interface ProfileRecord {
  id: string;
  user_id: string;
  full_name: string;
  role: 'STUDENT' | 'COACH' | 'ADMIN' | 'OWNER';
  created_at: string;
  updated_at: string;
}

export interface StudentRecord {
  id: string;
  profile_id: string;
  phone?: string | null;
  emergency_contact?: string | null;
  created_at: string;
}

export interface StudentProfileResolution {
  profile: ProfileRecord | null;
  student: StudentRecord | null;
  error?: string;
}

/**
 * Resuelve la jerarquía de identidad:
 * auth.users.id -> profiles.user_id -> students.profile_id
 * 
 * IMPORTANTE:
 * - Nunca asume que auth.users.id === profiles.id
 * - No consulta columnas inexistentes (ej: profile.email)
 */
export async function getStudentProfileByUserId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<StudentProfileResolution> {
  if (!authUserId) {
    return { profile: null, student: null, error: 'authUserId is required' };
  }

  // 1. Obtener perfil por user_id (clave foránea hacia auth.users)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, role, created_at, updated_at')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (profileError) {
    return { profile: null, student: null, error: profileError.message };
  }

  if (!profile) {
    return { profile: null, student: null };
  }

  // 2. Si el rol no es STUDENT, no esperamos necesariamente un registro en students
  if (profile.role !== 'STUDENT') {
    return { profile: profile as ProfileRecord, student: null };
  }

  // 3. Obtener registro de estudiante por profile_id
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, profile_id, phone, emergency_contact, created_at')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (studentError) {
    return { profile: profile as ProfileRecord, student: null, error: studentError.message };
  }

  return {
    profile: profile as ProfileRecord,
    student: student as StudentRecord | null,
  };
}

/**
 * Aprovisionamiento resiliente de profile y student para usuarios existentes o nuevos
 * en caso de que el trigger de base de datos no haya corrido (fallback seguro).
 */
export async function ensureStudentProfile(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string; user_metadata?: Record<string, any> }
): Promise<StudentProfileResolution> {
  const existing = await getStudentProfileByUserId(supabase, authUser.id);
  if (existing.profile && existing.student) {
    return existing;
  }

  let profile = existing.profile;
  if (!profile) {
    const rawMeta = authUser.user_metadata || {};
    const fullName =
      rawMeta.full_name ||
      rawMeta.name ||
      (authUser.email ? authUser.email.split('@')[0] : null) ||
      'Alumna';

    const { data: newProfile, error: insertProfError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: authUser.id,
          full_name: fullName,
          role: 'STUDENT',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('id, user_id, full_name, role, created_at, updated_at')
      .single();

    if (insertProfError) {
      return { profile: null, student: null, error: insertProfError.message };
    }
    profile = newProfile as ProfileRecord;
  }

  let student = existing.student;
  if (!student && profile && profile.role === 'STUDENT') {
    const rawMeta = authUser.user_metadata || {};
    const { data: newStudent, error: insertStudError } = await supabase
      .from('students')
      .upsert(
        {
          profile_id: profile.id,
          phone: rawMeta.phone || null,
        },
        { onConflict: 'profile_id' }
      )
      .select('id, profile_id, phone, emergency_contact, created_at')
      .single();

    if (insertStudError) {
      return { profile, student: null, error: insertStudError.message };
    }
    student = newStudent as StudentRecord;
  }

  return { profile, student };
}
