import { cachedFetch } from './cache-api.js';

const API_BASE = 'https://api.nasa.gov/EPIC/api/natural';
const IMG_BASE = 'https://epic.gsfc.nasa.gov/archive/natural';

// DOM Elements
const gallery = document.getElementById('gallery');
const loader = document.getElementById('loader');
const errorDiv = document.getElementById('error');
const infoDiv = document.getElementById('info');
const dateInput = document.getElementById('date-input');
const loadBtn = document.getElementById('load-btn');
const latestBtn = document.getElementById('latest-btn');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalImage = document.getElementById('modal-image');
const modalDetails = document.getElementById('modal-details');
const modalLoader = document.getElementById('modal-loader');

// State
let currentData = [];

// Initialize
function init() {
    // Set today's date in the date picker
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;
    
    // Language switcher
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', (e) => setLang(e.target.value));
    }
    updatePageText();
    
    // Load latest images
    loadLatest();
    
    // Event listeners
    loadBtn.addEventListener('click', () => loadByDate(dateInput.value));
    latestBtn.addEventListener('click', loadLatest);
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
    
    // Modal image load handler
    modalImage.addEventListener('load', () => {
        modalLoader.classList.add('hidden');
        modalImage.classList.remove('hidden');
    });
}

// Show/Hide helpers
function showLoader() {
    loader.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    infoDiv.classList.add('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    infoDiv.classList.add('hidden');
    hideLoader();
}

function showInfo(msg) {
    infoDiv.textContent = msg;
    infoDiv.classList.remove('hidden');
}

// Fetch latest images
async function loadLatest() {
    showLoader();
    gallery.innerHTML = '';
    
    try {
        const response = await cachedFetch(`${API_BASE}?api_key=${NASA_API_KEY}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error(t('invalidApiKey'));
            }
            throw new Error(t('httpError', { status: response.status }));
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showInfo(t('noImagesLatest'));
            hideLoader();
            return;
        }
        
        currentData = data;
        renderGallery(data);
        
        const date = data[0].date.split(' ')[0];
        showInfo(t('showingImages', { count: data.length, date: formatDate(date) }));
        
        // Update date input to match
        dateInput.value = date;
        
    } catch (error) {
        showError(error.message || t('fetchError'));
        console.error('Error:', error);
    }
    
    hideLoader();
}

// Fetch images by specific date
async function loadByDate(date) {
    if (!date) {
        showError(t('selectDateError'));
        return;
    }
    
    showLoader();
    gallery.innerHTML = '';
    
    try {
        const response = await cachedFetch(`${API_BASE}/date/${date}?api_key=${NASA_API_KEY}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error(t('invalidApiKey'));
            }
            throw new Error(t('httpError', { status: response.status }));
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showInfo(t('noImagesDate', { date: formatDate(date) }));
            hideLoader();
            return;
        }
        
        currentData = data;
        renderGallery(data);
        showInfo(t('showingImages', { count: data.length, date: formatDate(date) }));
        
    } catch (error) {
        showError(error.message || t('fetchError'));
        console.error('Error:', error);
    }
    
    hideLoader();
}

// Construct image URL
// type: 'png' | 'jpg' | 'thumbs' (default: 'png')
function getImageUrl(date, imageName, type = 'png') {
    const [year, month, day] = date.split('-');
    const ext = type === 'thumbs' ? 'jpg' : type;
    return `${IMG_BASE}/${year}/${month}/${day}/${type}/${imageName}.${ext}`;
}

// Format date nicely
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(getLocale(), options);
}

// Format time
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(getLocale(), { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });
}

// Render gallery
function renderGallery(data) {
    gallery.innerHTML = data.map((item, index) => {
        const date = item.date.split(' ')[0];
        const imageUrl = getImageUrl(date, item.image, 'thumbs');
        const coords = item.centroid_coordinates;
        const lat = coords ? coords.lat.toFixed(2) : t('na');
        const lon = coords ? coords.lon.toFixed(2) : t('na');
        
        return `
            <div class="gallery-item" data-index="${index}">
                <div class="gallery-image">
                    <img src="${imageUrl}" alt="${t('altText')}" loading="lazy">
                </div>
                <div class="gallery-info">
                    <h3>${formatTime(item.date)}</h3>
                    <div class="gallery-meta">
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            ${lat}°, ${lon}°
                        </span>
                        <span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            ${formatDate(date)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            openModal(index);
        });
    });
}

// Open modal with details
function openModal(index) {
    const item = currentData[index];
    if (!item) return;
    
    const date = item.date.split(' ')[0];
    const imageUrl = getImageUrl(date, item.image);
    const coords = item.centroid_coordinates || {};
    const dscovr = item.dscovr_j2000_position || {};
    const sun = item.sun_j2000_position || {};
    const lunar = item.lunar_j2000_position || {};
    
    modalImage.alt = t('modalAltText', { date: item.date });
    modal.dataset.index = index;
    
    // Show loader, hide image until loaded
    modalLoader.classList.remove('hidden');
    modalImage.classList.add('hidden');
    modalImage.src = imageUrl;
    
    modalDetails.innerHTML = `
        <h2>${t('imageDetails')}</h2>
        
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">${t('date')}</div>
                <div class="detail-value">${formatDate(date)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('timeUTC')}</div>
                <div class="detail-value">${formatTime(item.date)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('imageIdentifier')}</div>
                <div class="detail-value">${item.image}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('version')}</div>
                <div class="detail-value">${item.version || t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('centroidLatitude')}</div>
                <div class="detail-value">${coords.lat ? coords.lat.toFixed(4) + '°' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('centroidLongitude')}</div>
                <div class="detail-value">${coords.lon ? coords.lon.toFixed(4) + '°' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('dscovrX')}</div>
                <div class="detail-value">${dscovr.x ? dscovr.x.toFixed(2) + ' km' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('dscovrY')}</div>
                <div class="detail-value">${dscovr.y ? dscovr.y.toFixed(2) + ' km' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('dscovrZ')}</div>
                <div class="detail-value">${dscovr.z ? dscovr.z.toFixed(2) + ' km' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('sunX')}</div>
                <div class="detail-value">${sun.x ? sun.x.toFixed(2) + ' km' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('sunY')}</div>
                <div class="detail-value">${sun.y ? sun.y.toFixed(2) + ' km' : t('na')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${t('sunZ')}</div>
                <div class="detail-value">${sun.z ? sun.z.toFixed(2) + ' km' : t('na')}</div>
            </div>
        </div>
        
        ${item.caption ? `<div class="caption">${item.caption}</div>` : ''}
    `;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    modalImage.src = '';
    modalLoader.classList.add('hidden');
    modalImage.classList.remove('hidden');
}

// Start the app
init();
