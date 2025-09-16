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
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    
    // Agregar información del usuario que subió la transmisión
    const userInfo = document.createElement('div');
    userInfo.className = 'stream-user-info';
    
    if (stream.userAvatar) {
        const avatar = document.createElement('img');
        avatar.src = stream.userAvatar;
        avatar.className = 'user-avatar-small';
        avatar.alt = 'Avatar';
        avatar.onerror = function() { 
            this.style.display = 'none'; 
            this.nextElementSibling.style.display = 'inline'; 
        };
        userInfo.appendChild(avatar);
        
        const avatarIcon = document.createElement('i');
        avatarIcon.className = 'fas fa-user-circle user-icon-small';
        avatarIcon.style.display = 'none';
        userInfo.appendChild(avatarIcon);
    } else {
        const avatarIcon = document.createElement('i');
        avatarIcon.className = 'fas fa-user-circle user-icon-small';
        userInfo.appendChild(avatarIcon);
    }
    
    const userName = document.createElement('span');
    userName.className = 'user-name-small';
    userName.textContent = `Subido por: ${sanitizeText(stream.userName || 'Usuario')}`;
    userInfo.appendChild(userName);
    
    // Imagen de portada si existe
    if (stream.portadaURL) {
        const portadaImg = document.createElement('div');
        portadaImg.className = 'stream-portada';
        portadaImg.style.backgroundImage = `url(${sanitizeURL(stream.portadaURL)})`;
        card.insertBefore(portadaImg, header);
    }
    
    // Ensamblar card
    card.appendChild(header);
    card.appendChild(userInfo);
    card.appendChild(info);
    card.appendChild(actions);
    
    // Agregar efecto de brillo según la plataforma
    card.classList.add(`platform-${stream.plataforma}`);
    
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
    
    userAvatar.src = user.photoURL || 'https://via.placeholder.com/40x40?text=U';
    userName.textContent = user.displayName || user.email;
    
    userInfo.style.display = 'flex';
    loginBtn.style.display = 'none';
    misStreamsBtn.style.display = 'block';
}

// Ocultar información del usuario
function hideUserInfo() {
    const userInfo = document.getElementById('user-info');
    const loginBtn = document.getElementById('login-btn');
    const misStreamsBtn = document.querySelector('[data-section="mis-streams"]');
    
    userInfo.style.display = 'none';
    loginBtn.style.display = 'block';
    misStreamsBtn.style.display = 'none';
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
            btn.addEventListener('click', () => showSection(sectionName));
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