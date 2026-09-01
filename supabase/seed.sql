-- ====================================================================
-- NATY ENTRENADORA - SEED DATA INICIAL PARA SEEDING & TESTING (FASE D1)
-- Versión: seed.sql
-- ====================================================================

-- 1. PROGRAMAS DE ENTRENAMIENTO REALES
INSERT INTO public.programs (id, name, slug, mode, requires_capacity) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Método 40/3', 'metodo-40-3', 'ONLINE', false),
  ('a0000000-0000-0000-0000-000000000002', 'Entrenamiento Presencial Grupal', 'presencial', 'PRESENCIAL', true),
  ('a0000000-0000-0000-0000-000000000003', 'Entrenamiento Personalizado 1-a-1', 'personalizado', 'HYBRID', true),
  ('a0000000-0000-0000-0000-000000000004', 'Post Parto Seguro', 'post-parto', 'ONLINE', false),
  ('a0000000-0000-0000-0000-000000000005', 'Pilates Mat & Movilidad', 'pilates', 'HYBRID', false),
  ('a0000000-0000-0000-0000-000000000006', 'Pilates Kids Teodoro Schmidt', 'pilates-kids', 'PRESENCIAL', true)
ON CONFLICT (slug) DO NOTHING;

-- 2. PLANES COMERCIALES ASOCIADOS
INSERT INTO public.plans (id, program_id, name, billing_type, price, currency, duration_days, max_weekly_reservations, session_count) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Plan Mensual Método 40/3', 'RECURRING', 22000, 'CLP', 30, 3, NULL),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Presencial 1x por Semana', 'FIXED_TERM', 45000, 'CLP', 30, 1, NULL),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Presencial 2x por Semana (Trimestral)', 'FIXED_TERM', 120000, 'CLP', 90, 2, NULL),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Presencial 3x por Semana (Trimestral)', 'FIXED_TERM', 150000, 'CLP', 90, 3, NULL),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Pase Libre Presencial Box Central', 'FIXED_TERM', 180000, 'CLP', 90, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Paquete Personalizado 6 Sesiones', 'SESSION_PACKAGE', 120000, 'CLP', 60, NULL, 6),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'Paquete Personalizado 8 Sesiones', 'SESSION_PACKAGE', 150000, 'CLP', 60, NULL, 8),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Paquete Personalizado 12 Sesiones', 'SESSION_PACKAGE', 200000, 'CLP', 90, NULL, 12),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000006', 'Plan Mensual Pilates Kids', 'FIXED_TERM', 35000, 'CLP', 30, 2, NULL),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000004', 'Programa Trimestral Post Parto Seguro', 'FIXED_TERM', 60000, 'CLP', 90, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
