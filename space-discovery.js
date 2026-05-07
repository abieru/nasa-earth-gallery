import { cachedFetch } from './cache-api.js';

const APOD_API_BASE = 'https://api.nasa.gov/planetary/apod';

let currentApodData = null;
let apodHistory = [];

// DOM Elements
const todayBtn = document.getElementById('apod-today-btn');
const randomBtn = document.getElementById('apod-random-btn');
const loadingOverlay = document.getElementById('apod-loading-overlay');
const infoDiv = document.getElementById('apod-info');
const featuredSection = document.getElementById('apod-featured');
const featuredImage = document.getElementById('apod-featured-image');
const featuredTitle = document.getElementById('apod-featured-title');
const featuredDate = document.getElementById('apod-featured-date');
const featuredExplanation = document.getElementById('apod-featured-explanation');
const featuredCopyright = document.getElementById('apod-featured-copyright');
const featuredHd = document.getElementById('apod-featured-hd');
const apodGrid = document.getElementById('apod-grid');
const modal = document.getElementById('apod-modal');
const modalImage = document.getElementById('apod-modal-image');
const modalTitle = document.getElementById('apod-modal-title');
const modalDate = document.getElementById('apod-modal-date');
const modalExplanation = document.getElementById('apod-modal-explanation');
const modalCopyright = document.getElementById('apod-modal-copyright');
const modalHd = document.getElementById('apod-modal-hd');
const modalClose = document.getElementById('apod-modal-close');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load latest APOD and recent history
    loadLatestApod();
    loadApodHistory(12);

    // Event listeners
    todayBtn.addEventListener('click', () => {
        loadLatestApod();
    });

    randomBtn.addEventListener('click', () => {
        loadRandomApod();
    });

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Language switcher
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', (e) => {
            setLang(e.target.value);
        });
    }
});

async function loadLatestApod() {
    showLoading(true);
    try {
        const url = `${APOD_API_BASE}?api_key=${NASA_API_KEY}`;
        const response = await cachedFetch(url);
        if (!response.ok) {
            throw new Error(t('httpError', { status: response.status }));
        }
        const data = await response.json();
        currentApodData = data;
        renderFeaturedApod(data);
        showInfo(t('showingApod', { date: formatDate(data.date) }));
    } catch (error) {
        console.error('Error loading latest APOD:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showLoading(false);
    }
}

async function loadRandomApod() {
    showLoading(true);
    try {
        const url = `${APOD_API_BASE}?api_key=${NASA_API_KEY}&count=1`;
        const response = await cachedFetch(url);
        if (!response.ok) {
            throw new Error(t('httpError', { status: response.status }));
        }
        const data = await response.json();
        const apod = Array.isArray(data) ? data[0] : data;
        currentApodData = apod;
        renderFeaturedApod(apod);
        showInfo(t('showingApod', { date: formatDate(apod.date) }));
    } catch (error) {
        console.error('Error loading random APOD:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showLoading(false);
    }
}

async function loadApodHistory(count) {
    try {
        const url = `${APOD_API_BASE}?api_key=${NASA_API_KEY}&count=${count}`;
        const response = await cachedFetch(url);
        if (!response.ok) {
            throw new Error(t('httpError', { status: response.status }));
        }
        const data = await response.json();
        apodHistory = Array.isArray(data) ? data : [data];
        renderApodGrid(apodHistory);
    } catch (error) {
        console.error('Error loading APOD history:', error);
    }
}

function renderFeaturedApod(apod) {
    if (apod.media_type === 'video') {
        featuredImage.style.display = 'none';
        // For videos, we could embed but let's show thumbnail or link
        featuredSection.innerHTML = `
            <div class="apod-featured-video-container">
                <iframe src="${apod.url}" frameborder="0" allowfullscreen></iframe>
            </div>
            <div class="apod-featured-content">
                <h2>${apod.title}</h2>
                <p class="apod-date">${formatDate(apod.date)}</p>
                <p class="apod-explanation">${apod.explanation}</p>
                ${apod.copyright ? `<p class="apod-copyright">${t('copyright')}: ${apod.copyright}</p>` : ''}
            </div>
        `;
    } else {
        featuredImage.style.display = 'block';
        featuredImage.src = apod.url;
        featuredImage.alt = apod.title;
        featuredTitle.textContent = apod.title;
        featuredDate.textContent = formatDate(apod.date);
        featuredExplanation.textContent = apod.explanation;
        featuredCopyright.textContent = apod.copyright ? `${t('copyright')}: ${apod.copyright}` : '';
        featuredHd.href = apod.hdurl || apod.url;
    }

    featuredSection.classList.remove('hidden');
}

function renderApodGrid(items) {
    apodGrid.innerHTML = '';
    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'apod-card';
        card.dataset.index = index;

        const isVideo = item.media_type === 'video';
        const imageUrl = isVideo ? (item.thumbnail_url || 'https://via.placeholder.com/400x300?text=Video') : item.url;

        card.innerHTML = `
            <div class="apod-card-image">
                <img src="${imageUrl}" alt="${item.title}" loading="lazy">
                ${isVideo ? `<div class="apod-video-badge">▶ Video</div>` : ''}
            </div>
            <div class="apod-card-info">
                <h4>${item.title}</h4>
                <p class="apod-card-date">${formatDate(item.date)}</p>
            </div>
        `;

        card.addEventListener('click', () => openModal(index));
        apodGrid.appendChild(card);
    });
}

function openModal(index) {
    const item = apodHistory[index];
    if (!item) return;

    modalImage.src = item.url;
    modalImage.alt = item.title;
    modalTitle.textContent = item.title;
    modalDate.textContent = formatDate(item.date);
    modalExplanation.textContent = item.explanation;
    modalCopyright.textContent = item.copyright ? `${t('copyright')}: ${item.copyright}` : '';
    modalHd.href = item.hdurl || item.url;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function showInfo(message) {
    infoDiv.textContent = message;
    infoDiv.classList.remove('hidden');
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const locale = getLocale();
    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
