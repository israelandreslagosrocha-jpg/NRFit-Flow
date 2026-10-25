# Clases públicas y redes — 25 octubre 2026

## Ubicación elegida

Sección «Antes de decidir, entrena conmigo» después de Natalia y antes de «Cómo funciona». Es una elección editorial de conversión: conocer a la entrenadora → probar una clase → evaluar la membresía. No se afirma que exista un lugar universalmente óptimo ni se promete un aumento de ventas sin medición.

El inicio conserva la inscripción como CTA principal y ofrece un acceso secundario a las clases gratuitas. Menú móvil/escritorio y footer permiten encontrar la sección sin recorrer toda la portada. Redes oficiales visibles en la sección y footer.

## Fuentes verificadas

- Canal: https://www.youtube.com/@NRFitandFlow/videos (dos videos públicos observados).
- Pilates para principiantes: https://www.youtube.com/watch?v=BvZ08hjIF4o . Reproducción incrustada comprobada en localhost, con el video y subtítulos visibles.
- Clase de GAP: https://www.youtube.com/watch?v=jjcmvwv1hP8 . YouTube devolvió «Este video no está disponible» en el embed; reproducción directa comprobada en su página original. La tarjeta abre YouTube en nueva pestaña y no crea un reproductor bloqueado.
- Instagram correcto: https://www.instagram.com/nr.fitandflow/ . El usuario lo confirmó y coincide con el enlace del propio canal. La URL sin punto no estaba disponible.
- Miniaturas públicas obtenidas desde el canal mediante el inventario de recursos del navegador, conservadas en AVIF en public/images/free-workouts/. No se descargaron videos.

## Privacidad y límites

- Sin solicitudes de YouTube para miniaturas o reproductor al abrir la portada: imágenes locales y estado inicial sin iframe. Sólo Pilates genera el iframe al pulsar, en youtube-nocookie.com, con un aviso sobre Google.
- No SDK de redes, nuevos permisos CSP, lectura de Instagram privado, tokens ni conexión de cuentas.
- Suscribir/seguir abre la plataforma externa; la visitante confirma allí. No se subscribe ni sigue en nombre del usuario. Los eventos analíticos registran clics, no suscripciones efectivas.
- GA4 mantiene el consentimiento existente y sólo admite IDs de videos públicos y valores de red permitidos. Los dashboards siguen excluidos.
- sameAs vincula la organización con sus redes, sin prometer resultados enriquecidos de video.
- Selección editorial fija de dos clases, no sincronización automática de cada subida futura. «Ver todos los videos del canal» lleva al catálogo actualizado de YouTube.
- Ningún cambio en biblioteca privada, pagos, matrículas ni SQL. No incluye los correos opcionales pendientes de migración.

## Validación

- 24 pruebas correctas de clases públicas, Analytics, contratos del portal y paginación.
- Miniaturas cargadas desde la propia web, cero iframes antes de elegir una clase, un reproductor simultáneo.
- Ancho móvil observado de 382 px: tarjetas apiladas, sin desbordamiento horizontal y reproductor de 200 px de alto.
- Suscripción y seguimiento no ejecutados durante las pruebas.
- Compilación final y despliegue se comprueban antes de entregar.
