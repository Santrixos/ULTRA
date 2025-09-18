import { db, auth, signInWithGoogle, signOutUser, onAuthStateChanged, handleAuthDomain } from './firebase-config.js';
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
    onSnapshot,
    setDoc,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ======================== ULTRA-CREATIVE SEARCH FUNCTIONALITY ========================

class UltraSearchEngine {
    constructor() {
        this.searchInput = document.getElementById('stream-search');
        this.searchClear = document.getElementById('search-clear');
        this.searchSuggestions = document.getElementById('search-suggestions');
        this.streamsContainer = document.getElementById('streams-container');
        this.allStreams = [];
        this.isSearching = false;
        
        this.initializeSearch();
    }
    
    initializeSearch() {
        if (!this.searchInput) return;
        
        // Input events
        this.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
        this.searchInput.addEventListener('focus', () => this.showSuggestions());
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Clear button
        this.searchClear.addEventListener('click', () => this.clearSearch());
        
        // Suggestion clicks
        this.searchSuggestions.addEventListener('click', (e) => this.handleSuggestionClick(e));
        
        // Click outside to close
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeyboard(e));
    }
    
    handleSearchInput(e) {
        const searchTerm = e.target.value.trim();
        
        // Show/hide clear button
        this.searchClear.classList.toggle('show', searchTerm.length > 0);
        
        // Real-time search
        if (searchTerm.length >= 2) {
            this.performSearch(searchTerm);
            this.hideSuggestions();
        } else if (searchTerm.length === 0) {
            this.clearSearch();
        }
    }
    
    performSearch(searchTerm) {
        this.isSearching = true;
        this.showSearchLoading();
        
        // Simulate search delay for better UX
        setTimeout(() => {
            const filteredStreams = this.filterStreams(searchTerm);
            this.displaySearchResults(searchTerm, filteredStreams);
            this.isSearching = false;
        }, 300);
    }
    
    filterStreams(searchTerm) {
        const term = searchTerm.toLowerCase();
        return this.allStreams.filter(stream => {
            return stream.equipos?.toLowerCase().includes(term) ||
                   stream.liga?.toLowerCase().includes(term) ||
                   stream.plataforma?.toLowerCase().includes(term) ||
                   stream.idioma?.toLowerCase().includes(term);
        });
    }
    
    displaySearchResults(searchTerm, results) {
        // Show search info
        this.showSearchInfo(searchTerm, results.length);
        
        // Display results or no results message
        if (results.length > 0) {
            this.renderStreams(results, searchTerm);
        } else {
            this.showNoResults(searchTerm);
        }
    }
    
    showSearchInfo(searchTerm, resultsCount) {
        const existingInfo = document.querySelector('.search-results-info');
        if (existingInfo) existingInfo.remove();
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'search-results-info';
        infoDiv.innerHTML = `
            <i class="fas fa-search"></i>
            Se encontraron <strong>${resultsCount}</strong> transmisiones para 
            "<span class="search-term">${searchTerm}</span>"
        `;
        
        this.streamsContainer.parentNode.insertBefore(infoDiv, this.streamsContainer);
    }
    
    showNoResults(searchTerm) {
        this.streamsContainer.innerHTML = `
            <div class="no-streams">
                <i class="fas fa-search"></i>
                <p>No se encontraron transmisiones para "${searchTerm}"</p>
                <p class="sub-text">Intenta con otros términos como nombres de equipos o ligas</p>
                <button class="action-btn primary" onclick="ultraSearch.clearSearch()">
                    <i class="fas fa-arrow-left"></i> Ver todas las transmisiones
                </button>
            </div>
        `;
    }
    
    renderStreams(streams, searchTerm = '') {
        this.streamsContainer.innerHTML = '';
        
        streams.forEach(stream => {
            const streamCard = this.createStreamCard(stream, searchTerm);
            this.streamsContainer.appendChild(streamCard);
        });
    }
    
    createStreamCard(stream, searchTerm = '') {
        const card = document.createElement('div');
        card.className = 'stream-card';
        
        // Highlight search terms
        const highlightText = (text) => {
            if (!searchTerm || !text) return text;
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return text.replace(regex, '<span class="search-highlight">$1</span>');
        };
        
        card.innerHTML = `
            <div class="stream-card-header">
                <div class="stream-teams">${highlightText(stream.equipos)}</div>
                <div class="stream-meta">
                    <span class="stream-badge live">EN VIVO</span>
                    <span class="stream-badge platform-badge">${stream.plataforma}</span>
                    <span class="stream-badge quality-badge">${stream.calidad}</span>
                </div>
            </div>
            <div class="stream-card-body">
                <div class="stream-info">
                    <div class="info-item">
                        <i class="fas fa-trophy"></i>
                        <span>${highlightText(stream.liga)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-language"></i>
                        <span>${highlightText(stream.idioma)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <span>${stream.tiempoPartido}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <span>${stream.usuario}</span>
                    </div>
                </div>
                <div class="stream-actions">
                    <button class="action-btn primary" onclick="window.open('${stream.link}', '_blank')">
                        <i class="fas fa-play"></i> Ver Stream
                    </button>
                    <button class="action-btn" onclick="ultraSearch.copyStreamLink('${stream.link}')">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }
    
    showSuggestions() {
        if (this.searchInput.value.trim().length === 0) {
            this.searchSuggestions.classList.add('show');
        }
    }
    
    hideSuggestions() {
        this.searchSuggestions.classList.remove('show');
    }
    
    handleSuggestionClick(e) {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
            const searchTerm = suggestionItem.dataset.search;
            this.searchInput.value = searchTerm;
            this.searchClear.classList.add('show');
            this.hideSuggestions();
            this.performSearch(searchTerm);
        }
    }
    
    handleOutsideClick(e) {
        if (!e.target.closest('.search-wrapper')) {
            this.hideSuggestions();
        }
    }
    
    handleKeyboard(e) {
        if (e.key === 'Escape') {
            this.clearSearch();
            this.searchInput.blur();
        } else if (e.key === 'Enter') {
            const searchTerm = this.searchInput.value.trim();
            if (searchTerm.length >= 2) {
                this.performSearch(searchTerm);
                this.hideSuggestions();
            }
        }
    }
    
    handleGlobalKeyboard(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.searchInput.focus();
            this.showSuggestions();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && this.isSearching) {
            this.clearSearch();
        }
    }
    
    clearSearch() {
        this.searchInput.value = '';
        this.searchClear.classList.remove('show');
        this.hideSuggestions();
        
        // Remove search info
        const searchInfo = document.querySelector('.search-results-info');
        if (searchInfo) searchInfo.remove();
        
        // Show all streams
        this.displayAllStreams();
    }
    
    displayAllStreams() {
        if (this.allStreams.length > 0) {
            this.renderStreams(this.allStreams);
        } else {
            this.streamsContainer.innerHTML = `
                <div class="no-streams">
                    <i class="fas fa-futbol"></i>
                    <p>No hay transmisiones disponibles en este momento</p>
                    <p class="sub-text">¡Sé el primero en compartir una transmisión!</p>
                </div>
            `;
        }
    }
    
    showSearchLoading() {
        this.streamsContainer.innerHTML = `
            <div class="search-loading">
                <span>Buscando transmisiones...</span>
            </div>
        `;
    }
    
    copyStreamLink(link) {
        navigator.clipboard.writeText(link).then(() => {
            // Show copy success animation
            this.showToast('¡Link copiado al portapapeles!', 'success');
        }).catch(() => {
            this.showToast('Error al copiar el link', 'error');
        });
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
    
    updateStreams(streams) {
        this.allStreams = streams;
        if (!this.isSearching && this.searchInput.value.trim() === '') {
            this.displayAllStreams();
        }
    }
}

// Initialize search engine
const ultraSearch = new UltraSearchEngine();

// Variables globales
let currentFilter = 'all';
let streamsData = [];
let myStreamsData = [];
let searchQuery = '';
let favorites = JSON.parse(localStorage.getItem('ultragol_favorites') || '[]');
let isLoading = false;
let animationSpeed = 300;
let currentUser = null;
let isAuthenticated = false;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Configurar autenticación
    setupAuthentication();
    
    // Configurar eventos
    setupEventListeners();
    
    // Configurar modales de perfil
    setupProfileModals();
    
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
    const targetBtn = document.querySelector(`[data-section="${sectionName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// Manejar envío del formulario
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.submit-btn');
    // Verificar que el usuario esté autenticado
    if (!currentUser) {
        showNotification('Debes iniciar sesión para subir una transmisión', 'error');
        return;
    }
    
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
            createdAt: new Date().toISOString(),
            // Agregar información del usuario (requerido)
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Usuario',
            userAvatar: currentUser.photoURL || '',
            // Agregar imagen de portada si se subió
            portadaURL: formData.get('portada-url') || ''
        };
        
        // Validar URL de transmisión (más flexible para "otra plataforma")
        if (streamData.plataforma === 'otra') {
            // Para "otra plataforma", validar solo que sea una URL válida con HTTP/HTTPS
            if (!isValidURLBasic(streamData.link)) {
                throw new Error('Por favor ingresa una URL válida de transmisión');
            }
        } else {
            // Para plataformas conocidas, usar validación estricta
            if (!isValidStreamURL(streamData.link)) {
                throw new Error('Por favor ingresa una URL válida de transmisión');
            }
        }
        
        // Validar URL de imagen de portada si se proporciona
        if (streamData.portadaURL && !isValidImageURL(streamData.portadaURL)) {
            throw new Error('Por favor ingresa una URL válida de imagen para la portada');
        }
        
        // Guardar en Firebase
        await addDoc(collection(db, 'streams'), streamData);
        
        // Mostrar notificación de éxito
        showNotification('¡Transmisión publicada exitosamente!', 'success');
        
        // Limpiar formulario
        e.target.reset();
        
        // Cambiar a la sección de transmisiones
        showSection('transmisiones');
        
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

// Validar URL de transmisión de forma segura
function isValidStreamURL(string) {
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

// Validar URL de imagen de forma más flexible
function isValidImageURL(string) {
    if (!string || string.trim() === '') return false;
    try {
        const url = new URL(string);
        // Solo permitir HTTP y HTTPS
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        
        // Verificar que termine en una extensión de imagen o sea de un servicio conocido
        const path = url.pathname.toLowerCase();
        const isImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(path);
        
        // Dominios comunes de imágenes
        const imageHosts = [
            'imgur.com', 'i.imgur.com',
            'cloudinary.com', 'res.cloudinary.com',
            'unsplash.com', 'images.unsplash.com',
            'pexels.com', 'images.pexels.com',
            'pixabay.com', 'cdn.pixabay.com',
            'giphy.com', 'media.giphy.com',
            'googleapis.com', 'googleusercontent.com',
            'amazonaws.com', 's3.amazonaws.com',
            'github.com', 'raw.githubusercontent.com',
            'wikimedia.org', 'upload.wikimedia.org'
        ];
        
        const hostname = url.hostname.toLowerCase();
        const isKnownImageHost = imageHosts.some(domain => hostname === domain || hostname.endsWith('.' + domain));
        
        return isImageExtension || isKnownImageHost;
    } catch (_) {
        return false;
    }
}

// Validación básica de URL para cualquier dominio
function isValidURLBasic(string) {
    try {
        const url = new URL(string);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

// Función de compatibilidad para isValidURL (mantener para el código existente)
function isValidURL(string) {
    return isValidStreamURL(string);
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
    
    // Agregar efectos de hover
    addCardHoverEffects();
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

// Crear tarjeta de transmisión PREMIUM GAMING STYLE
function createStreamCardSafe(stream) {
    const card = document.createElement('div');
    card.className = 'stream-card';
    card.setAttribute('data-platform', sanitizeAttribute(stream.plataforma));
    
    // ========== HEADER PREMIUM con glassmorphism ==========
    const header = document.createElement('div');
    header.className = 'stream-card-header';
    
    // Título de equipos con emoji de balón animado
    const teams = document.createElement('div');
    teams.className = 'stream-teams';
    teams.textContent = sanitizeText(stream.equipos);
    
    // Meta badges con animaciones
    const meta = document.createElement('div');
    meta.className = 'stream-meta';
    
    // Badge EN VIVO con pulso
    const liveBadge = document.createElement('span');
    liveBadge.className = 'stream-badge live';
    liveBadge.textContent = 'EN VIVO';
    
    // Badge de plataforma con gradiente
    const platformBadge = document.createElement('span');
    platformBadge.className = 'stream-badge platform-badge';
    const plataformaDisplay = stream.plataforma === 'otra' ? stream.otraPlataforma : stream.plataforma;
    platformBadge.textContent = sanitizeText(plataformaDisplay).toUpperCase();
    
    // Badge de calidad con efectos
    const qualityBadge = document.createElement('span');
    qualityBadge.className = 'stream-badge quality-badge';
    qualityBadge.textContent = stream.calidad.toUpperCase();
    
    meta.appendChild(liveBadge);
    meta.appendChild(platformBadge);
    meta.appendChild(qualityBadge);
    
    header.appendChild(teams);
    header.appendChild(meta);
    
    // ========== BODY PREMIUM con efectos ==========
    const body = document.createElement('div');
    body.className = 'stream-card-body';
    
    // Info grid moderna
    const info = document.createElement('div');
    info.className = 'stream-info';
    
    // Info items con hover effects
    const infoItems = [
        { icon: 'fas fa-trophy', text: stream.liga === 'otra-liga' ? stream.otraLiga : stream.liga },
        { icon: getTiempoPartidoIcon(stream.tiempoPartido), text: getTiempoPartidoDisplay(stream.tiempoPartido) },
        { icon: 'fas fa-language', text: stream.idioma.toUpperCase() },
        { icon: 'fas fa-user-circle', text: sanitizeText(stream.userName || 'Usuario') }
    ];
    
    if (stream.comentarios) {
        infoItems.push({ icon: 'fas fa-microphone', text: 'CON COMENTARIOS' });
    }
    
    infoItems.forEach(item => {
        const infoItem = document.createElement('div');
        infoItem.className = 'info-item';
        
        const icon = document.createElement('i');
        icon.className = item.icon;
        
        const span = document.createElement('span');
        span.textContent = sanitizeText(item.text);
        
        infoItem.appendChild(icon);
        infoItem.appendChild(span);
        info.appendChild(infoItem);
    });
    
    // ========== ACTIONS PREMIUM con botones gaming ==========
    const actions = document.createElement('div');
    actions.className = 'stream-actions';
    
    // Botón principal VER TRANSMISIÓN
    const viewBtn = document.createElement('button');
    viewBtn.className = 'action-btn primary';
    viewBtn.innerHTML = '<i class="fas fa-play"></i> VER TRANSMISIÓN';
    viewBtn.onclick = () => {
        const link = stream.plataforma === 'otra' ? 
            (isValidURLBasic(stream.link) ? stream.link : '#') : 
            sanitizeURL(stream.link);
        if (link && link !== '#') {
            window.open(link, '_blank', 'noopener,noreferrer');
        }
    };
    
    // Botón secundario FAVORITOS
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'action-btn';
    favoriteBtn.innerHTML = '<i class="fas fa-heart"></i> FAVORITO';
    favoriteBtn.onclick = () => toggleFavorite(stream.id);
    
    // Botón COMPARTIR
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.innerHTML = '<i class="fas fa-share"></i> COMPARTIR';
    shareBtn.onclick = () => shareStream(stream);
    
    actions.appendChild(viewBtn);
    actions.appendChild(favoriteBtn);
    actions.appendChild(shareBtn);
    
    // ========== TIMER PREMIUM ==========
    const timerContainer = document.createElement('div');
    timerContainer.className = 'info-item';
    timerContainer.style.marginTop = 'var(--space-lg)';
    timerContainer.style.justifyContent = 'center';
    timerContainer.style.background = 'rgba(0, 255, 65, 0.1)';
    timerContainer.style.borderColor = 'rgba(0, 255, 65, 0.3)';
    
    const timerIcon = document.createElement('i');
    timerIcon.className = 'fas fa-clock';
    timerIcon.style.color = 'var(--accent-green)';
    
    const timerSpan = document.createElement('span');
    timerSpan.id = `timer-${stream.id}`;
    timerSpan.textContent = 'Cargando tiempo...';
    timerSpan.style.color = 'var(--accent-green)';
    timerSpan.style.fontWeight = '600';
    
    timerContainer.appendChild(timerIcon);
    timerContainer.appendChild(timerSpan);
    
    // ========== USER INFO PREMIUM ==========
    const userInfo = document.createElement('div');
    userInfo.className = 'info-item';
    userInfo.style.marginTop = 'var(--space-md)';
    userInfo.style.background = 'rgba(255, 107, 0, 0.1)';
    userInfo.style.borderColor = 'rgba(255, 107, 0, 0.3)';
    
    const userIcon = document.createElement('i');
    userIcon.className = 'fas fa-user-circle';
    userIcon.style.color = 'var(--accent-orange)';
    
    const userText = document.createElement('span');
    userText.textContent = `Subido por: ${sanitizeText(stream.userName || 'Usuario')}`;
    userText.style.color = 'var(--accent-orange)';
    
    userInfo.appendChild(userIcon);
    userInfo.appendChild(userText);
    
    // ========== RATING SECTION PREMIUM ==========
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'info-item';
    ratingContainer.style.marginTop = 'var(--space-md)';
    ratingContainer.style.background = 'rgba(255, 255, 255, 0.05)';
    ratingContainer.style.flexDirection = 'column';
    ratingContainer.style.alignItems = 'center';
    ratingContainer.style.gap = 'var(--space-sm)';
    
    const ratingTitle = document.createElement('span');
    ratingTitle.textContent = 'Calificación:';
    ratingTitle.style.fontSize = 'var(--text-xs)';
    ratingTitle.style.color = 'var(--text-muted)';
    
    const ratingStars = document.createElement('div');
    ratingStars.className = 'rating-stars';
    ratingStars.style.display = 'flex';
    ratingStars.style.gap = '4px';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'fas fa-star';
        star.style.color = '#ffd700';
        star.style.cursor = 'pointer';
        star.style.transition = 'all 0.2s ease';
        star.onclick = () => rateStream(stream.id, i);
        star.onmouseover = () => {
            star.style.transform = 'scale(1.2)';
            star.style.filter = 'drop-shadow(0 0 5px #ffd700)';
        };
        star.onmouseout = () => {
            star.style.transform = 'scale(1)';
            star.style.filter = 'none';
        };
        ratingStars.appendChild(star);
    }
    
    const ratingCount = document.createElement('span');
    ratingCount.textContent = '(0.0/5 - 0 votos)';
    ratingCount.style.fontSize = 'var(--text-xs)';
    ratingCount.style.color = 'var(--text-muted)';
    
    ratingContainer.appendChild(ratingTitle);
    ratingContainer.appendChild(ratingStars);
    ratingContainer.appendChild(ratingCount);
    
    // ========== COMMENTS BUTTON PREMIUM ==========
    const commentsBtn = document.createElement('button');
    commentsBtn.className = 'action-btn';
    commentsBtn.style.marginTop = 'var(--space-lg)';
    commentsBtn.style.width = '100%';
    commentsBtn.innerHTML = '<i class="fas fa-comments"></i> VER COMENTARIOS';
    commentsBtn.onclick = () => toggleComments(stream.id);
    
    // ========== ENSAMBLAR TARJETA PREMIUM ==========
    body.appendChild(info);
    body.appendChild(actions);
    body.appendChild(timerContainer);
    body.appendChild(userInfo);
    body.appendChild(ratingContainer);
    body.appendChild(commentsBtn);
    
    card.appendChild(header);
    card.appendChild(body);
    
    // Agregar efectos especiales según plataforma
    card.classList.add(`platform-${stream.plataforma}`);
    
    // Configurar timer si existe la función
    if (typeof updateTimeRemaining === 'function' && stream.createdAt) {
        setTimeout(() => updateTimeRemaining(stream.id, stream.createdAt), 100);
    }
    
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

// Actualizar tiempo restante CORREGIDO para nuevas tarjetas premium
function updateTimeRemaining(streamId, createdAt) {
    const timerElement = document.getElementById(`timer-${streamId}`);
    if (!timerElement) return;
    
    const updateTimer = () => {
        const now = new Date();
        const created = new Date(createdAt);
        const elapsed = now - created;
        const remaining = (1 * 60 * 60 * 1000) - elapsed; // 1 hora en ms
        
        if (remaining <= 0) {
            timerElement.textContent = '⏰ Expirado';
            const timerContainer = timerElement.closest('.info-item');
            if (timerContainer) {
                timerContainer.style.background = 'rgba(255, 68, 68, 0.2)';
                timerContainer.style.borderColor = 'rgba(255, 68, 68, 0.5)';
                timerContainer.style.color = '#ff4444';
            }
            
            // Eliminar transmisión expirada
            deleteExpiredStream(streamId);
            return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        timerElement.textContent = `⏱️ ${hours}h ${minutes}m ${seconds}s restantes`;
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

// ========== FUNCIONES PREMIUM PARA NUEVAS TARJETAS ==========


// Actualizar botones de favoritos
function updateFavoriteButtons() {
    const favoritesKey = 'ultragol_favorites';
    const favorites = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    
    document.querySelectorAll('.action-btn').forEach(btn => {
        if (btn.innerHTML.includes('FAVORITO')) {
            const card = btn.closest('.stream-card');
            const streamId = card?.querySelector('[id^="timer-"]')?.id?.replace('timer-', '');
            
            if (streamId && favorites.includes(streamId)) {
                btn.innerHTML = '<i class="fas fa-heart" style="color: #ff6b6b;"></i> FAVORITO';
                btn.style.background = 'rgba(255, 107, 107, 0.2)';
                btn.style.borderColor = 'rgba(255, 107, 107, 0.5)';
            } else {
                btn.innerHTML = '<i class="fas fa-heart"></i> FAVORITO';
                btn.style.background = 'rgba(0, 0, 0, 0.4)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        }
    });
}

// Compartir stream
function shareStream(stream) {
    const shareData = {
        title: `⚽ ${stream.equipos} - ULTRAGOL`,
        text: `¡Mira este partido en vivo! ${stream.equipos} en ${stream.plataforma.toUpperCase()}`,
        url: window.location.href
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            fallbackShare(stream);
        });
    } else {
        fallbackShare(stream);
    }
}

// Compartir fallback (copiar al portapapeles)
function fallbackShare(stream) {
    const shareText = `⚽ ${stream.equipos} - En vivo en ${stream.plataforma.toUpperCase()}\n🔗 ${window.location.href}`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            showNotification('🔗 Enlace copiado al portapapeles', 'success');
        }).catch(() => {
            showNotification('❌ Error al copiar enlace', 'error');
        });
    } else {
        // Fallback para navegadores sin clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('🔗 Enlace copiado al portapapeles', 'success');
        } catch (err) {
            showNotification('❌ Error al copiar enlace', 'error');
        }
        document.body.removeChild(textArea);
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
    const targetBtn = document.querySelector(`[data-platform="${platform}"]`);
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

// ======================== FUNCIONES DE AUTENTICACIÓN ========================

// Configurar autenticación
function setupAuthentication() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Event listeners para autenticación
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Monitorear cambios en el estado de autenticación
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            isAuthenticated = true;
            showUserInfo(user);
            loadMyStreams();
        } else {
            currentUser = null;
            isAuthenticated = false;
            hideUserInfo();
        }
        updateUIForAuthState();
    });
}

// Manejar inicio de sesión
async function handleLogin() {
    const loginBtn = document.getElementById('login-btn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
    
    try {
        const result = await signInWithGoogle();
        showNotification('¡Bienvenido! Has iniciado sesión exitosamente', 'success');
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        const domainError = handleAuthDomain(error);
        
        if (domainError.isError) {
            showNotification(domainError.message, 'error');
            showAuthDomainHelp();
        } else {
            showNotification('Error al iniciar sesión: ' + error.message, 'error');
        }
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fab fa-google"></i> Iniciar Sesión';
    }
}

// Manejar cierre de sesión
async function handleLogout() {
    try {
        await signOutUser();
        showNotification('Has cerrado sesión exitosamente', 'success');
        showSection('transmisiones');
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión: ' + error.message, 'error');
    }
}

// Mostrar información del usuario
function showUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const loginBtn = document.getElementById('login-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const misStreamsBtn = document.querySelector('[data-section="mis-streams"]');
    const perfilBtn = document.querySelector('[data-section="perfil"]');
    
    userAvatar.src = user.photoURL || 'https://via.placeholder.com/40x40?text=U';
    userName.textContent = user.displayName || user.email;
    
    userInfo.style.display = 'flex';
    loginBtn.style.display = 'none';
    misStreamsBtn.style.display = 'block';
    perfilBtn.style.display = 'block';
}

// Ocultar información del usuario
function hideUserInfo() {
    const userInfo = document.getElementById('user-info');
    const loginBtn = document.getElementById('login-btn');
    const misStreamsBtn = document.querySelector('[data-section="mis-streams"]');
    const perfilBtn = document.querySelector('[data-section="perfil"]');
    
    userInfo.style.display = 'none';
    loginBtn.style.display = 'block';
    misStreamsBtn.style.display = 'none';
    perfilBtn.style.display = 'none';
}

// Actualizar UI según estado de autenticación
function updateUIForAuthState() {
    const submitBtn = document.querySelector('.submit-btn');
    const streamForm = document.getElementById('stream-form');
    const authWarning = document.getElementById('auth-warning');
    
    if (isAuthenticated) {
        submitBtn.disabled = false;
        streamForm.style.opacity = '1';
        if (authWarning) authWarning.style.display = 'none';
    } else {
        submitBtn.disabled = true;
        streamForm.style.opacity = '0.6';
        if (!authWarning) {
            createAuthWarning();
        } else {
            authWarning.style.display = 'block';
        }
    }
}

// Crear aviso de autenticación
function createAuthWarning() {
    const warning = document.createElement('div');
    warning.id = 'auth-warning';
    warning.className = 'auth-warning modern-notification';
    warning.innerHTML = `
        <i class="fas fa-lock"></i>
        <span>Debes iniciar sesión para subir transmisiones</span>
    `;
    
    const form = document.getElementById('stream-form');
    form.parentNode.insertBefore(warning, form);
}

// Cargar streams del usuario
async function loadMyStreams() {
    if (!currentUser) return;
    
    try {
        const q = query(
            collection(db, 'streams'),
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
        );
        
        onSnapshot(q, (querySnapshot) => {
            myStreamsData = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                myStreamsData.push(data);
            });
            
            displayMyStreams(myStreamsData);
        }, (error) => {
            console.error('Error al cargar mis streams:', error);
        });
        
    } catch (error) {
        console.error('Error al configurar listener de mis streams:', error);
    }
}

// Mostrar mis streams
function displayMyStreams(streams) {
    const container = document.getElementById('my-streams-container');
    container.innerHTML = '';
    
    if (streams.length === 0) {
        const noStreamsDiv = createNoStreamsElement('mis-streams');
        container.appendChild(noStreamsDiv);
        return;
    }
    
    streams.forEach((stream, index) => {
        const card = createStreamCardWithDelete(stream);
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add('fade-in-up');
        container.appendChild(card);
        
        if (stream.id) {
            updateTimeRemaining(stream.id, stream.createdAt);
        }
    });
}

// Crear tarjeta de stream con opción de eliminar
function createStreamCardWithDelete(stream) {
    const card = createStreamCardSafe(stream);
    
    // Agregar botón de eliminar solo para streams del usuario
    if (currentUser && stream.userId === currentUser.uid) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn modern-btn danger-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        deleteBtn.title = 'Eliminar esta transmisión';
        
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('¿Estás seguro de que quieres eliminar esta transmisión?')) {
                await deleteStream(stream.id);
            }
        });
        
        const actions = card.querySelector('.stream-actions');
        actions.appendChild(deleteBtn);
    }
    
    return card;
}

// Eliminar stream
async function deleteStream(streamId) {
    try {
        await deleteDoc(doc(db, 'streams', streamId));
        showNotification('Transmisión eliminada exitosamente', 'success');
    } catch (error) {
        console.error('Error al eliminar stream:', error);
        showNotification('Error al eliminar la transmisión: ' + error.message, 'error');
    }
}

// ======================== FUNCIONES DE CALIFICACIONES Y COMENTARIOS ========================

// Crear sección de calificaciones
function createRatingSection(stream) {
    const ratingDiv = document.createElement('div');
    ratingDiv.className = 'stream-rating';
    
    const ratingLabel = document.createElement('span');
    ratingLabel.className = 'rating-label';
    ratingLabel.textContent = 'Calificación:';
    
    const starsContainer = document.createElement('div');
    starsContainer.className = 'rating-stars';
    starsContainer.setAttribute('data-stream-id', stream.id);
    
    // Crear 5 estrellas
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'fas fa-star rating-star';
        star.setAttribute('data-rating', i);
        star.addEventListener('click', () => rateStream(stream.id, i));
        starsContainer.appendChild(star);
    }
    
    const avgRating = stream.avgRating || 0;
    const ratingCount = stream.ratingCount || 0;
    
    // Mostrar estrellas según la calificación promedio
    updateStarsDisplay(starsContainer, avgRating);
    
    const ratingInfo = document.createElement('span');
    ratingInfo.className = 'rating-info';
    ratingInfo.textContent = `(${avgRating.toFixed(1)}/5 - ${ratingCount} votos)`;
    
    ratingDiv.appendChild(ratingLabel);
    ratingDiv.appendChild(starsContainer);
    ratingDiv.appendChild(ratingInfo);
    
    return ratingDiv;
}

// Crear botón de comentarios
function createCommentsButton(stream) {
    const commentsBtn = document.createElement('button');
    commentsBtn.className = 'comments-btn modern-btn';
    commentsBtn.innerHTML = '<i class="fas fa-comments"></i> Ver Comentarios';
    commentsBtn.setAttribute('data-stream-id', stream.id);
    
    const commentCount = stream.commentCount || 0;
    if (commentCount > 0) {
        commentsBtn.innerHTML = `<i class="fas fa-comments"></i> Ver Comentarios (${commentCount})`;
    }
    
    commentsBtn.addEventListener('click', () => toggleComments(stream.id));
    
    return commentsBtn;
}

// Crear sección de comentarios
function createCommentsSection(stream) {
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    commentsSection.id = `comments-${stream.id}`;
    commentsSection.style.display = 'none';
    
    const commentsHeader = document.createElement('div');
    commentsHeader.className = 'comments-header';
    commentsHeader.innerHTML = '<h4><i class="fas fa-comments"></i> Comentarios</h4>';
    
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';
    commentsList.id = `comments-list-${stream.id}`;
    
    const addCommentForm = document.createElement('div');
    addCommentForm.className = 'add-comment-form';
    
    if (currentUser) {
        addCommentForm.innerHTML = `
            <div class="comment-input-group">
                <textarea id="comment-input-${stream.id}" placeholder="Escribe tu comentario..." rows="3"></textarea>
                <button onclick="addComment('${stream.id}')" class="submit-btn comment-submit-btn">
                    <i class="fas fa-paper-plane"></i> Comentar
                </button>
            </div>
        `;
    } else {
        addCommentForm.innerHTML = `
            <div class="comment-auth-notice">
                <i class="fas fa-lock"></i>
                <span>Inicia sesión para comentar</span>
            </div>
        `;
    }
    
    commentsSection.appendChild(commentsHeader);
    commentsSection.appendChild(commentsList);
    commentsSection.appendChild(addCommentForm);
    
    return commentsSection;
}

// Calificar transmisión
async function rateStream(streamId, rating) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para calificar', 'error');
        return;
    }
    
    try {
        // Guardar calificación en Firestore usando estructura anidada
        const ratingRef = doc(db, `streams/${streamId}/ratings/${currentUser.uid}`);
        await setDoc(ratingRef, {
            streamId: streamId,
            userId: currentUser.uid,
            rating: rating,
            timestamp: serverTimestamp()
        });
        
        showNotification('¡Calificación guardada!', 'success');
        
        // Actualizar visualización
        updateStreamRating(streamId);
        
    } catch (error) {
        console.error('Error al calificar:', error);
        showNotification('Error al guardar la calificación', 'error');
    }
}

// Actualizar calificación de transmisión
async function updateStreamRating(streamId) {
    try {
        // Usar nueva estructura anidada para calificaciones
        const ratingsRef = collection(db, `streams/${streamId}/ratings`);
        const ratingsSnapshot = await getDocs(ratingsRef);
        
        let totalRating = 0;
        let count = 0;
        
        ratingsSnapshot.forEach((doc) => {
            totalRating += doc.data().rating;
            count++;
        });
        
        const avgRating = count > 0 ? totalRating / count : 0;
        
        // Actualizar la visualización en la UI
        const starsContainer = document.querySelector(`[data-stream-id="${streamId}"]`);
        if (starsContainer) {
            updateStarsDisplay(starsContainer, avgRating);
            
            const ratingInfo = starsContainer.parentNode.querySelector('.rating-info');
            if (ratingInfo) {
                ratingInfo.textContent = `(${avgRating.toFixed(1)}/5 - ${count} votos)`;
            }
        }
        
    } catch (error) {
        console.error('Error al actualizar calificación:', error);
    }
}

// Actualizar visualización de estrellas
function updateStarsDisplay(starsContainer, rating) {
    const stars = starsContainer.querySelectorAll('.rating-star');
    
    stars.forEach((star, index) => {
        const starRating = index + 1;
        
        if (starRating <= Math.floor(rating)) {
            star.className = 'fas fa-star rating-star filled';
        } else if (starRating === Math.ceil(rating) && rating % 1 !== 0) {
            star.className = 'fas fa-star-half-alt rating-star half-filled';
        } else {
            star.className = 'far fa-star rating-star empty';
        }
    });
}

// Alternar vista de comentarios
function toggleComments(streamId) {
    const commentsSection = document.getElementById(`comments-${streamId}`);
    
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        loadComments(streamId);
    } else {
        commentsSection.style.display = 'none';
    }
}

// Cargar comentarios
async function loadComments(streamId) {
    try {
        const commentsQuery = query(
            collection(db, 'comments'),
            where('streamId', '==', streamId),
            orderBy('timestamp', 'desc')
        );
        
        const commentsSnapshot = await getDocs(commentsQuery);
        const commentsList = document.getElementById(`comments-list-${streamId}`);
        
        commentsList.innerHTML = '';
        
        if (commentsSnapshot.empty) {
            commentsList.innerHTML = '<div class="no-comments">No hay comentarios aún. ¡Sé el primero en comentar!</div>';
            return;
        }
        
        commentsSnapshot.forEach((doc) => {
            const comment = doc.data();
            const commentElement = createCommentElement(comment);
            commentsList.appendChild(commentElement);
        });
        
    } catch (error) {
        console.error('Error al cargar comentarios:', error);
    }
}

// Crear elemento de comentario
function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    
    const timeAgo = getTimeAgo(comment.timestamp?.toDate() || new Date(comment.createdAt));
    
    commentDiv.innerHTML = `
        <div class="comment-header">
            <div class="comment-user">
                ${comment.userAvatar ? 
                    `<img src="${sanitizeURL(comment.userAvatar, 'image')}" class="comment-avatar" alt="Avatar">` :
                    '<i class="fas fa-user-circle comment-avatar-icon"></i>'
                }
                <span class="comment-username">${sanitizeText(comment.userName)}</span>
            </div>
            <span class="comment-time">${timeAgo}</span>
        </div>
        <div class="comment-content">
            ${sanitizeText(comment.content)}
        </div>
    `;
    
    return commentDiv;
}

// Agregar comentario
async function addComment(streamId) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para comentar', 'error');
        return;
    }
    
    const commentInput = document.getElementById(`comment-input-${streamId}`);
    const content = commentInput.value.trim();
    
    if (!content) {
        showNotification('El comentario no puede estar vacío', 'error');
        return;
    }
    
    try {
        await addDoc(collection(db, 'comments'), {
            streamId: streamId,
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Usuario',
            userAvatar: currentUser.photoURL || '',
            content: content,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        });
        
        commentInput.value = '';
        showNotification('¡Comentario agregado!', 'success');
        
        // Recargar comentarios
        loadComments(streamId);
        
    } catch (error) {
        console.error('Error al agregar comentario:', error);
        showNotification('Error al agregar el comentario', 'error');
    }
}

// Obtener tiempo relativo
function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'hace un momento';
    if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} h`;
    return `hace ${Math.floor(diffInSeconds / 86400)} días`;
}

// ======================== FUNCIONES DE PERFIL DE USUARIO ========================

// Mostrar sección de perfil
function showProfileSection() {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para ver tu perfil', 'error');
        return;
    }
    
    loadUserProfile();
    showSection('perfil');
}

// Cargar perfil de usuario
async function loadUserProfile() {
    if (!currentUser) return;
    
    try {
        // Actualizar información básica
        document.getElementById('profile-username-display').textContent = currentUser.displayName || 'Usuario';
        document.getElementById('profile-email-display').textContent = currentUser.email || '';
        
        const avatarDisplay = document.getElementById('profile-avatar-display');
        avatarDisplay.src = currentUser.photoURL || 'https://via.placeholder.com/120x120?text=U';
        
        // Cargar estadísticas
        await loadUserStats();
        
        // Cargar transmisiones recientes
        await loadRecentStreams();
        
    } catch (error) {
        console.error('Error al cargar perfil:', error);
    }
}

// Cargar estadísticas del usuario
async function loadUserStats() {
    try {
        // Contar transmisiones
        const streamsQuery = query(
            collection(db, 'streams'),
            where('userId', '==', currentUser.uid)
        );
        const streamsSnapshot = await getDocs(streamsQuery);
        const totalStreams = streamsSnapshot.size;
        
        // Calcular calificación promedio de todas las transmisiones del usuario
        let totalRating = 0;
        let ratingCount = 0;
        
        for (const streamDoc of streamsSnapshot.docs) {
            const ratingsRef = collection(db, `streams/${streamDoc.id}/ratings`);
            const ratingsSnapshot = await getDocs(ratingsRef);
            
            ratingsSnapshot.forEach((doc) => {
                totalRating += doc.data().rating;
                ratingCount++;
            });
        }
        
        const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
        
        // Contar comentarios recibidos (evitar limitación de "in" operator)
        let totalComments = 0;
        for (const streamDoc of streamsSnapshot.docs) {
            const commentsQuery = query(
                collection(db, 'comments'),
                where('streamId', '==', streamDoc.id)
            );
            const commentsSnapshot = await getDocs(commentsQuery);
            totalComments += commentsSnapshot.size;
        }
        
        // Actualizar UI
        document.getElementById('total-streams').textContent = totalStreams;
        document.getElementById('average-rating').textContent = averageRating.toFixed(1);
        document.getElementById('total-comments').textContent = totalComments;
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Cargar transmisiones recientes
async function loadRecentStreams() {
    try {
        const recentQuery = query(
            collection(db, 'streams'),
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc'),
            limit(5)
        );
        
        const recentSnapshot = await getDocs(recentQuery);
        const recentList = document.getElementById('recent-streams-list');
        
        recentList.innerHTML = '';
        
        if (recentSnapshot.empty) {
            recentList.innerHTML = '<div class="no-recent">No tienes transmisiones recientes</div>';
            return;
        }
        
        recentSnapshot.forEach((doc) => {
            const stream = doc.data();
            const streamElement = createRecentStreamElement(stream);
            recentList.appendChild(streamElement);
        });
        
    } catch (error) {
        console.error('Error al cargar transmisiones recientes:', error);
    }
}

// Crear elemento de transmisión reciente
function createRecentStreamElement(stream) {
    const div = document.createElement('div');
    div.className = 'recent-stream-item';
    
    const timeAgo = getTimeAgo(stream.timestamp?.toDate() || new Date(stream.createdAt));
    
    div.innerHTML = `
        <div class="recent-stream-info">
            <div class="recent-stream-title">${sanitizeText(stream.equipos)}</div>
            <div class="recent-stream-details">
                <span class="recent-stream-platform">${sanitizeText(stream.plataforma)}</span>
                <span class="recent-stream-time">${timeAgo}</span>
            </div>
        </div>
    `;
    
    return div;
}

// Configurar modales de perfil
function setupProfileModals() {
    // Modal de avatar
    const editAvatarBtn = document.getElementById('edit-avatar-btn');
    const avatarModal = document.getElementById('avatar-modal');
    const closeAvatarModal = document.getElementById('close-avatar-modal');
    const avatarForm = document.getElementById('avatar-form');
    
    // Modal de username
    const editUsernameBtn = document.getElementById('edit-username-btn');
    const usernameModal = document.getElementById('username-modal');
    const closeUsernameModal = document.getElementById('close-username-modal');
    const usernameForm = document.getElementById('username-form');
    
    // Event listeners para abrir modales
    if (editAvatarBtn) {
        editAvatarBtn.addEventListener('click', () => {
            avatarModal.style.display = 'block';
        });
    }
    
    if (editUsernameBtn) {
        editUsernameBtn.addEventListener('click', () => {
            const currentName = currentUser?.displayName || '';
            document.getElementById('new-username').value = currentName;
            usernameModal.style.display = 'block';
        });
    }
    
    // Event listeners para cerrar modales
    if (closeAvatarModal) {
        closeAvatarModal.addEventListener('click', () => {
            avatarModal.style.display = 'none';
        });
    }
    
    if (closeUsernameModal) {
        closeUsernameModal.addEventListener('click', () => {
            usernameModal.style.display = 'none';
        });
    }
    
    // Cerrar modales al hacer click fuera
    window.addEventListener('click', (e) => {
        if (e.target === avatarModal) {
            avatarModal.style.display = 'none';
        }
        if (e.target === usernameModal) {
            usernameModal.style.display = 'none';
        }
    });
    
    // Formularios
    if (avatarForm) {
        avatarForm.addEventListener('submit', handleAvatarUpdate);
    }
    
    if (usernameForm) {
        usernameForm.addEventListener('submit', handleUsernameUpdate);
    }
}

// Manejar actualización de avatar
async function handleAvatarUpdate(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }
    
    const avatarUrl = document.getElementById('avatar-url').value.trim();
    
    if (!avatarUrl) {
        showNotification('Por favor ingresa una URL válida', 'error');
        return;
    }
    
    if (!isValidImageURL(avatarUrl)) {
        showNotification('Por favor ingresa una URL válida de imagen', 'error');
        return;
    }
    
    try {
        // Guardar en Firestore usando el userId como document ID
        const profileRef = doc(db, `userProfiles/${currentUser.uid}`);
        await setDoc(profileRef, {
            userId: currentUser.uid,
            photoURL: avatarUrl,
            timestamp: serverTimestamp()
        }, { merge: true });
        
        // Actualizar UI localmente
        const profileAvatar = document.getElementById('profile-avatar-display');
        const userAvatar = document.getElementById('user-avatar');
        
        profileAvatar.src = avatarUrl;
        userAvatar.src = avatarUrl;
        
        // Cerrar modal
        document.getElementById('avatar-modal').style.display = 'none';
        document.getElementById('avatar-form').reset();
        
        showNotification('¡Foto de perfil actualizada!', 'success');
        
    } catch (error) {
        console.error('Error al actualizar avatar:', error);
        showNotification('Error al actualizar la foto de perfil', 'error');
    }
}

// Manejar actualización de nombre de usuario
async function handleUsernameUpdate(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Debes iniciar sesión', 'error');
        return;
    }
    
    const newUsername = document.getElementById('new-username').value.trim();
    
    if (!newUsername) {
        showNotification('El nombre no puede estar vacío', 'error');
        return;
    }
    
    if (newUsername.length < 2 || newUsername.length > 50) {
        showNotification('El nombre debe tener entre 2 y 50 caracteres', 'error');
        return;
    }
    
    try {
        // Guardar en Firestore usando el userId como document ID
        const profileRef = doc(db, `userProfiles/${currentUser.uid}`);
        await setDoc(profileRef, {
            userId: currentUser.uid,
            displayName: newUsername,
            timestamp: serverTimestamp()
        }, { merge: true });
        
        // Actualizar UI localmente
        const profileUsername = document.getElementById('profile-username-display');
        const userNameHeader = document.getElementById('user-name');
        
        profileUsername.textContent = newUsername;
        userNameHeader.textContent = newUsername;
        
        // Cerrar modal
        document.getElementById('username-modal').style.display = 'none';
        document.getElementById('username-form').reset();
        
        showNotification('¡Nombre de usuario actualizado!', 'success');
        
    } catch (error) {
        console.error('Error al actualizar nombre:', error);
        showNotification('Error al actualizar el nombre de usuario', 'error');
    }
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

// Sanitizar URL (mejorado para diferentes tipos)
function sanitizeURL(url, type = 'stream') {
    if (!url || url.trim() === '') return '#';
    
    if (type === 'image') {
        return isValidImageURL(url) ? url : '#';
    } else {
        return isValidStreamURL(url) ? url : '#';
    }
}

// Sanitizar atributos
function sanitizeAttribute(attr) {
    if (typeof attr !== 'string') return '';
    return attr.replace(/['"<>&]/g, '');
}

// ======================== FUNCIONES DE FILTRADO Y BÚSQUEDA ========================

// Crear elemento de "no hay streams" personalizado
function createNoStreamsElement(section = 'general') {
    const div = document.createElement('div');
    div.className = 'no-streams modern-empty-state';
    
    const icon = document.createElement('i');
    const title = document.createElement('p');
    const subtitle = document.createElement('p');
    subtitle.className = 'sub-text';
    
    if (section === 'mis-streams') {
        icon.className = 'fas fa-broadcast-tower';
        title.textContent = 'No has subido ninguna transmisión aún';
        subtitle.textContent = '¡Comparte tu primera transmisión!';
    } else {
        icon.className = 'fas fa-futbol';
        title.textContent = 'No hay transmisiones disponibles en este momento';
        subtitle.textContent = '¡Sé el primero en compartir una transmisión!';
    }
    
    div.appendChild(icon);
    div.appendChild(title);
    div.appendChild(subtitle);
    
    return div;
}

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
        shareStreamFunction(stream);
    });
    
    return btn;
}

// Compartir transmisión
async function shareStreamFunction(stream) {
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

// ======================== FUNCIONES DE AUTENTICACIÓN MEJORADAS ========================

// Mostrar ayuda para problema de dominio auth
function showAuthDomainHelp() {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'auth-domain-help modern-notification warning';
    helpDiv.innerHTML = `
        <div class="help-content">
            <i class="fas fa-info-circle"></i>
            <div>
                <h4>Configuración requerida</h4>
                <p>Para habilitar el login, agrega este dominio en Firebase Console:</p>
                <code>${window.location.hostname}</code>
                <p><small>Authentication → Settings → Authorized domains</small></p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="close-help">×</button>
        </div>
    `;
    
    document.body.appendChild(helpDiv);
    
    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
        if (helpDiv.parentNode) {
            helpDiv.classList.add('fade-out');
            setTimeout(() => helpDiv.remove(), 300);
        }
    }, 10000);
}

// Agregar efectos hover a las tarjetas
function addCardHoverEffects() {
    const cards = document.querySelectorAll('.stream-card:not(.skeleton-card)');
    
    cards.forEach(card => {
        // Remover listeners anteriores
        card.removeEventListener('mouseenter', cardHoverIn);
        card.removeEventListener('mouseleave', cardHoverOut);
        
        // Agregar nuevos listeners
        card.addEventListener('mouseenter', cardHoverIn);
        card.addEventListener('mouseleave', cardHoverOut);
    });
}

// Función de hover in
function cardHoverIn() {
    this.style.transform = 'translateY(-10px) scale(1.02)';
    this.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)';
    this.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
}

// Función de hover out
function cardHoverOut() {
    this.style.transform = 'translateY(0) scale(1)';
    this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
    this.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
}


// ======================== EVENT HANDLERS SEGUROS ========================

// Configurar navegación sin onclick inline
function setupNavigationEvents() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        const sectionName = btn.getAttribute('data-section');
        if (sectionName) {
            btn.addEventListener('click', () => {
                if (sectionName === 'perfil') {
                    showProfileSection();
                } else {
                    showSection(sectionName);
                }
            });
        }
    });
}

// Configurar filtros sin onclick inline
function setupFilterEvents() {
    const filterBtns = document.querySelectorAll('.filter-btn:not(.favorites-btn)');
    filterBtns.forEach(btn => {
        const platform = btn.getAttribute('data-platform');
        if (platform && platform !== 'favoritos') {
            btn.addEventListener('click', () => filterStreams(platform));
        }
    });
}

// Hacer funciones globales para compatibilidad
window.showSection = showSection;
window.filterStreams = filterStreams;

// ======================== LIVE STREAM IFRAME CONTROLS ========================

// Función para pantalla completa del iframe
function toggleFullscreen() {
    const iframe = document.querySelector('.iframe-container iframe');
    const container = document.querySelector('.iframe-container');
    
    if (iframe && container) {
        try {
            if (!document.fullscreenElement) {
                container.requestFullscreen().then(() => {
                    updateFullscreenButton(true);
                    showToast('Modo pantalla completa activado', 'success');
                }).catch((err) => {
                    console.warn('Error al activar pantalla completa:', err);
                    showToast('No se pudo activar pantalla completa', 'error');
                });
            } else {
                document.exitFullscreen().then(() => {
                    updateFullscreenButton(false);
                    showToast('Pantalla completa desactivada', 'info');
                }).catch((err) => {
                    console.warn('Error al salir de pantalla completa:', err);
                });
            }
        } catch (error) {
            console.warn('Función de pantalla completa no soportada:', error);
            showToast('Pantalla completa no soportada en este navegador', 'error');
        }
    }
}

// Actualizar el botón de pantalla completa
function updateFullscreenButton(isFullscreen) {
    const btn = document.querySelector('.fullscreen-btn');
    if (btn) {
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (isFullscreen) {
            icon.className = 'fas fa-compress';
            text.textContent = 'Salir de Pantalla Completa';
        } else {
            icon.className = 'fas fa-expand';
            text.textContent = 'Pantalla Completa';
        }
    }
}

// Función para actualizar el stream
function refreshStream() {
    const iframe = document.querySelector('.iframe-container iframe');
    const btn = document.querySelector('.refresh-btn');
    
    if (iframe && btn) {
        // Animar el botón
        const icon = btn.querySelector('i');
        icon.style.animation = 'spin 1s linear infinite';
        btn.disabled = true;
        
        // Actualizar iframe
        const currentSrc = iframe.src;
        iframe.src = '';
        
        setTimeout(() => {
            iframe.src = currentSrc;
            icon.style.animation = '';
            btn.disabled = false;
            showToast('Stream actualizado correctamente', 'success');
        }, 1000);
    }
}

// Función para compartir el stream en vivo
function shareLiveStream() {
    const streamUrl = window.location.href + '#live-stream';
    
    if (navigator.share) {
        // API Web Share nativa (móviles)
        navigator.share({
            title: 'ULTRAGOL - Transmisión En Vivo',
            text: 'Disfruta de transmisiones de fútbol en vivo con ULTRAGOL',
            url: streamUrl
        }).then(() => {
            showToast('Stream compartido exitosamente', 'success');
        }).catch((err) => {
            console.warn('Error al compartir:', err);
            fallbackShareUrl(streamUrl);
        });
    } else {
        // Fallback - copiar al portapapeles
        fallbackShareUrl(streamUrl);
    }
}

// Función de respaldo para compartir URLs
function fallbackShareUrl(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copiado al portapapeles', 'success');
        }).catch(() => {
            manualCopyFallback(url);
        });
    } else {
        manualCopyFallback(url);
    }
}

// Función manual de copia (para navegadores muy antiguos)
function manualCopyFallback(url) {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('Link copiado al portapapeles', 'success');
    } catch (err) {
        console.warn('Error al copiar:', err);
        showToast('No se pudo copiar el link', 'error');
    } finally {
        document.body.removeChild(textArea);
    }
}

// Escuchar cambios de pantalla completa (mover este listener al final)
function setupFullscreenListener() {
    document.addEventListener('fullscreenchange', () => {
        updateFullscreenButton(!!document.fullscreenElement);
    });
}

// Llamar la función para configurar el listener
setupFullscreenListener();

// Funciones de animación CSS para efectos
function addSpinAnimation() {
    if (!document.getElementById('spin-animation')) {
        const style = document.createElement('style');
        style.id = 'spin-animation';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Función de actualización de contador de espectadores (simulada)
function updateViewerCount() {
    const viewerElement = document.getElementById('viewer-count');
    if (viewerElement) {
        const baseCount = 2847;
        const variation = Math.floor(Math.random() * 100) - 50; // Variación de ±50
        const newCount = Math.max(1000, baseCount + variation);
        
        viewerElement.textContent = `${newCount.toLocaleString()} espectadores`;
    }
}

// Función para simular actualizaciones en tiempo real
function initializeLiveUpdates() {
    // Actualizar contador de espectadores cada 30 segundos
    setInterval(updateViewerCount, 30000);
    
    // Actualizar tiempo del partido cada minuto (simulado)
    setInterval(() => {
        const timeElement = document.querySelector('.match-time span');
        if (timeElement && timeElement.textContent.includes('67\'')) {
            const currentMinute = parseInt(timeElement.textContent.match(/\d+/)[0]);
            if (currentMinute < 90) {
                timeElement.textContent = `2° Tiempo - ${currentMinute + 1}'`;
            }
        }
    }, 60000);
}

// Inicializar las funciones cuando se carga la página de stream en vivo
document.addEventListener('DOMContentLoaded', () => {
    addSpinAnimation();
    initializeLiveUpdates();
});

// Verificar si showToast existe, si no crear una implementación simple
if (typeof window.showToast === 'undefined') {
    window.showToast = function(message, type) {
        console.log(`Toast [${type}]: ${message}`);
        // Implementación simple de toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };
}

// Hacer las funciones globales para que funcionen con onclick
window.toggleFullscreen = toggleFullscreen;
window.refreshStream = refreshStream;
window.shareLiveStream = shareLiveStream;
window.showToast = window.showToast; // Ensure showToast is also globally available