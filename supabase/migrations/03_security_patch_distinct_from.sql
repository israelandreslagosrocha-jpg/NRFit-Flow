-- ====================================================================
-- PARCHE CRÍTICO DE SEGURIDAD D1.2: BLINDAJE THREE-VALUED LOGIC (NULL)
-- ====================================================================
-- Problema detectado por la suite de tests automatizados:
-- En SQL, NULL != 'OWNER' retorna UNKNOWN (NULL), no TRUE.
-- Por tanto, se reemplaza por 'IS DISTINCT FROM' para garantizar
-- que cualquier rol NULL, anónimo, o diferente a 'OWNER' sea rechazado.

-- 1. Actualizar Trigger de Integridad de Rol
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS TRIGGER AS $func$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    IF (current_setting('role', true) != 'service_role' AND public.get_auth_role() IS DISTINCT FROM 'OWNER') THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROLE_MUTATION: El rol o identidades solo pueden ser alteradas por un OWNER.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Actualizar RPC Administrativa de Cambio de Rol
CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_target_profile_id UUID, p_new_role public.enum_user_role)
RETURNS VOID AS $func$
BEGIN
  IF public.get_auth_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'FORBIDDEN: Se requieren privilegios de OWNER' USING ERRCODE = '42501';
  END IF;
  
  UPDATE public.profiles SET role = p_new_role WHERE id = p_target_profile_id;
  
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (public.get_auth_profile_id(), 'ROLE_CHANGE', 'profiles', p_target_profile_id, jsonb_build_object('role', p_new_role));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
