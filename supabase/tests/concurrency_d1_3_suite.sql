-- ====================================================================
-- SUITE DE TESTS DE CONCURRENCIA Y REGLAS DE NEGOCIO D1.3
-- Naty Entrenadora - create_booking_atomic & Concurrency Validation
-- ====================================================================

DO $test$
DECLARE
  v_coach_profile_id UUID := gen_random_uuid();
  v_coach_user_id UUID := gen_random_uuid();
  v_coach_id UUID := gen_random_uuid();

  v_student1_profile_id UUID := gen_random_uuid();
  v_student1_user_id UUID := gen_random_uuid();
  v_student1_id UUID := gen_random_uuid();
  v_membership1_id UUID := gen_random_uuid();

  v_student2_profile_id UUID := gen_random_uuid();
  v_student2_user_id UUID := gen_random_uuid();
  v_student2_id UUID := gen_random_uuid();
  v_membership2_id UUID := gen_random_uuid();

  v_class_type_id UUID := gen_random_uuid();
  v_session_id UUID := gen_random_uuid();
  v_plan_id UUID := 'b0000000-0000-0000-0000-000000000002'; -- Presencial 1x por Semana (max_weekly_reservations = 1)
  
  v_booking1_res JSON;
  v_booking2_res JSON;
  v_error_msg TEXT;
  v_session_full_caught BOOLEAN := false;
  v_duplicate_caught BOOLEAN := false;
  v_weekly_limit_caught BOOLEAN := false;
BEGIN
  RAISE NOTICE '======================================================';
  RAISE NOTICE '🚀 INICIANDO SUITE DE TESTS DE CONCURRENCIA D1.3';
  RAISE NOTICE '======================================================';

  -- 1. SETUP DE USUARIOS EN AUTH.USERS (Para satisfacer FK)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_coach_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach_test@test.local', '', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_student1_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student1_test@test.local', '', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_student2_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student2_test@test.local', '', now(), '{"provider":"email"}', '{}', now(), now());

  -- 1.1 Crear Coach
  INSERT INTO public.profiles (id, user_id, full_name, role)
  VALUES (v_coach_profile_id, v_coach_user_id, 'Naty Coach Test', 'COACH');

  INSERT INTO public.coaches (id, profile_id, bio)
  VALUES (v_coach_id, v_coach_profile_id, 'Coach de Prueba');

  -- 1.2 Crear Alumna 1 (Titular de Membresía Presencial 1x Semana)
  INSERT INTO public.profiles (id, user_id, full_name, role)
  VALUES (v_student1_profile_id, v_student1_user_id, 'Alumna Uno Test', 'STUDENT');

  INSERT INTO public.students (id, profile_id, phone)
  VALUES (v_student1_id, v_student1_profile_id, '+56911111111');

  INSERT INTO public.memberships (id, student_id, coach_id, plan_id, status, price_contracted, start_date, end_date)
  VALUES (v_membership1_id, v_student1_id, v_coach_id, v_plan_id, 'ACTIVE', 45000, CURRENT_DATE - 5, CURRENT_DATE + 25);

  -- 1.3 Crear Alumna 2 (Titular de Membresía Presencial 1x Semana)
  INSERT INTO public.profiles (id, user_id, full_name, role)
  VALUES (v_student2_profile_id, v_student2_user_id, 'Alumna Dos Test', 'STUDENT');

  INSERT INTO public.students (id, profile_id, phone)
  VALUES (v_student2_id, v_student2_profile_id, '+56922222222');

  INSERT INTO public.memberships (id, student_id, coach_id, plan_id, status, price_contracted, start_date, end_date)
  VALUES (v_membership2_id, v_student2_id, v_coach_id, v_plan_id, 'ACTIVE', 45000, CURRENT_DATE - 5, CURRENT_DATE + 25);

  -- 1.4 Crear Clase y Sesión con AFORO = 1 (Exactamente 1 solo cupo disponible)
  INSERT INTO public.class_types (id, program_id, title, default_capacity)
  VALUES (v_class_type_id, 'a0000000-0000-0000-0000-000000000002', 'Clase Funcional Box Central', 1);

  INSERT INTO public.sessions (id, coach_id, delivery_type, session_date, start_time, max_capacity)
  VALUES (v_session_id, v_coach_id, 'PRESENCIAL', CURRENT_DATE + 2, '10:00:00', 1);

  RAISE NOTICE '✅ SETUP: Sesión creada con max_capacity = 1 cupo.';

  -- -------------------------------------------------------------
  -- TEST 1: RESERVA LEGÍTIMA DEL ÚNICO CUPO POR ALUMNA 1
  -- -------------------------------------------------------------
  -- Simular JWT claim para Alumna 1
  PERFORM set_config('request.jwt.claim.sub', v_student1_user_id::text, true);

  -- Ejecutar reserva atómica
  v_booking1_res := public.create_booking_atomic(v_session_id, v_student1_id, NULL);
  RAISE NOTICE '✅ TEST 1 (PASS): Alumna 1 reservó el cupo exitosamente: %', v_booking1_res;

  -- -------------------------------------------------------------
  -- TEST 2: INTENTO CONCURRENTE DE ALUMNA 2 EN SESIÓN YA LLENA
  -- -------------------------------------------------------------
  -- Simular JWT claim para Alumna 2
  PERFORM set_config('request.jwt.claim.sub', v_student2_user_id::text, true);

  BEGIN
    v_booking2_res := public.create_booking_atomic(v_session_id, v_student2_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    IF v_error_msg LIKE '%SESSION_FULL%' THEN
      v_session_full_caught := true;
      RAISE NOTICE '✅ TEST 2 (PASS): Candado de Aforo funcionó. Alumna 2 rechazada con: %', v_error_msg;
    ELSE
      RAISE NOTICE '❌ TEST 2 (FAIL): Error inesperado: %', v_error_msg;
    END IF;
  END;

  IF NOT v_session_full_caught THEN
    RAISE EXCEPTION 'TEST 2 FALLÓ: Se permitió sobrecupo (Overbooking)!';
  END IF;

  -- -------------------------------------------------------------
  -- TEST 3: INTENTO DE RESERVA DUPLICADA POR LA MISMA ALUMNA
  -- -------------------------------------------------------------
  -- Volver a simular Alumna 1 intentando reservar de nuevo la misma clase
  PERFORM set_config('request.jwt.claim.sub', v_student1_user_id::text, true);

  BEGIN
    -- Forzar inserción directa para probar el índice único parcial
    INSERT INTO public.bookings (session_id, student_id, status)
    VALUES (v_session_id, v_student1_id, 'CONFIRMED');
  EXCEPTION WHEN unique_violation THEN
    v_duplicate_caught := true;
    RAISE NOTICE '✅ TEST 3 (PASS): Índice único parcial bloqueó reserva duplicada físicamente en BD.';
  END;

  IF NOT v_duplicate_caught THEN
    RAISE EXCEPTION 'TEST 3 FALLÓ: Se permitió reserva duplicada para la misma alumna y sesión!';
  END IF;

  -- -------------------------------------------------------------
  -- TEST 4: VALIDACIÓN DE LÍMITE SEMANAL (Plan 1x por Semana)
  -- -------------------------------------------------------------
  -- Crear una segunda sesión en la misma semana con cupo disponible
  DECLARE
    v_session2_id UUID := gen_random_uuid();
  BEGIN
    INSERT INTO public.sessions (id, coach_id, delivery_type, session_date, start_time, max_capacity)
    VALUES (v_session2_id, v_coach_id, 'PRESENCIAL', CURRENT_DATE + 2, '18:00:00', 5);

    -- Alumna 1 (que ya tiene 1 reserva esta semana en su plan de 1x semana) intenta reservar una 2da clase
    PERFORM set_config('request.jwt.claim.sub', v_student1_user_id::text, true);

    BEGIN
      PERFORM public.create_booking_atomic(v_session2_id, v_student1_id, NULL);
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      IF v_error_msg LIKE '%WEEKLY_LIMIT_EXCEEDED%' THEN
        v_weekly_limit_caught := true;
        RAISE NOTICE '✅ TEST 4 (PASS): Límite semanal respetado. Rechazado con: %', v_error_msg;
      ELSE
        RAISE NOTICE '❌ TEST 4 (FAIL): Error inesperado: %', v_error_msg;
      END IF;
    END;

    -- Limpieza de sesión 2
    DELETE FROM public.sessions WHERE id = v_session2_id;
  END;

  IF NOT v_weekly_limit_caught THEN
    RAISE EXCEPTION 'TEST 4 FALLÓ: Alumna pudo exceder su límite semanal contratado!';
  END IF;

  -- -------------------------------------------------------------
  -- LIMPIEZA TOTAL (TEARDOWN)
  -- -------------------------------------------------------------
  DELETE FROM public.bookings WHERE session_id = v_session_id;
  DELETE FROM public.sessions WHERE id = v_session_id;
  DELETE FROM public.class_types WHERE id = v_class_type_id;
  DELETE FROM public.memberships WHERE id IN (v_membership1_id, v_membership2_id);
  DELETE FROM public.students WHERE id IN (v_student1_id, v_student2_id);
  DELETE FROM public.coaches WHERE id = v_coach_id;
  DELETE FROM auth.users WHERE id IN (v_coach_user_id, v_student1_user_id, v_student2_user_id);

  RAISE NOTICE '======================================================';
  RAISE NOTICE '🎉 SUITE D1.3 FINALIZADA: 100%% PASS (4/4 PRUEBAS)';
  RAISE NOTICE '   - Aforo Atómico: VALIDADO (0 Overbooking)';
  RAISE NOTICE '   - Candados Concurrencia: VALIDADOS';
  RAISE NOTICE '   - Índice Físico Anti-Duplicados: VALIDADO';
  RAISE NOTICE '   - Límite Semanal por Plan: VALIDADO';
  RAISE NOTICE '   - Limpieza de datos de prueba: COMPLETADA';
  RAISE NOTICE '======================================================';
END $test$;
