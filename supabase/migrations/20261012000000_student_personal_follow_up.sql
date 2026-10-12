-- Acompañamiento personal: no modifica pagos anteriores ni datos existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.student_video_progress (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  watched_ranges int8multirange NOT NULL DEFAULT '{}'::int8multirange,
  watched_seconds bigint NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  last_position_seconds integer NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 21600),
  completed_at timestamptz,
  first_watched_at timestamptz NOT NULL DEFAULT now(),
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, content_item_id)
);
CREATE TABLE IF NOT EXISTS public.student_coach_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000),
  resource_url text CHECK (resource_url IS NULL OR (resource_url LIKE 'https://%' AND char_length(resource_url) <= 2048)),
  visible_to_student boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_coach_notes_student_date ON public.student_coach_notes(student_id, created_at DESC);
ALTER TABLE public.student_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_coach_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own playback progress" ON public.student_video_progress;
CREATE POLICY "Own playback progress" ON public.student_video_progress FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.students s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = student_id AND p.user_id = auth.uid() AND p.role = 'STUDENT')
);
DROP POLICY IF EXISTS "Own shared coach notes" ON public.student_coach_notes;
CREATE POLICY "Own shared coach notes" ON public.student_coach_notes FOR SELECT TO authenticated USING (
  visible_to_student AND EXISTS (SELECT 1 FROM public.students s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = student_id AND p.user_id = auth.uid() AND p.role = 'STUDENT')
);
REVOKE ALL ON public.student_video_progress, public.student_coach_notes FROM anon, authenticated;
GRANT SELECT ON public.student_video_progress, public.student_coach_notes TO authenticated;
GRANT ALL ON public.student_video_progress, public.student_coach_notes TO service_role;

-- Sólo el servidor llama estas funciones tras comprobar identidad y permisos.
CREATE OR REPLACE FUNCTION public.record_student_playback(
  p_student uuid, p_content uuid, p_media text, p_duration integer, p_position integer, p_segments jsonb
) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_progress public.student_video_progress%ROWTYPE;
  v_ranges int8multirange; v_seconds bigint; v_segment jsonb;
  v_start bigint; v_end bigint; v_total bigint := 0;
BEGIN
  IF p_duration IS NULL OR p_duration NOT BETWEEN 1 AND 21600 OR p_position IS NULL OR p_position NOT BETWEEN 0 AND p_duration
     OR jsonb_typeof(p_segments) IS DISTINCT FROM 'array' OR jsonb_array_length(p_segments) > 60 THEN
    RAISE EXCEPTION 'INVALID_PLAYBACK';
  END IF;
  -- La URL tiene que coincidir con el contenido publicado; una edición no hereda el progreso anterior.
  PERFORM 1 FROM public.content_items WHERE id = p_content AND type = 'VIDEO' AND is_active
    AND media_url = p_media AND (publish_date IS NULL OR publish_date <= (now() AT TIME ZONE 'America/Santiago')::date) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTENT_UNAVAILABLE'; END IF;
  INSERT INTO public.student_video_progress(student_id, content_item_id, media_url, duration_seconds)
    VALUES (p_student, p_content, p_media, p_duration) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_progress FROM public.student_video_progress WHERE student_id = p_student AND content_item_id = p_content FOR UPDATE;
  v_ranges := CASE WHEN v_progress.media_url = p_media AND v_progress.duration_seconds = p_duration THEN v_progress.watched_ranges ELSE '{}'::int8multirange END;
  FOR v_segment IN SELECT value FROM jsonb_array_elements(p_segments) LOOP
    IF jsonb_typeof(v_segment) IS DISTINCT FROM 'array' OR jsonb_array_length(v_segment) <> 2 THEN RAISE EXCEPTION 'INVALID_SEGMENT'; END IF;
    v_start := (v_segment->>0)::bigint; v_end := (v_segment->>1)::bigint;
    IF v_start IS NULL OR v_end IS NULL OR v_start < 0 OR v_end <= v_start OR v_end > p_duration THEN RAISE EXCEPTION 'INVALID_SEGMENT'; END IF;
    v_total := v_total + v_end - v_start;
    v_ranges := v_ranges + int8multirange(int8range(v_start, v_end, '[)'));
  END LOOP;
  IF v_total > 60 THEN RAISE EXCEPTION 'PLAYBACK_BATCH_TOO_LARGE'; END IF;
  SELECT coalesce(sum(upper(r) - lower(r)), 0) INTO v_seconds FROM unnest(v_ranges) AS r;
  UPDATE public.student_video_progress SET media_url = p_media, watched_ranges = v_ranges, watched_seconds = v_seconds,
    duration_seconds = p_duration, last_position_seconds = p_position, last_watched_at = now(),
    first_watched_at = CASE WHEN v_progress.media_url = p_media THEN v_progress.first_watched_at ELSE now() END,
    completed_at = CASE WHEN v_seconds >= ceil(p_duration * 0.9) THEN CASE WHEN v_progress.media_url = p_media AND v_progress.duration_seconds = p_duration THEN coalesce(v_progress.completed_at, now()) ELSE now() END ELSE NULL END
    WHERE student_id = p_student AND content_item_id = p_content;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_student_coach_note(
  p_actor uuid, p_student uuid, p_title text, p_message text, p_resource text, p_shared boolean
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_profile uuid; v_note uuid;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_actor AND role IN ('ADMIN', 'OWNER');
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
  SELECT s.profile_id INTO v_profile FROM public.students s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = p_student AND p.role = 'STUDENT';
  IF v_profile IS NULL THEN RAISE EXCEPTION 'STUDENT_REQUIRED'; END IF;
  -- Evita duplicados accidentales y abuso del botón en un mismo perfil.
  PERFORM 1 FROM public.students WHERE id = p_student FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.student_coach_notes WHERE author_profile_id = p_actor AND student_id = p_student AND created_at > now() - interval '10 seconds') THEN RAISE EXCEPTION 'NOTE_RATE_LIMIT'; END IF;
  INSERT INTO public.student_coach_notes(student_id, author_profile_id, title, message, resource_url, visible_to_student)
    VALUES (p_student, p_actor, p_title, p_message, p_resource, p_shared) RETURNING id INTO v_note;
  IF p_shared THEN
    INSERT INTO public.notifications(profile_id, title, message, type)
      VALUES (v_profile, 'Natalia te envió un mensaje personal', 'Revisa Mi progreso para leer: ' || p_title, 'NEW_CONTENT');
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
    VALUES (p_actor, 'COACH_NOTE_CREATED', 'student_coach_notes', v_note, jsonb_build_object('student_id', p_student, 'shared', p_shared));
  RETURN v_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_monthly_price(p_actor uuid, p_student uuid, p_membership uuid, p_expected_price numeric, p_price integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_membership public.memberships%ROWTYPE; v_profile uuid;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_actor AND role IN ('ADMIN', 'OWNER');
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_REQUIRED'; END IF;
  IF p_price IS NULL OR p_price NOT IN (21000, 25000) THEN RAISE EXCEPTION 'INVALID_PRICE'; END IF;
  SELECT s.profile_id INTO v_profile FROM public.students s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = p_student AND p.role = 'STUDENT';
  IF v_profile IS NULL THEN RAISE EXCEPTION 'STUDENT_REQUIRED'; END IF;
  SELECT * INTO v_membership FROM public.memberships WHERE student_id = p_student ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF v_membership.id IS NULL OR v_membership.id <> p_membership OR v_membership.price_contracted IS DISTINCT FROM p_expected_price THEN RAISE EXCEPTION 'STALE_MEMBERSHIP'; END IF;
  -- Bloqueo bajo la misma fila que bloquea el checkout. No desincronizar una factura o suscripción Flow.
  IF v_membership.status = 'PENDING_PAYMENT' OR v_membership.gateway_subscription_id IS NOT NULL THEN RAISE EXCEPTION 'FLOW_PRICE_SYNC_REQUIRED'; END IF;
  IF v_membership.is_complimentary THEN RAISE EXCEPTION 'COMPLIMENTARY_PRICE_BLOCKED'; END IF;
  IF v_membership.price_contracted = p_price THEN RETURN; END IF;
  UPDATE public.memberships SET price_contracted = p_price WHERE id = v_membership.id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (p_actor, 'MONTHLY_PRICE_AGREED', 'memberships', v_membership.id,
      jsonb_build_object('price_contracted', v_membership.price_contracted), jsonb_build_object('price_contracted', p_price, 'student_id', p_student));
  INSERT INTO public.notifications(profile_id, title, message, type)
    VALUES (v_profile, 'Tu valor mensual fue acordado con Natalia', 'Tu valor para las próximas mensualidades es $' || p_price || ' CLP. Guardar este acuerdo no realiza un cobro ni modifica pagos anteriores.', 'PAYMENT_DUE');
END;
$$;
REVOKE ALL ON FUNCTION public.record_student_playback(uuid, uuid, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_student_coach_note(uuid, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_student_monthly_price(uuid, uuid, uuid, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_playback(uuid, uuid, text, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_student_coach_note(uuid, uuid, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_student_monthly_price(uuid, uuid, uuid, numeric, integer) TO service_role;
COMMIT;
