# Primera etapa de SEO y medición

Fecha: 8 de octubre de 2026. Cuenta propietaria elegida: `newensport.fit@gmail.com`.

## Estado de configuración

- Cuenta Analytics «Naty Entrenadora» y propiedad «Naty Entrenadora · Web» creadas.
- Cuenta `411260259`, propiedad `558035022`; acceso: `https://analytics.google.com/analytics/web/?authuser=1#/a411260259p558035022/reports/intelligenthome` (el selector de cuenta de Google puede variar en otros navegadores).
- Flujo web: `https://natyentrenadora.com`, ID `16065140094`.
- ID de medición: `G-SECMNKSV77` (público, no es una contraseña).
- Chile continental, CLP, empresa pequeña, objetivos oportunidades de venta y ventas.
- Medición mejorada desactivada; opciones de compartir datos opcionales desactivadas.
- Search Console: **propiedad del dominio verificada** mediante DNS con la cuenta elegida. TTL 3600 para conservar el TTL original del RRset TXT `@`, compartido con SPF; los registros originales quedaron intactos. No eliminar ese TXT.
- Sitemap enviado: `https://natyentrenadora.com/sitemap.xml`. Google confirmó el envío, pero su primera lectura indicó «No se ha podido obtener». Comprobación pública: HTTP 200, XML válido servido por Vercel. Recepción/indexación de Google pendiente de comprobar; no equivalen a envío aceptado.
- Variable `NEXT_PUBLIC_GA_MEASUREMENT_ID` guardada y verificada en Vercel **Production**.
- Código publicado en producción: commit `4b748f7`, deployment Vercel `4ngcLdWSj5d3NE89PvGWJ9ydBmAV` con estado **Ready**. La portada oficial muestra el nuevo título SEO y el consentimiento.
- **Recepción real comprobada** en GA4: `page_view` (Inicio y Registro) y `enrollment_start` tras aceptar estadísticas. Son visitas y clics de QA, no alumnas nuevas ni pagos.
- `trial_started` configurado como evento clave **con código**, sin valor monetario predeterminado; no se deriva de una visita a la página de éxito. Todavía no se verificó una nueva activación real de prueba en esta sesión.
- Inspección de portada: ya estaba en el índice; su registro histórico advertía un bloqueo de robots. La prueba en tiempo real del 8 de octubre confirmó **«La URL está disponible para Google / La página se puede indexar»**. Google aceptó la solicitud de nuevo rastreo. Esto no garantiza posición ni actualización inmediata.

## Activación en Vercel

Ya se agregó `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-SECMNKSV77` al entorno **Production** del proyecto `nr-fit-flow-obv5`. Requiere un nuevo build/deploy; cambiar una variable no modifica un deployment ya existente. No agregar otro snippet, Google Tag Manager ni la integración de GA4 de Vercel en paralelo: duplicaría la etiqueta.

La integración sólo funciona en `natyentrenadora.com` y `www.natyentrenadora.com`. No se transmite nada a Google antes de «Aceptar estadísticas». «Solo necesarias» conserva el servicio y no carga la etiqueta. La elección se recuerda en almacenamiento local, y puede retirarse desde el botón de preferencias.

Se usan páginas y parámetros con allowlists. No se envían query strings, hashes, correos, nombres, cuenta, pagos, medidas ni documentos. Se omite también el referrer para no transmitir parámetros externos: esta primera versión prioriza privacidad y **no pretende ofrecer atribución completa de campañas**. Preparar UTMs/atribución con una lista explícita de campañas antes de lanzar anuncios.

## Eventos disponibles

| Evento | Significado real |
| --- | --- |
| `page_view` | Página pública permitida, después del consentimiento |
| `enrollment_start` | Clic en CTA, con ubicación permitida |
| `sign_up` | Supabase creó una identidad de correo; no implica email confirmado ni prueba activa |
| `trial_started` | El servidor creó un trial y lo confirmó en la página de éxito; no es un clic ni una visita repetida |

Google OAuth sigue funcionando sin modificaciones, pero su alta no se cuenta como `sign_up` en esta etapa. `trial_started` sí cubre ambos métodos. Marcadores de trial duran hasta diez minutos en sessionStorage y se consumen una vez; sin consentimiento no se almacenan. Eventos de cliente pueden perderse por bloqueadores/conexión: los conteos operativos de Supabase siguen siendo la autoridad, no Analytics.

No hay `purchase`, ingresos, Meta Pixel, CAPI ni campañas activas. El pago debe medirse después con evidencia de confirmación de la pasarela y deduplicación, no por redirección.

## Verificación después de desplegar

Comprobaciones realizadas el 8 de octubre: build de producción, seis tests de privacidad/medición y nueve tests de contratos del portal aprobados, lint sin errores. En navegador de producción se comprobó ausencia de script Google antes de consentir y al rechazar, ID correcto tras aceptar, eventos reales en GA4, retiro de consentimiento persistido (script ausente al recargar) y banner sin desborde a 390×844. Sin errores de consola en las páginas públicas probadas. No se modificaron cuentas, membresías, SQL ni pasarelas durante estas pruebas.

Pendientes de verificación funcional completa: alta real de correo, activación de trial una sola vez, dashboard autenticado y cookies tras retirar permiso. Las exclusiones y el marcador se verificaron mediante contratos de código, no sustituyen esas pruebas de extremo a extremo. El sitemap sigue con estado «No se ha podido obtener» en Google incluso tras reenviarlo una vez después del deploy; respuesta pública XML HTTP 200 y rastreo actual de la portada correctos. Revisar su próxima lectura sin afirmar que ya fue procesado.

1. Navegador nuevo: rechazar estadísticas; no debe existir carga `googletagmanager.com/gtag/js` ni cookies `_ga*`.
2. Aceptar estadísticas: ver un `page_view` en Tiempo real de la propiedad correcta.
3. Clic de CTA y alta de correo de prueba: revisar eventos, sin incluir correo ni parámetros de URL.
4. Crear una prueba real autorizada y verificar `trial_started` una sola vez; refrescar éxito no debe repetirlo.
5. Entrar al dashboard: no debe enviar nuevas vistas/eventos de esa ruta.
6. Retirar consentimiento: detener eventos y eliminar cookies `_ga*` accesibles para el dominio.
7. Search Console: agregar TXT sin borrar MX/SPF/DKIM, verificar, enviar `/sitemap.xml` y revisar indexación de la portada.

## Siguiente etapa comercial

No prometemos posiciones ni volumen de búsqueda. Search Console mostrará consultas reales cuando haya impresiones. Preparar con Natalia tres contenidos originales: entrenar con poco tiempo, empezar desde casa y combinar las dos clases en vivo con la biblioteca. Validar su experiencia/textos antes de publicar. Los documentos legales actuales siguen marcados como borrador: requieren revisión profesional, incluso con esta integración de consentimiento.
