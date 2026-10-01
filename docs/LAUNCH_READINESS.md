# Puesta en marcha de Naty Entrenadora

## Estado registrado — 30 de septiembre de 2026

- La rama de lanzamiento está en `migration/nextjs-15` (commit `29dbad7`); se promoverá a `main` tras esta certificación local.
- Vercel ya desplegó Producción desde `main`: la portada responde correctamente y `GET /api/callbacks/flow` confirma `FLOW_CALLBACK_ENDPOINT_READY`.
- En Flow ya existen y están activos dos planes mensuales, ambos con duración indefinida:
  - `NATY_PREVENTA_21K` — Team Naty · Preventa — $21.000 CLP/mes.
  - `NATY_REGULAR_25K` — Team Naty · Membresía mensual — $25.000 CLP/mes.
- Ambos planes notifican a `https://natyentrenadora.com/api/callbacks/flow`.
- Vercel ya tiene asociados `natyentrenadora.com` para Production y `www.natyentrenadora.com` con redirección permanente (308) al dominio raíz.
- Aún no se ha movido el DNS en Hostinger. Esto es intencional: las claves de producción de Flow ya están en Vercel, pero falta verificar el checkout controlado y aprobar el corte final.

El repositorio ya incluye alta de cuenta, checkout Flow en sandbox, portal de alumna, panel de administración, publicaciones por enlace HTTPS, sesiones Zoom y avisos dentro de la plataforma. No se debe habilitar el lanzamiento público hasta completar esta lista fuera del repositorio.

## 1. Base de datos y roles

1. Aplicar todas las migraciones en el proyecto Supabase de **staging** y verificar que la última sea `20260927000000_admin_content_portal.sql`.
2. Configurar `SUPABASE_SERVICE_ROLE_KEY` únicamente como secreto de servidor en el hosting. Nunca usarla con `NEXT_PUBLIC_` ni exponerla en el navegador.
3. Crear o identificar la cuenta Supabase Auth de Natalia y asignar a su fila de `profiles` el rol `OWNER` o `ADMIN`. El panel quedará disponible en `/admin`.
4. Probar con una cuenta de alumna: crear cuenta, iniciar checkout sandbox, confirmar trial y verificar que solo ella pueda ver su contenido, Zoom y avisos.

## 2. Variables de entorno del hosting

Configurar, sin copiar valores en el código ni en conversaciones:

- `NEXT_PUBLIC_APP_URL=https://natyentrenadora.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o la clave anónima heredada mientras aplique)
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_BASE_URL`, `FLOW_ENV`
- `FLOW_PRESALE_PLAN_ID=NATY_PREVENTA_21K`
- `FLOW_REGULAR_PLAN_ID=NATY_REGULAR_25K`
- `FLOW_PRODUCTION_ENABLED` debe seguir ausente o ser `false` hasta completar la prueba de cobro controlada.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `EMAIL_FROM=team@natyentrenadora.com` una vez que esa casilla esté creada y autorizada en Hostinger.

Si se usa un limitador distribuido o el worker cron externo, añadir también sus credenciales de producción en el hosting; no basta con valores locales.

## 3. Dominio y correo

1. En Hostinger, reemplazar los registros web cuando se apruebe el corte final: `A @ → 216.150.1.1` y `CNAME www → 79e9b88e7e1ec2b1.vercel-dns-017.com`. Vercel redirige `www` permanentemente al dominio raíz.
2. En Supabase Auth, fijar Site URL en `https://natyentrenadora.com` y autorizar al menos `https://natyentrenadora.com/auth/callback` y `https://natyentrenadora.com/auth/reset-password` como Redirect URLs.
3. En Hostinger, validar SPF, DKIM y DMARC para `natyentrenadora.com`, y enviar un correo de prueba a una casilla controlada antes de activar los avisos.

## 4. Pagos

La primera inscripción sólo crea una prueba gratuita de siete días: no registra tarjeta ni crea una suscripción en Flow. Al terminarla, la alumna ve dos opciones en su panel:

- **Recordatorio y enlace mensual:** se crea la suscripción sin segundo trial y Flow entrega su enlace de pago; el enlace se consulta bajo sesión y no se guarda como token en la base de datos.
- **Pago automático mensual:** Flow registra la tarjeta directamente y solicita la autorización explícita de la alumna; la suscripción se crea sin segundo trial. El callback S2S sigue siendo la única autoridad que concede acceso de pago.

La guardia de producción evita cobros reales accidentales. Para habilitar el primer cobro real hace falta una revisión controlada con:

- contrato/cuenta Flow de producción y un plan real de preventa de $21.000 CLP;
- endpoints de callback y retorno bajo `https://natyentrenadora.com`;
- una prueba de pago, rechazo, reintento, cancelación y conciliación en staging;
- confirmación comercial y legal de los términos, la política de cancelación y el cobro automático.

No activar `FLOW_PRODUCTION_ENABLED=true` ni iniciar una suscripción real sin esas validaciones y una confirmación explícita justo antes de la prueba.

## 5. Operación de contenidos

- Natalia publica desde `/admin` un video, guía o artículo mediante una URL `https://` (por ejemplo Cloudinary, Vimeo o YouTube) y las alumnas activas reciben una notificación dentro de `/para-ti`.
- Las clases en vivo se publican desde el mismo panel con un enlace `https://*.zoom.us`.
- Los avisos financieros de Flow se envían al correo guardado al iniciar checkout; registros históricos sin correo de facturación no recibirán un aviso automático hasta que sean completados de forma segura.
- La carga directa de archivos de video grandes requiere definir y configurar un proveedor de streaming/almacenamiento con subida reanudable. No se habilitó un formulario que pudiera fallar con archivos grandes o exponer credenciales de proveedor.

## 6. Validación antes de publicar

Ejecutar en staging:

```bash
npm run build
npm test
npm run test:flow
npm run test:outbox
npm run test:security
npm run test:security:hardening
npm run test:trace
npm run test:reconciler
npm run test:ratelimit
npm run test:infra
```

Después, hacer una prueba manual completa con una cuenta de prueba y registrar el resultado: registro, confirmación de correo, checkout, trial, portal de alumna, publicación por Natalia, aviso, Zoom, cancelación y procesamiento de correo.
