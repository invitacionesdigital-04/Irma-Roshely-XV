// Variables globales
let isPlaying = false;
let player = null;
let playerReady = false;
const totalSlides = 7;
let enableMusic = false;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeIntro();
    initializeCountdown();
    initializeCarousel();
    initializeParallax();
    initializeGuestGreeting();
    loadYouTubeAPI(); // Se precarga desde el inicio (no en el click) para que
                       // playVideo() pueda ejecutarse de forma síncrona dentro
                       // del gesto del usuario. Esto es lo que exige iOS Safari.
});

// Intro animada en dos partes:
//   1) Video del búho: arranca solo al entrar (silenciado, que es lo único
//      que los navegadores móviles permiten reproducir sin interacción).
//   2) Al tocar cualquier parte de la pantalla: video del sobre abriéndose
//      (también sin sonido). Ese mismo primer toque arranca, de forma
//      invisible, la música de fondo de YouTube, así que cuando aparece la
//      portada la música ya viene sonando. Al final, la portada entra con
//      un efecto mágico (destellos + texto que aparece).
function initializeIntro() {
    const overlay = document.getElementById('introOverlay');
    const v1 = document.getElementById('introVideo1');
    const v2 = document.getElementById('introVideo2');
    const hint = document.getElementById('introHint');
    if (!overlay || !v1 || !v2) {
        document.documentElement.classList.remove('intro-activo');
        revealHero();
        return;
    }

    let opened = false;
    let finished = false;
    const showHint = () => { if (!opened && hint) hint.classList.add('is-visible'); };

    // 1) Búho: autoplay silenciado. Si el navegador lo bloquea (ej. modo de
    //    ahorro de batería en iPhone) se queda el póster y mostramos el aviso.
    const p1 = v1.play();
    if (p1 && p1.catch) p1.catch(showHint);
    v1.addEventListener('ended', showHint);
    setTimeout(showHint, 9000); // respaldo por si 'ended' no llega a dispararse

    function finishIntro() {
        if (finished) return;
        finished = true;
        overlay.classList.add('is-leaving');
        document.documentElement.classList.remove('intro-activo');
        window.scrollTo(0, 0);
        revealHero();
        if (enableMusic) document.getElementById('musicPlayer').style.display = 'block';
        setTimeout(() => {
            v1.pause();
            v2.pause();
            overlay.remove();
        }, 950);
    }

    function openEnvelope() {
        if (opened) return;
        opened = true;
        if (hint) hint.classList.remove('is-visible');

        // Primer toque = gesto del usuario: aquí arranca la música de fondo.
        // Tiene que ir ANTES de cualquier cosa asíncrona para que iOS lo permita.
        startBackgroundMusic();

        // Se muestra el video 2 solo cuando ya está reproduciendo, para que no
        // haya un parpadeo negro entre un video y otro.
        v2.addEventListener('playing', () => {
            v2.classList.add('is-visible');
            v1.classList.remove('is-visible');
            v1.pause();
        }, { once: true });

        // Empezar a desvanecer un poco antes del final, justo en el destello de luz
        v2.addEventListener('timeupdate', () => {
            if (v2.duration && v2.currentTime >= v2.duration - 0.9) finishIntro();
        });
        v2.addEventListener('ended', finishIntro);
        v2.addEventListener('error', finishIntro);

        // El video del sobre va siempre silenciado (solo suena la música de fondo)
        v2.muted = true;
        const p2 = v2.play();
        if (p2 && p2.catch) p2.catch(finishIntro);

        setTimeout(finishIntro, 12000); // respaldo por si el video se queda cargando
    }

    overlay.addEventListener('click', openEnvelope);
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEnvelope();
        }
    });
}

// Arranca la música de fondo (se llama dentro del primer toque del invitado).
// El reproductor de YouTube ya se precargó al abrir la página, así que
// playVideo() se ejecuta en el mismo instante del toque, que es lo que exige iOS.
function startBackgroundMusic() {
    enableMusic = true;
    if (playerReady && player) {
        player.playVideo();
        isPlaying = true;
        updateMusicIcon();
    }
    // Si YouTube todavía no terminó de cargar (internet lento),
    // onPlayerReady la reproduce apenas esté listo.
}

// Efecto mágico de entrada de la portada
function revealHero() {
    const root = document.documentElement;
    if (root.classList.contains('hero-reveal')) return;
    root.classList.remove('hero-pending');
    root.classList.add('hero-reveal');
    spawnMagicSparkles();
}

function spawnMagicSparkles() {
    const layer = document.getElementById('magicLayer');
    if (!layer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rand = (min, max) => Math.random() * (max - min) + min;

    // Ráfaga inicial de destellos que suben y se desvanecen
    for (let i = 0; i < 46; i++) {
        const s = document.createElement('span');
        s.className = 'magic-spark' + (Math.random() < 0.35 ? ' is-star' : '');
        if (s.classList.contains('is-star')) s.textContent = '✦';
        const size = rand(3, 9);
        s.style.left = rand(3, 97) + '%';
        s.style.top = rand(8, 92) + '%';
        s.style.setProperty('--size', size + 'px');
        s.style.setProperty('--rise', -rand(30, 90) + 'px');
        s.style.setProperty('--drift', rand(-25, 25) + 'px');
        s.style.animationDelay = rand(0.1, 2.4) + 's';
        s.style.animationDuration = rand(1.6, 2.8) + 's';
        layer.appendChild(s);
        setTimeout(() => s.remove(), 6000);
    }

    // Unos cuantos destellos suaves que se quedan titilando en la portada
    for (let i = 0; i < 14; i++) {
        const t = document.createElement('span');
        t.className = 'magic-twinkle';
        t.style.left = rand(5, 95) + '%';
        t.style.top = rand(10, 90) + '%';
        t.style.setProperty('--size', rand(2, 5) + 'px');
        t.style.animationDelay = rand(2.5, 6) + 's';
        t.style.animationDuration = rand(2.2, 4) + 's';
        layer.appendChild(t);
    }
}

// Sección de saludo personalizado por invitado/familia, leída desde la URL.
// Formatos soportados:
//   ?invitados=Juan Arias,Yerianny Arias,Valery Arias
//   ?familia=Arias
// Muestra un badge con el total, título "Invitados", el número de
// acompañantes (si aplica) y cada nombre como fila con colores intercalados
// de la paleta del sitio (marrón / dorado), ciclando si hay más de 4 nombres.
function initializeGuestGreeting() {
    const params = new URLSearchParams(window.location.search);
    const invitadosParam = params.get('invitados');
    const familiaParam = params.get('familia');

    const section = document.getElementById('guestSection');
    const badge = document.getElementById('guestBadge');
    const subtitle = document.getElementById('guestSubtitle');
    const greeting = document.getElementById('guestGreeting');
    if (!section || !badge || !subtitle || !greeting) return;

    let names = [];

    if (invitadosParam) {
        names = invitadosParam.split(',').map(n => decodeURIComponent(n.trim())).filter(Boolean);
    } else if (familiaParam) {
        names = [`Familia ${familiaParam.trim()}`];
    }

    if (names.length === 0) return;

    // Badge con el total de invitados
    badge.textContent = names.length;

    // Subtítulo de acompañantes: solo tiene sentido cuando hay más de un
    // nombre individual (no aplica al formato "Familia X")
    const companions = invitadosParam ? names.length - 1 : 0;
    if (companions > 0) {
        subtitle.textContent = `(${companions} acompañante${companions > 1 ? 's' : ''})`;
        subtitle.style.display = 'block';
    } else {
        subtitle.style.display = 'none';
    }

    // Limpiar contenido previo
    greeting.innerHTML = '';

    names.forEach((name, index) => {
        const nameSpan = document.createElement('span');
        const colorIndex = (index % 4) + 1;
        nameSpan.className = `guest-name color-${colorIndex}`;
        nameSpan.textContent = name;
        greeting.appendChild(nameSpan);
    });

    section.style.display = 'block';
}

// Cargar la API de YouTube
function loadYouTubeAPI() {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = initializeYouTubePlayer;
}

// Función llamada por la API de YouTube
function initializeYouTubePlayer() {
    player = new YT.Player('youtube-player', {
        height: '1',
        width: '1',
        videoId: 'vwp1yxtcD7I',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            loop: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playlist: 'vwp1yxtcD7I'
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    playerReady = true;
    const musicToggle = document.getElementById('musicToggle');
    musicToggle.addEventListener('click', toggleMusic);

    // Caso borde: el usuario ya hizo click en "con música" antes de que el
    // player terminara de inicializar (ej. conexión lenta). Lo reproducimos
    // apenas esté listo.
    if (enableMusic && !isPlaying) {
        document.getElementById('musicPlayer').style.display = 'block';
        event.target.playVideo();
        isPlaying = true;
        updateMusicIcon();
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
    }
    updateMusicIcon();
}

function onPlayerError(event) {
    console.log('Error al cargar el video de YouTube');
    const musicPlayer = document.getElementById('musicPlayer');
    musicPlayer.style.display = 'block';
    isPlaying = false;
    updateMusicIcon();
}

function toggleMusic() {
    if (player) {
        if (isPlaying) {
            player.pauseVideo();
            isPlaying = false;
        } else {
            player.playVideo();
            isPlaying = true;
        }
        updateMusicIcon();
    }
}

function updateMusicIcon() {
    const volumeIcon = document.getElementById('volumeIcon');
    
    if (isPlaying) {
        volumeIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08"></path>
        `;
    } else {
        volumeIcon.innerHTML = `
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
        `;
    }
}

// Countdown
function initializeCountdown() {
    const targetDate = new Date('2026-11-28T17:00:00').getTime();
    
    function updateCountdown() {
        const now = new Date().getTime();
        const difference = targetDate - now;
        
        if (difference > 0) {
            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            
            document.getElementById('days').textContent = days.toString().padStart(2, '0');
            document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
            document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
            document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
        } else {
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
        }
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Carrusel (loop infinito real con clones: al llegar a la última foto avanza
// hacia una copia de la primera y luego "teletransporta" sin transición de
// vuelta al inicio real, así siempre se ve avanzando de derecha a izquierda,
// nunca retrocediendo)
let carouselIndex = 1; // arranca en la 1ª foto real (índice 0 es el clon de la última)
let carouselTransitioning = false;

function initializeCarousel() {
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const totalSlidesElement = document.getElementById('totalSlides');

    totalSlidesElement.textContent = totalSlides;

    // Posición inicial sin animación
    track.style.transition = 'none';
    track.style.transform = `translateX(${-carouselIndex * 100}%)`;
    updateSlideCounter();

    track.addEventListener('transitionend', () => {
        if (carouselIndex === totalSlides + 1) {
            // Llegó al clon de la primera foto: salta sin animar a la real
            carouselIndex = 1;
            track.style.transition = 'none';
            track.style.transform = `translateX(${-carouselIndex * 100}%)`;
            void track.offsetWidth; // fuerza reflow antes de reactivar la transición
        } else if (carouselIndex === 0) {
            // Llegó al clon de la última foto (retroceso manual): salta a la real
            carouselIndex = totalSlides;
            track.style.transition = 'none';
            track.style.transform = `translateX(${-carouselIndex * 100}%)`;
            void track.offsetWidth;
        }
        carouselTransitioning = false;
    });

    prevBtn.addEventListener('click', () => {
        if (carouselTransitioning) return;
        carouselTransitioning = true;
        carouselIndex--;
        goToCarouselSlide();
    });

    nextBtn.addEventListener('click', () => {
        if (carouselTransitioning) return;
        carouselTransitioning = true;
        carouselIndex++;
        goToCarouselSlide();
    });

    // Auto-play del carrusel: siempre avanza (derecha a izquierda)
    setInterval(() => {
        if (carouselTransitioning) return;
        carouselTransitioning = true;
        carouselIndex++;
        goToCarouselSlide();
    }, 2500);
}

function goToCarouselSlide() {
    const track = document.getElementById('carouselTrack');
    track.style.transition = 'transform 0.5s ease-in-out';
    track.style.transform = `translateX(${-carouselIndex * 100}%)`;
    updateSlideCounter();
}

function updateSlideCounter() {
    const currentSlideElement = document.getElementById('currentSlide');
    let display = carouselIndex;
    if (display === 0) display = totalSlides;
    else if (display === totalSlides + 1) display = 1;
    currentSlideElement.textContent = display;
}

// Parallax en la portada izquierda (layer transform to emulate fixed background)
function initializeParallax() {
    const heroLeft = document.querySelector('.hero-left');
    const heroLayer = document.querySelector('.hero-left .hero-left-bg');
    if (!heroLeft || !heroLayer) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let lastScrollY = window.scrollY || window.pageYOffset;
    let ticking = false;

    const computeSpeed = () => (window.innerWidth <= 768 ? 0.65 : 0.5);

    const render = () => {
        if (prefersReducedMotion.matches) {
            heroLayer.style.transform = 'translate3d(0,0,0)';
        } else {
            const speed = computeSpeed();
            // Tope: nunca desplazar más que el colchón real de la capa (60px fijos,
            // igual al valor definido en CSS), para que no se despegue del contenedor
            // y deje un hueco vacío, sin necesidad de sobredimensionar la imagen.
            const BUFFER_PX = 60;
            let translateY = lastScrollY * speed;
            translateY = Math.max(0, Math.min(BUFFER_PX, translateY));
            heroLayer.style.transform = `translate3d(0, ${Math.round(translateY)}px, 0)`;
        }
        ticking = false;
    };

    const onScroll = () => {
        lastScrollY = window.scrollY || window.pageYOffset;
        if (!ticking) {
            window.requestAnimationFrame(render);
            ticking = true;
        }
    };

    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', render);
}

// Funciones de los botones

function showDressCode() {
    showToast("Código de Vestimenta", "Formal. Nota: por favor no asistir con los siguientes colores: vino tinto, malva, beige y blanco 👗");
}

function sharePhotos() {
    window.open('https://photos.app.goo.gl/5gzRABHjuNhGsoVP8', '_blank');
}

function openGiftLink() {
    window.open('https://invitacionesdigital-04.github.io/Numerodecuenta/', '_blank');
}

function confirmAttendance() {
    window.open('https://docs.google.com/forms/d/e/1FAIpQLScE--FHaXBwnoUl_yjudMz-rZywKmJ2TRczQNtEuV9yKi-CcQ/viewform?usp=header', '_blank');
}

// Sistema de Toast
function showToast(title, message) {
    const toast = document.getElementById('toast');
    const toastContent = document.getElementById('toastContent');
    
    toastContent.innerHTML = `
        <h4 style="font-weight: 600; color: hsl(var(--brown)); margin-bottom: 0.5rem;">${title}</h4>
        <p style="color: hsl(var(--foreground) / 0.7);">${message}</p>
    `;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
