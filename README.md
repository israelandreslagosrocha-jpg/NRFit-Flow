# NR Fit & Flow - Página Web Moderna para Gimnasio

Una página web completamente responsiva y moderna para un gimnasio, construida con HTML5, CSS3 y JavaScript vanilla.

## 🎯 Características Principales

- ✅ **Diseño Responsivo**: Se adapta perfectamente a dispositivos móviles, tablets y desktops
- ✅ **Navegación Intuitiva**: Menú sticky con efecto hamburguesa para móviles
- ✅ **Hero Section Animado**: Introducción visual impactante con animaciones suaves
- ✅ **6 Secciones de Servicios**: Presentación clara de todos los servicios del gimnasio
- ✅ **Programas de Entrenamiento**: Showcase de diferentes tipos de entrenamientos
- ✅ **3 Planes de Membresía**: Con precios y características detalladas
- ✅ **Testimonios**: Sección con reseñas de clientes reales
- ✅ **Formulario de Contacto**: Validación en tiempo real y experiencia mejorada
- ✅ **Redes Sociales**: Enlaces a plataformas de redes sociales
- ✅ **Animaciones Fluidas**: Transiciones suaves y efectos visuales modernos
- ✅ **SEO Optimizado**: Estructura HTML semántica y meta tags
- ✅ **Performance**: Carga rápida y optimización de recursos

## 📁 Estructura de Archivos

```
WEB NR/
├── index.html          # Archivo HTML principal
├── styles.css          # Estilos CSS
├── script.js           # Funcionalidades JavaScript
└── README.md           # Este archivo
```

## 🚀 Cómo Usar

### Opción 1: Abrir directamente en el navegador
1. Abre el archivo `index.html` con tu navegador web favorito
2. ¡Listo! La página está completamente funcional

### Opción 2: Usando un servidor local (recomendado)

**Con Python 3:**
```bash
cd "/Users/teomusicrecords/Downloads/NR FIT AND FLOW/WEB NR"
python -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador

**Con Node.js (usando http-server):**
```bash
npm install -g http-server
cd "/Users/teomusicrecords/Downloads/NR FIT AND FLOW/WEB NR"
http-server
```

**Con VS Code (Live Server):**
1. Instala la extensión "Live Server" de Ritwick Dey
2. Haz clic derecho en `index.html`
3. Selecciona "Open with Live Server"

## 🎨 Personalización

### Cambiar Colores
Los colores principales están definidos en el archivo `styles.css` como variables CSS:

```css
:root {
    --primary-color: #ff6b35;      /* Naranja - Color principal */
    --secondary-color: #004e89;    /* Azul oscuro */
    --accent-color: #1a73e8;       /* Azul */
    --dark-bg: #0a0e27;            /* Fondo oscuro */
    --light-bg: #f8f9fa;           /* Fondo claro */
    --text-dark: #1a1a1a;          /* Texto oscuro */
    --text-light: #ffffff;         /* Texto claro */
}
```

### Cambiar Textos y Contenido
Todos los textos están en el archivo `index.html`. Edita las secciones relevantes:
- Logo y nombre del gimnasio
- Descripciones de servicios
- Precios de membresías
- Información de contacto
- Testimonios

### Agregar Imágenes
Las imágenes en la sección de entrenamientos provienen de Unsplash. Puedes reemplazarlas con tus propias imágenes:

```html
<img src="tu-imagen.jpg" alt="Descripción">
```

## 🔧 Funcionalidades JavaScript

### 1. Menú Hamburguesa
- Se activa automáticamente en pantallas pequeñas
- Cierra al hacer clic en un enlace o fuera del menú

### 2. Navegación Suave
- Scroll automático a secciones
- Efecto smooth scroll

### 3. Animaciones
- Tarjetas que se animan al entrar al viewport
- Efecto parallax en el hero
- Ondas ripple en botones

### 4. Formulario de Contacto
- Validación de email en tiempo real
- Confirmación visual al enviar
- Limpiar campos después del envío

## 📱 Responsividad

La página está completamente optimizada para:
- 📱 **Móviles**: 320px - 480px
- 📱 **Tablets**: 481px - 768px
- 💻 **Desktops**: 769px+

## 🌟 Características Avanzadas

- **Intersection Observer API**: Animaciones al entrar al viewport
- **localStorage**: Almacena preferencias del usuario
- **Media Queries**: Responsive design completo
- **CSS Grid & Flexbox**: Layouts modernos y flexibles
- **Animaciones CSS**: Transiciones suaves sin dependencias

## 🔒 Compatibilidad

- ✅ Chrome/Edge (últimas versiones)
- ✅ Firefox (últimas versiones)
- ✅ Safari (últimas versiones)
- ✅ Navegadores móviles modernos

## 📝 Mejoras Futuras Sugeridas

1. **Base de datos**: Conectar con backend para gestionar membresías
2. **Sistema de reservas**: Reservar clases y entrenadores
3. **Portal de miembros**: Área privada para usuarios registrados
4. **Blog**: Artículos sobre fitness y nutrición
5. **Galería**: Más fotos del gimnasio e instalaciones
6. **Carrito de compras**: Para vender merchandise
7. **Chat en vivo**: Soporte al cliente en tiempo real
8. **App móvil**: Versión nativa para iOS/Android

## 📧 Información de Contacto

- **Email**: info@nrfitflow.com
- **Teléfono**: +1 (555) 123-4567
- **Ubicación**: Calle Principal 123, Ciudad

## 📄 Licencia

Este proyecto es de código abierto y puede ser modificado libremente para uso personal y comercial.

## 🙏 Créditos

- **Iconos**: Font Awesome 6.4.0
- **Imágenes**: Unsplash (placeholder)
- **Fuentes**: Segoe UI, sistema

---

**Versión**: 1.0  
**Última actualización**: 23 de enero de 2026  
**Creado para**: NR Fit & Flow Gymnasium

