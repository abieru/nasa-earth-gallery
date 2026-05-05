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

// State
let currentData = [];

// Initialize
function init() {
    // Set today's date in the date picker
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;
    
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
        const response = await fetch(`${API_BASE}/images?api_key=${NASA_API_KEY}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Invalid API Key. Please check your NASA API key in config.js');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showInfo('No images available for the latest date. Try selecting an earlier date.');
            hideLoader();
            return;
        }
        
        currentData = data;
        renderGallery(data);
        
        const date = data[0].date.split(' ')[0];
        showInfo(`Showing ${data.length} images from ${formatDate(date)}`);
        
        // Update date input to match
        dateInput.value = date;
        
    } catch (error) {
        showError(error.message || 'Failed to fetch data from NASA API');
        console.error('Error:', error);
    }
    
    hideLoader();
}

// Fetch images by specific date
async function loadByDate(date) {
    if (!date) {
        showError('Please select a date');
        return;
    }
    
    showLoader();
    gallery.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE}/date/${date}?api_key=${NASA_API_KEY}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Invalid API Key. Please check your NASA API key in config.js');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showInfo(`No images available for ${formatDate(date)}. Try another date.`);
            hideLoader();
            return;
        }
        
        currentData = data;
        renderGallery(data);
        showInfo(`Showing ${data.length} images from ${formatDate(date)}`);
        
    } catch (error) {
        showError(error.message || 'Failed to fetch data from NASA API');
        console.error('Error:', error);
    }
    
    hideLoader();
}

// Construct image URL
function getImageUrl(date, imageName) {
    const [year, month, day] = date.split('-');
    return `${IMG_BASE}/${year}/${month}/${day}/png/${imageName}.png`;
}

// Format date nicely
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
}

// Format time
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
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
        const imageUrl = getImageUrl(date, item.image);
        const coords = item.centroid_coordinates;
        const lat = coords ? coords.lat.toFixed(2) : 'N/A';
        const lon = coords ? coords.lon.toFixed(2) : 'N/A';
        
        return `
            <div class="gallery-item" data-index="${index}">
                <div class="gallery-image">
                    <img src="${imageUrl}" alt="Earth from DSCOVR" loading="lazy">
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
    
    modalImage.src = imageUrl;
    modalImage.alt = `Earth captured by DSCOVR on ${item.date}`;
    
    modalDetails.innerHTML = `
        <h2>Image Details</h2>
        
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">${formatDate(date)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Time (UTC)</div>
                <div class="detail-value">${formatTime(item.date)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Image Identifier</div>
                <div class="detail-value">${item.image}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Version</div>
                <div class="detail-value">${item.version || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Centroid Latitude</div>
                <div class="detail-value">${coords.lat ? coords.lat.toFixed(4) + '°' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Centroid Longitude</div>
                <div class="detail-value">${coords.lon ? coords.lon.toFixed(4) + '°' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">DSCOVR X Position</div>
                <div class="detail-value">${dscovr.x ? dscovr.x.toFixed(2) + ' km' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">DSCOVR Y Position</div>
                <div class="detail-value">${dscovr.y ? dscovr.y.toFixed(2) + ' km' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">DSCOVR Z Position</div>
                <div class="detail-value">${dscovr.z ? dscovr.z.toFixed(2) + ' km' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sun X Position</div>
                <div class="detail-value">${sun.x ? sun.x.toFixed(2) + ' km' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sun Y Position</div>
                <div class="detail-value">${sun.y ? sun.y.toFixed(2) + ' km' : 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sun Z Position</div>
                <div class="detail-value">${sun.z ? sun.z.toFixed(2) + ' km' : 'N/A'}</div>
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
}

// Start the app
init();
