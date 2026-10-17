# Biblioteca y avisos completos — 17 octubre 2026

## Alcance

Hotfix basado en producción `8581c19`. No incluye el commit pendiente `040a6dd` de reproductor/correos opcionales y no necesita migraciones SQL. No cambia pagos, membresías, permisos de base de datos ni envía avisos nuevos.

## Corrección

- Se elimina el corte total de 12 recursos, 8 avisos y 4 sesiones próximas.
- El servidor recorre rangos de 100 filas hasta agotar los resultados. Un tope menor de respuesta de la API no corta la lectura. Orden estable por fechas y UUID; contenido activo y fecha de publicación conservados.
- Se carga el catálogo autorizado completo; «Cargar más» amplía su presentación en el navegador. No es una búsqueda incremental al servidor. Si el volumen crece sustancialmente conviene añadir cursores y filtros por categoría para reducir el tamaño inicial.
- Entrenamientos asíncronos, repeticiones, documentos y avisos tienen contadores independientes.
- Avisos limitados al perfil autenticado, sin aceptar un ID de alumna desde el cliente. Identidad y membresía se verifican antes de consultar contenido administrativo, además de la protección del layout.
- Las fechas de publicación y agenda usan America/Santiago.
- Volver a la pestaña después de 15 segundos refresca los datos; los avisos locales se sincronizan con la respuesta nueva. No usa Realtime ni constituye una notificación push.
- Un error de consulta se muestra como error recuperable, no como una biblioteca vacía.

## Verificación

- 27 pruebas correctas (paginación, contratos del portal, acompañamiento y privacidad de Analytics).
- Casos de catálogo vacío, 13 publicaciones, 1251 publicaciones, respuesta de API menor al rango solicitado, error intermedio y protección frente a una página que no avanza.
- Lint sin errores, con advertencias heredadas.
- Revisión visual local con 13 publicaciones y 13 avisos sintéticos: 6 → 12 → 13 entrenamientos y 8 → 13 avisos, con contadores independientes y desaparición del botón al completar. Ruta de prueba eliminada antes del commit.
- Pendiente de verificar el despliegue Ready. La sesión disponible en el navegador es administrativa; el recorrido final de una alumna requiere su sesión.
