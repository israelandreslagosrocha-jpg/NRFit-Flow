# Configuración y Personalización - NR Fit & Flow

Este documento te guiará a través de las personalizaciones más comunes que puedes hacer en tu página web.

## 📝 Cambios Rápidos

### 1. Cambiar el Nombre del Gimnasio

**Archivo: `index.html` y `about.html`**

Busca todas las instancias de "NR Fit & Flow" y reemplázalas con el nombre de tu gimnasio:

```html
<!-- Antes -->
<span>NR Fit & Flow</span>

<!-- Después -->
<span>Mi Gimnasio</span>
```

### 2. Cambiar Información de Contacto

**Archivo: `index.html` (Sección Contacto)**

```html
<!-- Dirección -->
<p>Calle Principal 123<br>Ciudad, País 12345</p>

<!-- Teléfono -->
<p>+1 (555) 123-4567</p>

<!-- Email -->
<p>info@nrfitflow.com</p>

<!-- Horario -->
<p>Lun-Vie: 6:00 - 22:00<br>Sáb-Dom: 8:00 - 20:00</p>
```

### 3. Ajustar Precios de Membresías

**Archivo: `index.html` (Sección Membresías)**

```html
<!-- Cambiar precio -->
<div class="price">$29<span>/mes</span></div>

<!-- Cambiar características -->
<li><i class="fas fa-check"></i> Acceso a instalaciones</li>
<li><i class="fas fa-check"></i> Horario completo</li>
```

### 4. Agregar o Editar Testimonios

**Archivo: `index.html` (Sección Testimonios)**

```html
<div class="testimonio-card">
    <div class="stars">
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
    </div>
    <p>"Tu testimonio aquí"</p>
    <h4>Nombre del Cliente</h4>
    <span>Tiempo como miembro</span>
</div>
```

## 🎨 Personalización de Colores

**Archivo: `styles.css`**

Cambia estos valores al inicio del archivo:

```css
:root {
    --primary-color: #ff6b35;      /* Cambiar color principal */
    --secondary-color: #004e89;    /* Cambiar color secundario */
    --accent-color: #1a73e8;       /* Cambiar color de acento */
    --dark-bg: #0a0e27;            /* Cambiar fondo oscuro */
    --light-bg: #f8f9fa;           /* Cambiar fondo claro */
}
```

### Combinaciones de Colores Recomendadas

**Opción 1: Energía y Dinamismo**
```css
--primary-color: #e74c3c;    /* Rojo */
--secondary-color: #2c3e50;  /* Azul oscuro */
```

**Opción 2: Moderno y Profesional**
```css
--primary-color: #3498db;    /* Azul */
--secondary-color: #34495e;  /* Gris oscuro */
```

**Opción 3: Natural y Fresco**
```css
--primary-color: #1abc9c;    /* Verde turquesa */
--secondary-color: #27ae60;  /* Verde oscuro */
```

**Opción 4: Elegante y Premium**
```css
--primary-color: #9b59b6;    /* Púrpura */
--secondary-color: #2c3e50;  /* Negro azulado */
```

## 🖼️ Cambiar Imágenes

### Imágenes de Entrenamientos

**Archivo: `index.html` (Sección Entrenamientos)**

```html
<img src="AQUI_VA_TU_URL" alt="Descripción">
```

Sitios recomendados para imágenes gratis:
- **Unsplash**: https://unsplash.com
- **Pexels**: https://pexels.com
- **Pixabay**: https://pixabay.com
- **Envato Elements**: https://elements.envato.com

### Galería de Instalaciones

**Archivo: `about.html` (Sección Galería)**

Reemplaza las URLs de las imágenes con tus propias fotos del gimnasio.

## 📱 Agregar Página de Clases

Crea un archivo `clases.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuestras Clases - NR Fit & Flow</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- Navega como en index.html -->
    <nav class="navbar">
        <!-- ... mismo navbar ... -->
    </nav>

    <section class="clases">
        <div class="container">
            <h1>Nuestras Clases</h1>
            
            <div class="clases-grid">
                <div class="clase-card">
                    <h3>Yoga</h3>
                    <p>Lunes, Miércoles, Viernes</p>
                    <p>7:00 AM - 8:30 AM</p>
                    <p>Instructora: Ana García</p>
                </div>
                <!-- Más clases... -->
            </div>
        </div>
    </section>

    <!-- Footer -->
</body>
</html>
```

## 🔗 Agregar Enlaces en Navegación

**Archivo: `index.html` (Navbar)**

```html
<li><a href="clases.html">Clases</a></li>
```

## ⚡ Optimización de Performance

### 1. Comprimir Imágenes
- Usa [TinyPNG](https://tinypng.com) para reducir tamaño
- Mantén imágenes bajo 500KB

### 2. Habilitar Lazy Loading
```html
<img src="imagen.jpg" loading="lazy" alt="Descripción">
```

### 3. Minificar CSS y JavaScript (opcional)
- Usa [CSS Minifier](https://www.minifier.org)
- Usa [JS Minifier](https://www.minifier.org)

## 🔐 Integración de Formulario

Para que el formulario funcione realmente:

### Opción 1: Usar Formspree
1. Ve a https://formspree.io
2. Crea una cuenta gratuita
3. Reemplaza en `index.html`:

```html
<form class="contacto-form" action="https://formspree.io/f/TU_ID" method="POST">
    <input type="text" name="nombre" placeholder="Tu Nombre" required>
    <input type="email" name="email" placeholder="Tu Email" required>
    <textarea name="mensaje" placeholder="Tu Mensaje" rows="5" required></textarea>
    <button type="submit" class="btn btn-primary">Enviar Mensaje</button>
</form>
```

### Opción 2: Usar Netlify Forms
Si despliegas en Netlify, el formulario funcionará automáticamente.

## 🚀 Desplegar la Página

### Opción 1: Netlify (RECOMENDADO)
1. Ve a https://netlify.com
2. Haz clic en "New site from Git"
3. Conecta tu repositorio Git
4. ¡Tu sitio estará en vivo automáticamente!

### Opción 2: Vercel
1. Ve a https://vercel.com
2. Importa tu proyecto
3. ¡Desplegado en segundos!

### Opción 3: GitHub Pages
1. Crea un repositorio en GitHub
2. Sube tus archivos
3. Ve a Settings → Pages → Branch: main → Save

### Opción 4: Servidor Tradicional
1. Copia todos los archivos a tu servidor
2. Asegúrate de que `index.html` sea la página por defecto

## 📊 Analytics y SEO

### Agregar Google Analytics
Agrega esto en `index.html` antes del cierre de `</head>`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### Mejorar SEO
En `index.html` agrega:

```html
<meta name="description" content="Descripción breve de tu gimnasio">
<meta name="keywords" content="gimnasio, fitness, entrenamiento">
<meta name="author" content="Tu Nombre">
```

## 🎯 Próximos Pasos Sugeridos

1. **Backend**: Agregar base de datos para membresías
2. **Reservas**: Sistema de reserva de clases en línea
3. **Blog**: Artículos sobre fitness
4. **App Móvil**: Versión nativa para iOS/Android
5. **WhatsApp**: Integrar botón de WhatsApp
6. **Chat**: Sistema de chat en vivo

## 📞 Soporte

Si necesitas ayuda con algo específico:
- Revisa el archivo README.md
- Consulta la documentación de CSS3 y JavaScript
- Explora ejemplos en [CodePen](https://codepen.io)

---

**Última actualización**: 23 de enero de 2026

