# Seguimiento personal desde «Detalle»

Activado el 12 de octubre de 2026: SQL ejecutado en staging y producción, y commit funcional `9df9496` publicado en `main` y `migration/nextjs-15`.

## Verificación de la activación

- Ambos proyectos Supabase (PostgreSQL 17.6) confirmaron ejecución correcta de la migración.
- En ambos se comprobó: RLS activado, sin lectura anónima, sin inserción directa de alumnas y sin ejecución de cambios de precio desde `authenticated`. La función de precio está habilitada únicamente para el servidor.
- Vercel confirmó Preview y Production en estado **Ready** para `9df9496`. Despliegue de producción: `https://vercel.com/lagosrocha/nr-fit-flow-obv5/DVJ14Evznykab12XVRi9L3pgk1b5`.
- En `https://natyentrenadora.com/admin`, sesión administrativa real: **Alumnas → alumnademo2 → Detalle** carga medidas y reproducciones sin errores, y el formulario de acompañamiento está disponible.
- Se guardó un mensaje técnico compartido exclusivamente con `alumnademo2`, visible en el historial. No se modificaron pagos ni membresías reales.
- La demo no tenía medidas ni reproducciones registradas. No se generaron valores ficticios. Falta el recorrido con sesión de alumna para verificar reproducción real, registro de medidas y recepción del mensaje en su propio portal; el seguimiento previo se probó en navegador aislado y PostgreSQL temporal.
- Pruebas: 29 contratos/unitarias, 36 comprobaciones SQL aisladas y compilación de producción correctas.

## Qué incluye

- En **Admin → Alumnas → Detalle**: reproducciones vistas/parciales, última posición, historial de peso/cintura/cadera y notas de la alumna.
- **Acompañamiento**: comentario exclusivo para una alumna y enlace HTTPS opcional. «Enviar a la alumna» lo publica en **Mi progreso** y crea un aviso sólo para su perfil. «Nota interna» permanece sólo en administración. No envía correo.
- **Membresía**: elección de $21.000 o $25.000 para próximos pagos, con confirmación explícita, aviso y auditoría. No crea un cobro, no modifica transacciones anteriores ni cambia fechas de acceso.
- En el portal: historial de medidas con fecha, orientación mensual, mensajes personales, progreso de videos y continuación desde la última posición guardada.

## Límite de cambios de precio en Flow

Los planes de $21.000 y $25.000 ya existen: no se crea otro plan ni se añade una variable de entorno.

El cambio de precio **se bloquea** si existe `gateway_subscription_id`, un pago `PENDING_PAYMENT` o una cortesía. No basta con cambiar Supabase cuando una suscripción ya existe en Flow. Su API `subscription/changePlan` contempla ajustes proporcionales; falta implementar y probar la sincronización para que afecte exclusivamente próximas mensualidades, sin ajustes al ciclo actual. No debe presentarse este caso como terminado.

Para cuentas sin un pago/suscripción en curso, el acuerdo se guarda en `price_contracted`, usado por el checkout para seleccionar el plan existente. El checkout comprueba que el precio no haya cambiado desde su lectura antes de bloquear la fila y preparar Flow. Los pagos externos y controles anteriores se mantienen.

## Activación segura

1. Ejecutar **todo** `supabase/migrations/20261012000000_student_personal_follow_up.sql` en el SQL Editor del proyecto **staging**. Es adicional; no reemplaza SQL anteriores.
2. Publicar un Preview de esta versión conectado a staging. Usar únicamente la alumna demo.
3. Comprobar: medidas aparecen en su detalle; mensaje compartido llega sólo a ella; nota interna no aparece en su portal; reproducción parcial se guarda; adelantar al final no marca visto; valor 21/25 se guarda sin cobro; cuenta con Flow en curso rechaza cambio de precio.
4. Ejecutar el mismo SQL en **producción** y publicar esta versión en Vercel Production.
5. Repetir el recorrido con una cuenta demo de producción, sin crear cobros ni cambiar membresías reales durante la prueba.

Sin el SQL, el portal conserva clases y medidas y muestra acompañamiento no disponible; no simula datos ni afirma que se hayan guardado mensajes.

## Privacidad y significado de las métricas

Sólo el staff autorizado consulta fichas ajenas. Las alumnas leen sus propios datos; RLS impide leer otras cuentas y notas internas. Las escrituras pasan por acciones autenticadas y funciones habilitadas exclusivamente para `service_role`.

El progreso refleja **reproducción reportada por el reproductor**, no ejercicio ni asistencia real. Visto = al menos 90% del video. Los intervalos vistos se unen para no contar dos veces una repetición; saltar el cabezal no suma el tramo saltado. Cambiar la URL reinicia el progreso de esa versión. Se guarda aproximadamente cada 15 segundos, al pausar y al cerrar el reproductor; un cierre abrupto de navegador o una caída de conexión puede perder el último tramo.

YouTube usa su IFrame API; videos directos compatibles usan el reproductor nativo. Si la API falla, se conserva el embed sin seguimiento y se informa. No se inventa el historial previo. Se muestran hasta 100 videos y 120 registros de medidas recientes. Los datos personales no se envían a Analytics ni publicidad. Se actualizó la descripción técnica de la política de privacidad; su revisión legal profesional sigue pendiente como ya indica el documento.

## Verificación local

```sh
node --test src/tests/student-follow-up.test.ts src/tests/dashboard-portal.test.ts src/tests/admin-membership-controls.test.ts src/tests/analytics-privacy.test.ts
npm run build
npm run lint
```

La prueba SQL aislada requiere `@electric-sql/pglite` instalado en una carpeta temporal, no en producción:

```sh
PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-student-follow-up.mjs
```

El script crea su propio PostgreSQL en memoria, un esquema mínimo y registros ficticios; comprueba RLS, permisos, intervalos, auditoría, aislamiento de mensajes y conservación de pagos. No acepta ni usa conexiones a Supabase.
