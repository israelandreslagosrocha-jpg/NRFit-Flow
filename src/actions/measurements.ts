'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../lib/supabase/server';
import { createAdminClient } from '../lib/supabase/admin';
import { getStudentProfileByUserId } from '../lib/supabase/profile-helpers';

export type MeasurementInput = {
  weight_kg: number;
  waist_cm?: number | null;
  hips_cm?: number | null;
  notes?: string | null;
};

export type MeasurementResult = {
  success: boolean;
  message: string;
};

export type NotificationResult = {
  success: boolean;
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function recordMeasurementAction(input: MeasurementInput): Promise<MeasurementResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Sesión no válida o expirada.' };
    }

    const { student } = await getStudentProfileByUserId(supabase, user.id);
    if (!student) {
      return { success: false, message: 'No se encontró ficha de alumna asociada.' };
    }

    const weight = Number(input.weight_kg);
    if (isNaN(weight) || weight < 30 || weight > 250) {
      return { success: false, message: 'El peso ingresado debe estar entre 30 y 250 kg.' };
    }

    const waist = optionalNumber(input.waist_cm);
    if (waist !== null) {
      if (waist < 40 || waist > 200) {
        return { success: false, message: 'La cintura ingresada debe estar entre 40 y 200 cm.' };
      }
    }

    const hips = optionalNumber(input.hips_cm);
    if (hips !== null) {
      if (hips < 40 || hips > 220) {
        return { success: false, message: 'La cadera ingresada debe estar entre 40 y 220 cm.' };
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const admin = createAdminClient();

    const { error: insertError } = await admin
      .from('body_measurements')
      .insert({
        student_id: student.id,
        date: today,
        weight_kg: weight,
        waist_cm: waist,
        hips_cm: hips,
        notes: input.notes ? input.notes.slice(0, 500) : null,
      });

    if (insertError) {
      console.error('[measurements] Error saving measurements:', insertError);
      return { success: false, message: 'Error al registrar las medidas. Por favor intenta nuevamente.' };
    }

    revalidatePath('/para-ti');
    return { success: true, message: '¡Medidas registradas con éxito!' };
  } catch (err: any) {
    console.error('[measurements] Exception in recordMeasurementAction:', err);
    return { success: false, message: 'Ocurrió un error inesperado al guardar.' };
  }
}

/** Marca un aviso como leído sin aceptar un perfil o dueña desde el cliente. */
export async function markNotificationReadAction(notificationId: string): Promise<NotificationResult> {
  if (!UUID_PATTERN.test(notificationId)) {
    return { success: false, message: 'No se reconoció el aviso.' };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Sesión no válida o expirada.' };

    const { profile } = await getStudentProfileByUserId(supabase, user.id);
    if (!profile || profile.role !== 'STUDENT') {
      return { success: false, message: 'Tu cuenta no tiene acceso a estos avisos.' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('profile_id', profile.id);

    if (error) return { success: false, message: 'No fue posible actualizar el aviso.' };

    revalidatePath('/para-ti');
    return { success: true, message: 'Aviso marcado como leído.' };
  } catch (error) {
    console.error('[notifications] Unable to mark notification as read:', error);
    return { success: false, message: 'Ocurrió un error al actualizar el aviso.' };
  }
}
