# Configuración de membresías administradas

Este módulo debe desplegarse junto con la migración
`20261003000000_admin_membership_controls.sql`. Hasta que Supabase aplique esa
migración, no se debe publicar el código que consulta `membership_discounts`.

## Flujo operativo de Natalia

- **Pago externo:** se registra fecha, monto, medio y referencia. El portal da
  acceso hasta la próxima fecha mensual calculada por calendario. No se crea ni
  cobra una suscripción Flow.
- **Cortesía:** puede tener fecha de término o mantenerse vigente hasta que
  Natalia la revoque. Tampoco usa Flow ni genera recordatorio de cobro.
- **Descuento personal:** se reserva para el primer ciclo pagado de esa alumna.
- **Invitación:** crea un código de uso único, visible en el portal de la
  alumna que invita. La invitada lo ingresa al activar sus siete días gratis.

## Planes de Flow para descuentos de primer ciclo

Los descuentos nunca deben reutilizar el plan mensual normal: eso podría
transformarlos en una rebaja permanente. En Flow se requieren planes con el
importe exacto y el backend crea la suscripción con `periods_number=1`.

Configura sólo las variables correspondientes a campañas vigentes:

| Oferta | 10% | 15% | 20% |
| --- | --- | --- | --- |
| Preventa $21.000 | `FLOW_PRESALE_10_FIRST_CYCLE_PLAN_ID` ($18.900) | `FLOW_PRESALE_15_FIRST_CYCLE_PLAN_ID` ($17.850) | `FLOW_PRESALE_20_FIRST_CYCLE_PLAN_ID` ($16.800) |
| Regular $25.000 | `FLOW_REGULAR_10_FIRST_CYCLE_PLAN_ID` ($22.500) | `FLOW_REGULAR_15_FIRST_CYCLE_PLAN_ID` ($21.250) | `FLOW_REGULAR_20_FIRST_CYCLE_PLAN_ID` ($20.000) |

Cada valor en Vercel debe ser el `planId` real creado en la cuenta Flow de
producción. Si falta una variable, el servidor falla cerrado y no crea un cobro
con valor incorrecto. Tras ese único ciclo, la alumna vuelve a elegir el método
normal de pago al valor contratado.
