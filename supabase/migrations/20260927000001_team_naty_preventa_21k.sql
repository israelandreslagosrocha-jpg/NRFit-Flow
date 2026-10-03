-- Oferta comercial de lanzamiento: 2 sesiones Zoom semanales y biblioteca
-- asíncrona de libre disposición por $21.000 CLP/mes.
-- Debe aplicarse junto con la configuración equivalente del plan en Flow.

UPDATE public.plans
SET
  name = 'Membresía Mensual Team Naty (Preventa Lanzamiento)',
  price = 21000,
  max_weekly_reservations = 5
WHERE id = 'b0000000-0000-0000-0000-000000000001'
  AND program_id = 'a0000000-0000-0000-0000-000000000001';
