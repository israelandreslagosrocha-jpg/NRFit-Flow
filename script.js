// Elementos del DOM
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const navItems = document.querySelectorAll('.nav-links a');

// Toggle del menú hamburguesa
hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Cerrar menú al hacer clic en un enlace
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navLinks.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar')) {
        navLinks.classList.remove('active');
        hamburger.classList.remove('active');
    }
});

// Efecto de scroll suave en la navegación
navItems.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Animación de botones
const buttons = document.querySelectorAll('.btn-primary');
buttons.forEach(button => {
    button.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.width = '20px';
        ripple.style.height = '20px';
        ripple.style.background = 'rgba(255, 255, 255, 0.5)';
        ripple.style.borderRadius = '50%';
        ripple.style.pointerEvents = 'none';
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        
        const rect = button.getBoundingClientRect();
        ripple.style.left = (e.clientX - rect.left - 10) + 'px';
        ripple.style.top = (e.clientY - rect.top - 10) + 'px';
        
        button.appendChild(ripple);
        
        ripple.animate([
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(4)', opacity: 0 }
        ], {
            duration: 600,
            easing: 'ease-out'
        });
        
        setTimeout(() => ripple.remove(), 600);
    });
});

// Contadores de estadísticas animadas
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'slideUp 0.6s ease-out forwards';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observar tarjetas de servicios
document.querySelectorAll('.servicio-slide, .servicio-detalle-card, .entrenamiento-card, .membresia-card, .resena-card').forEach(card => {
    observer.observe(card);
});

// Formulario de contacto
const contactForm = document.querySelector('.contacto-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const inputs = contactForm.querySelectorAll('input, textarea');
        const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
        
        if (allFilled) {
            // Simular envío del formulario
            const button = contactForm.querySelector('button');
            const originalText = button.textContent;
            button.textContent = '✓ Mensaje Enviado';
            button.style.backgroundColor = '#4caf50';
            
            setTimeout(() => {
                inputs.forEach(input => input.value = '');
                button.textContent = originalText;
                button.style.backgroundColor = '';
            }, 2000);
        } else {
            alert('Por favor completa todos los campos');
        }
    });
}

// Slider de servicios
const serviciosTrack = document.querySelector('.servicios-track');
const servicioSlides = serviciosTrack ? Array.from(serviciosTrack.children) : [];
const prevControl = document.querySelector('.slider-control.prev');
const nextControl = document.querySelector('.slider-control.next');
const dots = document.querySelectorAll('.slider-dots .dot');
let servicioIndex = 0;

function updateServicioSlider(index) {
    if (!serviciosTrack || servicioSlides.length === 0) return;
    servicioIndex = (index + servicioSlides.length) % servicioSlides.length;
    const slideWidth = servicioSlides[0].getBoundingClientRect().width;
    serviciosTrack.style.transform = `translateX(-${servicioIndex * slideWidth}px)`;
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === servicioIndex);
    });
}

if (prevControl && nextControl && serviciosTrack) {
    prevControl.addEventListener('click', () => updateServicioSlider(servicioIndex - 1));
    nextControl.addEventListener('click', () => updateServicioSlider(servicioIndex + 1));
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => updateServicioSlider(i));
    });
    updateServicioSlider(0);
}

window.addEventListener('resize', () => updateServicioSlider(servicioIndex));

// Efecto de parallax suave en el hero
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrollPosition = window.scrollY;
        hero.style.backgroundPosition = `0 ${scrollPosition * 0.5}px`;
    }
});

// Animación de conteo para números
function animateCounter(element, target, duration = 2000) {
    let current = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Cambiar tema oscuro/claro (opcional)
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
}

// Cargar tema guardado
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

// Inicializar tema
loadTheme();

// Smooth scroll para navegadores que no lo soportan
if (!('scrollBehavior' in document.documentElement.style)) {
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            const targetId = e.target.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
}

// Efecto hover en tarjetas
const cards = document.querySelectorAll('.servicio-slide, .servicio-detalle-card, .entrenamiento-card, .membresia-card, .resena-card');
cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
    });
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Validación de email en tiempo real
const emailInputs = document.querySelectorAll('input[type="email"]');
emailInputs.forEach(input => {
    input.addEventListener('blur', function() {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value && !emailRegex.test(this.value)) {
            this.style.borderColor = '#ff6b35';
            this.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
        } else {
            this.style.borderColor = '';
            this.style.backgroundColor = '';
        }
    });
});

console.log('Script cargado correctamente - NR Fit & Flow');
