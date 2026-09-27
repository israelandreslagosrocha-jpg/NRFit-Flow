# Accesos de Natalia y cuentas de demostración

## Acceso de Natalia

Natalia entra en [http://localhost:3000/auth/login](http://localhost:3000/auth/login) con un correo y una contraseña creados en Supabase Auth. Su perfil de aplicación debe tener el rol `OWNER` (recomendado para la dueña de la plataforma) o `ADMIN`.

Con esos roles, el inicio de sesión la envía automáticamente a `/admin`. Desde allí puede publicar contenido, programar una sesión Zoom, notificar a las alumnas activas y ver el estado de sus membresías. Las operaciones privilegiadas se ejecutan solo en el servidor.

## Antes de crear datos demo

Usa un proyecto Supabase de pruebas o staging, no producción. En `.env.local`, sin compartir estas claves ni subirlas a Git, agrega:

```bash
SUPABASE_SERVICE_ROLE_KEY=clave_solo_servidor_de_supabase
DEMO_NATALIA_EMAIL=natalia.demo@ejemplo.com
DEMO_NATALIA_PASSWORD=una-clave-larga-y-unica
DEMO_ALUMNA_EMAIL=alumna.demo@ejemplo.com
DEMO_ALUMNA_PASSWORD=otra-clave-larga-y-unica
DEMO_PROVISIONING_CONFIRMED=CREATE_DEMO_ACCOUNTS
```

También deben estar aplicadas todas las migraciones y el `supabase/seed.sql` en ese mismo proyecto.

## Crear las dos cuentas

Ejecuta desde la raíz del proyecto:

```bash
npm run provision:demo
```

El aprovisionador es idempotente: crea o reutiliza ambas cuentas, asigna a Natalia el rol `OWNER`, crea una alumna demo y le concede una membresía `ACTIVE` de demostración por 365 días, con precio `0`, sin llamar a Flow ni generar un cobro.

Después prueba este recorrido:

1. Inicia sesión como Natalia y comprueba `/admin`.
2. Publica un video o material y programa una sesión Zoom de prueba.
3. Cierra sesión e ingresa con la alumna demo para comprobar `/para-ti`, el contenido, la sesión y el aviso.

## Alcance actual

El portal de alumna ya muestra contenido, Zoom y notificaciones. El esquema contiene tablas para metas, medidas y registros personales, pero aún no existe una interfaz administrativa/alumna para registrar y visualizar avances físicos o de objetivos. Esa funcionalidad debe implementarse como el siguiente bloque, antes de presentarla como disponible.
