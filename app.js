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

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Configurar eventos
    setupEventListeners();
    
    // Cargar transmisiones
    loadStreams();
    
    // Configurar limpieza automática
    setupAutoCleanup();
    
    // Mostrar sección de transmisiones por defecto
    showSection('transmisiones');
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

// Validar URL
function isValidURL(string) {
    try {
        new URL(string);
        return true;
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

// Mostrar transmisiones en la interfaz
function displayStreams(streams) {
    const container = document.getElementById('streams-container');
    
    // Filtrar por plataforma si es necesario
    let filteredStreams = streams;
    if (currentFilter !== 'all') {
        filteredStreams = streams.filter(stream => 
            stream.plataforma === currentFilter || 
            (stream.plataforma === 'otra' && stream.otraPlataforma.toLowerCase().includes(currentFilter))
        );
    }
    
    if (filteredStreams.length === 0) {
        container.innerHTML = `
            <div class="no-streams">
                <i class="fas fa-futbol"></i>
                <p>No hay transmisiones disponibles en este momento</p>
                <p class="sub-text">¡Sé el primero en compartir una transmisión!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredStreams.map(stream => createStreamCard(stream)).join('');
    
    // Inicializar contadores de tiempo
    filteredStreams.forEach(stream => {
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

// Crear tarjeta de transmisión
function createStreamCard(stream) {
    const plataformaDisplay = stream.plataforma === 'otra' ? stream.otraPlataforma : stream.plataforma;
    const ligaDisplay = stream.liga === 'otra-liga' ? stream.otraLiga : stream.liga;
    const tiempoPartidoDisplay = getTiempoPartidoDisplay(stream.tiempoPartido);
    const plataformaIcon = getPlatformIcon(stream.plataforma);
    const calidadIcon = getQualityIcon(stream.calidad);
    const tiempoIcon = getTiempoPartidoIcon(stream.tiempoPartido);
    
    return `
        <div class="stream-card" data-platform="${stream.plataforma}">
            <div class="stream-header">
                <div class="stream-teams">${stream.equipos}</div>
                <div class="stream-platform">
                    <i class="${plataformaIcon}"></i> ${plataformaDisplay.toUpperCase()}
                </div>
            </div>
            
            <div class="stream-info">
                <div>
                    <i class="fas fa-trophy"></i>
                    <span>${ligaDisplay.toUpperCase()}</span>
                </div>
                <div>
                    <i class="${tiempoIcon}"></i>
                    <span>${tiempoPartidoDisplay}</span>
                </div>
                <div>
                    <i class="${calidadIcon}"></i>
                    <span>${stream.calidad}</span>
                </div>
                <div>
                    <i class="fas fa-language"></i>
                    <span>${stream.idioma}</span>
                </div>
                ${stream.comentarios ? '<div><i class="fas fa-microphone"></i><span>Con comentarios</span></div>' : ''}
            </div>
            
            <div class="stream-actions">
                <a href="${stream.link}" target="_blank" class="stream-link">
                    <i class="fas fa-play"></i> Ver Transmisión
                </a>
                <div class="time-remaining" id="timer-${stream.id}">
                    <i class="fas fa-clock"></i>
                    <span>Cargando...</span>
                </div>
            </div>
        </div>
    `;
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

// Mostrar notificaciones
function showNotification(message, type = 'success') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Hacer funciones globales para el HTML
window.showSection = showSection;
window.filterStreams = filterStreams;