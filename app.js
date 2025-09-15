import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc, 
    doc, 
    where,
    serverTimestamp,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variables globales
let currentFilter = 'all';
let streamsData = [];
let searchQuery = '';
let favorites = JSON.parse(localStorage.getItem('ultragol_favorites') || '[]');
let isLoading = false;
let animationSpeed = 300;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Configurar eventos
    setupEventListeners();
    
    // Inicializar búsqueda
    setupSearch();
    
    // Inicializar favoritos
    initializeFavorites();
    
    // Cargar transmisiones
    loadStreams();
    
    // Configurar limpieza automática
    setupAutoCleanup();
    
    // Mostrar sección de transmisiones por defecto
    showSection('transmisiones');
    
    // Agregar efectos de entrada
    addPageLoadAnimations();
}

function setupEventListeners() {
    // Formulario
    const form = document.getElementById('stream-form');
    form.addEventListener('submit', handleFormSubmit);
    
    // Campos condicionales
    const plataformaSelect = document.getElementById('plataforma');
    plataformaSelect.addEventListener('change', toggleOtraPlataforma);
    
    const ligaSelect = document.getElementById('liga');
    ligaSelect.addEventListener('change', toggleOtraLiga);
    
    // Remover eventos onclick inline para usar event listeners seguros
    setupNavigationEvents();
    setupFilterEvents();
}

// Navegación entre secciones
function showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(sectionName).classList.add('active');
    
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el botón correspondiente
    const targetBtn = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// Manejar envío del formulario
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
    
    try {
        const formData = new FormData(e.target);
        const streamData = {
            equipos: formData.get('equipos'),
            plataforma: formData.get('plataforma'),
            otraPlataforma: formData.get('otra-plataforma') || '',
            link: formData.get('link'),
            tiempoPartido: formData.get('tiempo-partido'),
            liga: formData.get('liga'),
            otraLiga: formData.get('otra-liga') || '',
            calidad: formData.get('calidad'),
            idioma: formData.get('idioma'),
            comentarios: formData.get('comentarios') === 'on',
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        };
        
        // Validar URL
        if (!isValidURL(streamData.link)) {
            throw new Error('Por favor ingresa una URL válida');
        }
        
        // Guardar en Firebase
        await addDoc(collection(db, 'streams'), streamData);
        
        // Mostrar notificación de éxito
        showNotification('¡Transmisión publicada exitosamente!', 'success');
        
        // Limpiar formulario
        e.target.reset();
        
        // Cambiar a la sección de transmisiones
        showSection('transmisiones');
        document.querySelector('[onclick="showSection(\'transmisiones\')"]').click();
        
        // Recargar transmisiones
        loadStreams();
        
    } catch (error) {
        console.error('Error al publicar transmisión:', error);
        showNotification('Error al publicar la transmisión: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-share"></i> Compartir Transmisión';
    }
}

// Validar URL de forma segura
function isValidURL(string) {
    try {
        const url = new URL(string);
        // Solo permitir HTTP y HTTPS
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        
        // Lista de dominios permitidos por plataforma
        const allowedDomains = [
            'youtube.com', 'youtu.be', 'www.youtube.com',
            'twitch.tv', 'www.twitch.tv',
            'facebook.com', 'www.facebook.com', 'fb.watch',
            'instagram.com', 'www.instagram.com',
            'tiktok.com', 'www.tiktok.com',
            'kick.com', 'www.kick.com'
        ];
        
        const hostname = url.hostname.toLowerCase();
        return allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch (_) {
        return false;
    }
}

// Mostrar/ocultar campo "otra plataforma"
function toggleOtraPlataforma() {
    const select = document.getElementById('plataforma');
    const otherGroup = document.getElementById('otra-plataforma-group');
    const otherInput = document.getElementById('otra-plataforma');
    
    if (select.value === 'otra') {
        otherGroup.style.display = 'block';
        otherInput.required = true;
    } else {
        otherGroup.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// Mostrar/ocultar campo "otra liga"
function toggleOtraLiga() {
    const select = document.getElementById('liga');
    const otherGroup = document.getElementById('otra-liga-group');
    const otherInput = document.getElementById('otra-liga');
    
    if (select.value === 'otra-liga') {
        otherGroup.style.display = 'block';
        otherInput.required = true;
    } else {
        otherGroup.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// Cargar transmisiones desde Firebase
async function loadStreams() {
    try {
        const q = query(
            collection(db, 'streams'), 
            orderBy('timestamp', 'desc')
        );
        
        // Escuchar cambios en tiempo real
        onSnapshot(q, (querySnapshot) => {
            streamsData = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                streamsData.push(data);
            });
            
            displayStreams(streamsData);
        }, (error) => {
            console.error('Error en tiempo real:', error);
            if (error.code === 'permission-denied') {
                showNotification('Error: Necesitas configurar las reglas de Firebase. Revisa el archivo firestore-rules.txt', 'error');
            } else {
                showNotification('Error al cargar transmisiones en tiempo real', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error al cargar transmisiones:', error);
        showNotification('Error al cargar las transmisiones', 'error');
    }
}

// Mostrar transmisiones en la interfaz de forma segura
function displayStreams(streams) {
    const container = document.getElementById('streams-container');
    
    // Aplicar filtros
    let filteredStreams = applyFilters(streams);
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    if (filteredStreams.length === 0) {
        const noStreamsDiv = createNoStreamsElement();
        container.appendChild(noStreamsDiv);
        return;
    }
    
    // Agregar skeleton loading
    if (isLoading) {
        container.innerHTML = createSkeletonCards(3);
        return;
    }
    
    // Crear cards con animación escalonada
    filteredStreams.forEach((stream, index) => {
        const card = createStreamCardSafe(stream);
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add('fade-in-up');
        container.appendChild(card);
        
        // Inicializar contador de tiempo
        if (stream.id) {
            updateTimeRemaining(stream.id, stream.createdAt);
        }
    });
}

// Obtener texto del tiempo del partido
function getTiempoPartidoDisplay(tiempo) {
    const tiempos = {
        'primer-tiempo': '1er Tiempo',
        'descanso': 'Descanso',
        'segundo-tiempo': '2do Tiempo',
        'tiempo-extra': 'Tiempo Extra',
        'penales': 'Penales'
    };
    return tiempos[tiempo] || 'En vivo';
}

// Obtener icono del tiempo del partido
function getTiempoPartidoIcon(tiempo) {
    const iconos = {
        'primer-tiempo': 'fas fa-play-circle',
        'descanso': 'fas fa-pause-circle',
        'segundo-tiempo': 'fas fa-play-circle',
        'tiempo-extra': 'fas fa-plus-circle',
        'penales': 'fas fa-bullseye'
    };
    return iconos[tiempo] || 'fas fa-circle';
}

// Crear tarjeta de transmisión de forma segura
function createStreamCardSafe(stream) {
    const card = document.createElement('div');
    card.className = 'stream-card modern-card';
    card.setAttribute('data-platform', sanitizeAttribute(stream.plataforma));
    
    // Header
    const header = document.createElement('div');
    header.className = 'stream-header';
    
    const teams = document.createElement('div');
    teams.className = 'stream-teams';
    teams.textContent = sanitizeText(stream.equipos);
    
    const platform = document.createElement('div');
    platform.className = 'stream-platform';
    const platformIcon = document.createElement('i');
    platformIcon.className = getPlatformIcon(stream.plataforma);
    const platformText = document.createElement('span');
    const plataformaDisplay = stream.plataforma === 'otra' ? stream.otraPlataforma : stream.plataforma;
    platformText.textContent = sanitizeText(plataformaDisplay).toUpperCase();
    platform.appendChild(platformIcon);
    platform.appendChild(document.createTextNode(' '));
    platform.appendChild(platformText);
    
    header.appendChild(teams);
    header.appendChild(platform);
    
    // Info section
    const info = document.createElement('div');
    info.className = 'stream-info';
    
    const infoItems = [
        { icon: 'fas fa-trophy', text: stream.liga === 'otra-liga' ? stream.otraLiga : stream.liga },
        { icon: getTiempoPartidoIcon(stream.tiempoPartido), text: getTiempoPartidoDisplay(stream.tiempoPartido) },
        { icon: getQualityIcon(stream.calidad), text: stream.calidad },
        { icon: 'fas fa-language', text: stream.idioma }
    ];
    
    if (stream.comentarios) {
        infoItems.push({ icon: 'fas fa-microphone', text: 'Con comentarios' });
    }
    
    infoItems.forEach(item => {
        const div = document.createElement('div');
        const icon = document.createElement('i');
        icon.className = item.icon;
        const span = document.createElement('span');
        span.textContent = sanitizeText(item.text).toUpperCase();
        div.appendChild(icon);
        div.appendChild(span);
        info.appendChild(div);
    });
    
    // Actions section
    const actions = document.createElement('div');
    actions.className = 'stream-actions';
    
    // Link seguro
    const link = document.createElement('a');
    link.href = sanitizeURL(stream.link);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'stream-link pulse-btn';
    const linkIcon = document.createElement('i');
    linkIcon.className = 'fas fa-play';
    link.appendChild(linkIcon);
    link.appendChild(document.createTextNode(' Ver Transmisión'));
    
    // Timer
    const timer = document.createElement('div');
    timer.className = 'time-remaining';
    timer.id = `timer-${stream.id}`;
    const timerIcon = document.createElement('i');
    timerIcon.className = 'fas fa-clock';
    const timerSpan = document.createElement('span');
    timerSpan.textContent = 'Cargando...';
    timer.appendChild(timerIcon);
    timer.appendChild(timerSpan);
    
    // Botón de favoritos
    const favoriteBtn = createFavoriteButton(stream);
    
    // Botón compartir
    const shareBtn = createShareButton(stream);
    
    actions.appendChild(link);
    actions.appendChild(timer);
    actions.appendChild(favoriteBtn);
    actions.appendChild(shareBtn);
    
    // Ensamblar card
    card.appendChild(header);
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

// Obtener icono de plataforma
function getPlatformIcon(platform) {
    const icons = {
        'youtube': 'fab fa-youtube',
        'instagram': 'fab fa-instagram',
        'tiktok': 'fab fa-tiktok',
        'facebook': 'fab fa-facebook',
        'twitch': 'fab fa-twitch',
        'kick': 'fas fa-play-circle',
        'otra': 'fas fa-desktop'
    };
    return icons[platform] || 'fas fa-desktop';
}

// Obtener icono de calidad
function getQualityIcon(quality) {
    const icons = {
        '4k': 'fas fa-trophy',
        '1080p': 'fas fa-gem',
        '720p': 'fas fa-star',
        '480p': 'fas fa-circle',
        '360p': 'fas fa-dot-circle'
    };
    return icons[quality] || 'fas fa-video';
}

// Actualizar tiempo restante
function updateTimeRemaining(streamId, createdAt) {
    const timer = document.getElementById(`timer-${streamId}`);
    if (!timer) return;
    
    const updateTimer = () => {
        const now = new Date();
        const created = new Date(createdAt);
        const elapsed = now - created;
        const remaining = (1 * 60 * 60 * 1000) - elapsed; // 1 hora en ms
        
        if (remaining <= 0) {
            timer.querySelector('span').textContent = 'Expirado';
            timer.style.background = '#ff4444';
            timer.style.borderColor = '#ff4444';
            timer.style.color = 'white';
            
            // Eliminar transmisión expirada
            deleteExpiredStream(streamId);
            return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        timer.querySelector('span').textContent = `${hours}h ${minutes}m ${seconds}s`;
    };
    
    updateTimer();
    setInterval(updateTimer, 1000);
}

// Eliminar transmisión expirada
async function deleteExpiredStream(streamId) {
    try {
        await deleteDoc(doc(db, 'streams', streamId));
        console.log('Transmisión expirada eliminada:', streamId);
    } catch (error) {
        console.error('Error al eliminar transmisión expirada:', error);
    }
}

// Filtrar transmisiones por plataforma
function filterStreams(platform) {
    currentFilter = platform;
    
    // Actualizar botones de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activar el botón correspondiente
    const targetBtn = document.querySelector(`[onclick="filterStreams('${platform}')"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // Mostrar transmisiones filtradas
    displayStreams(streamsData);
}

// Configurar limpieza automática cada hora
function setupAutoCleanup() {
    // Ejecutar limpieza cada hora
    setInterval(cleanupExpiredStreams, 60 * 60 * 1000); // 1 hora
    
    // Ejecutar limpieza al cargar la página solo si hay permisos
    setTimeout(() => {
        cleanupExpiredStreams();
    }, 5000); // Esperar 5 segundos para que se establezca la conexión
}

// Limpiar transmisiones expiradas
async function cleanupExpiredStreams() {
    try {
        const q = query(collection(db, 'streams'));
        const querySnapshot = await getDocs(q);
        
        const now = new Date();
        const promises = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const created = new Date(data.createdAt);
            const elapsed = now - created;
            const oneHour = 1 * 60 * 60 * 1000; // 1 hora en ms
            
            if (elapsed > oneHour) {
                promises.push(deleteDoc(doc.ref));
            }
        });
        
        if (promises.length > 0) {
            await Promise.all(promises);
            console.log(`${promises.length} transmisiones expiradas eliminadas`);
        }
        
    } catch (error) {
        console.error('Error en limpieza automática:', error);
    }
}

// Mostrar notificaciones de forma segura
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification modern-notification ${type}`;
    
    const icon = document.createElement('i');
    icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = sanitizeText(message);
    
    notification.appendChild(icon);
    notification.appendChild(messageSpan);
    
    document.body.appendChild(notification);
    
    // Animación de entrada
    setTimeout(() => {
        notification.classList.add('show', 'bounce-in');
    }, 100);
    
    // Auto-ocultar con animación
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ======================== FUNCIONES DE UTILIDAD Y SEGURIDAD ========================

// Sanitizar texto para prevenir XSS
function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>&'"]/g, (char) => {
        const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' };
        return entities[char];
    });
}

// Sanitizar URL
function sanitizeURL(url) {
    return isValidURL(url) ? url : '#';
}

// Sanitizar atributos
function sanitizeAttribute(attr) {
    if (typeof attr !== 'string') return '';
    return attr.replace(/['"<>&]/g, '');
}

// ======================== FUNCIONES DE FILTRADO Y BÚSQUEDA ========================

// Aplicar filtros combinados
function applyFilters(streams) {
    let filtered = streams;
    
    // Filtro por plataforma
    if (currentFilter !== 'all') {
        filtered = filtered.filter(stream => 
            stream.plataforma === currentFilter || 
            (stream.plataforma === 'otra' && stream.otraPlataforma && 
             stream.otraPlataforma.toLowerCase().includes(currentFilter))
        );
    }
    
    // Filtro por búsqueda
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(stream => 
            stream.equipos.toLowerCase().includes(query) ||
            stream.liga.toLowerCase().includes(query) ||
            (stream.otraLiga && stream.otraLiga.toLowerCase().includes(query))
        );
    }
    
    return filtered;
}

// Configurar búsqueda
function setupSearch() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-input';
    searchInput.placeholder = '🔍 Buscar equipos o ligas...';
    searchInput.className = 'search-input modern-input';
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.appendChild(searchInput);
    
    const filtersDiv = document.querySelector('.filters');
    filtersDiv.parentNode.insertBefore(searchContainer, filtersDiv);
    
    // Event listener para búsqueda
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value;
            displayStreams(streamsData);
            
            // Efecto de búsqueda
            if (searchQuery) {
                searchContainer.classList.add('searching');
            } else {
                searchContainer.classList.remove('searching');
            }
        }, 300);
    });
}

// ======================== FUNCIONES DE FAVORITOS ========================

// Inicializar favoritos
function initializeFavorites() {
    // Crear botón de vista de favoritos
    const favoritesBtn = document.createElement('button');
    favoritesBtn.className = 'filter-btn favorites-btn';
    favoritesBtn.innerHTML = '<i class="fas fa-heart"></i> Favoritos (' + favorites.length + ')';
    favoritesBtn.addEventListener('click', () => showFavorites());
    
    const filtersDiv = document.querySelector('.filters');
    filtersDiv.appendChild(favoritesBtn);
}

// Crear botón de favoritos
function createFavoriteButton(stream) {
    const btn = document.createElement('button');
    btn.className = 'favorite-btn modern-btn';
    const isFavorite = favorites.includes(stream.id);
    btn.innerHTML = `<i class="fas fa-heart ${isFavorite ? 'favorited' : ''}"></i>`;
    btn.title = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleFavorite(stream.id, btn);
    });
    
    return btn;
}

// Toggle favorito
function toggleFavorite(streamId, btn) {
    const index = favorites.indexOf(streamId);
    const heart = btn.querySelector('i');
    
    if (index === -1) {
        favorites.push(streamId);
        heart.classList.add('favorited');
        btn.title = 'Quitar de favoritos';
        btn.classList.add('bounce');
    } else {
        favorites.splice(index, 1);
        heart.classList.remove('favorited');
        btn.title = 'Agregar a favoritos';
        btn.classList.add('bounce');
    }
    
    localStorage.setItem('ultragol_favorites', JSON.stringify(favorites));
    updateFavoritesCounter();
    
    // Remover animación
    setTimeout(() => btn.classList.remove('bounce'), 300);
}

// Mostrar favoritos
function showFavorites() {
    const favoriteStreams = streamsData.filter(stream => favorites.includes(stream.id));
    displayStreams(favoriteStreams);
    
    // Actualizar filtros visuales
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.favorites-btn').classList.add('active');
    currentFilter = 'favorites';
}

// Actualizar contador de favoritos
function updateFavoritesCounter() {
    const favBtn = document.querySelector('.favorites-btn');
    if (favBtn) {
        favBtn.innerHTML = `<i class="fas fa-heart"></i> Favoritos (${favorites.length})`;
    }
}

// ======================== FUNCIONES DE COMPARTIR ========================

// Crear botón compartir
function createShareButton(stream) {
    const btn = document.createElement('button');
    btn.className = 'share-btn modern-btn';
    btn.innerHTML = '<i class="fas fa-share-alt"></i>';
    btn.title = 'Compartir transmisión';
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        shareStream(stream);
    });
    
    return btn;
}

// Compartir transmisión
async function shareStream(stream) {
    const shareData = {
        title: `${stream.equipos} - ULTRAGOL`,
        text: `¡Mira este partido en vivo: ${stream.equipos} (${stream.liga})!`,
        url: window.location.href
    };
    
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback: copiar al portapapeles
            await navigator.clipboard.writeText(
                `${shareData.text}\n${shareData.url}`
            );
            showNotification('¡Enlace copiado al portapapeles!', 'success');
        }
    } catch (error) {
        console.error('Error al compartir:', error);
    }
}

// ======================== FUNCIONES DE ANIMACIÓN ========================

// Animaciones de carga de página
function addPageLoadAnimations() {
    // Animar logo
    const logo = document.querySelector('.logo h1');
    if (logo) {
        logo.classList.add('logo-glow');
    }
    
    // Animar navegación
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach((btn, index) => {
        btn.style.animationDelay = `${index * 100}ms`;
        btn.classList.add('slide-in-right');
    });
}

// Crear skeleton cards para loading
function createSkeletonCards(count) {
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="stream-card skeleton-card">
                <div class="skeleton-header"></div>
                <div class="skeleton-content"></div>
                <div class="skeleton-actions"></div>
            </div>
        `;
    }
    return skeletonHTML;
}

// Crear elemento "no streams"
function createNoStreamsElement() {
    const div = document.createElement('div');
    div.className = 'no-streams modern-empty-state';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-futbol bounce';
    
    const p1 = document.createElement('p');
    p1.textContent = 'No hay transmisiones disponibles en este momento';
    
    const p2 = document.createElement('p');
    p2.className = 'sub-text';
    p2.textContent = '¡Sé el primero en compartir una transmisión!';
    
    div.appendChild(icon);
    div.appendChild(p1);
    div.appendChild(p2);
    
    return div;
}

// ======================== EVENT HANDLERS SEGUROS ========================

// Configurar navegación sin onclick inline
function setupNavigationEvents() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        const sectionName = btn.getAttribute('data-section') || 
                           (btn.textContent.includes('Transmisiones') ? 'transmisiones' : 'subir');
        btn.addEventListener('click', () => showSection(sectionName));
    });
}

// Configurar filtros sin onclick inline
function setupFilterEvents() {
    const filterBtns = document.querySelectorAll('.filter-btn:not(.favorites-btn)');
    filterBtns.forEach(btn => {
        const platform = btn.getAttribute('data-platform') || 
                        btn.textContent.toLowerCase().replace(' ', '');
        if (platform !== 'favoritos') {
            btn.addEventListener('click', () => filterStreams(platform));
        }
    });
}

// Hacer funciones globales para compatibilidad
window.showSection = showSection;
window.filterStreams = filterStreams;