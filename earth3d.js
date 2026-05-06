import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const API_BASE = 'https://api.nasa.gov/EPIC/api/natural';
const IMG_BASE = 'https://epic.gsfc.nasa.gov/archive/natural';

const PROXY_URLS = [
    '/proxy/',                       // dev-server.py / Docker
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const dateInput = document.getElementById('date-input');
const loadBtn = document.getElementById('load-btn');
const playBtn = document.getElementById('play-btn');

const imageCounter = document.getElementById('image-counter');
const textureLoaderEl = document.getElementById('texture-loader');
const infoDiv = document.getElementById('info');

// State
let scene, camera, renderer, controls, earthMesh, atmosphereMesh, stars;
let currentImages = [];
let currentTextureIndex = 0;
let isPlaying = false;
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

// Initialize
function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        canvasContainer.clientWidth / canvasContainer.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 3.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(1, 128, 128);
    const earthMaterial = new THREE.MeshStandardMaterial({
        map: null,
        roughness: 0.7,
        metalness: 0.1,
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // Atmosphere Glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
    });
    atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // Starfield
    createStars();

    // Events
    window.addEventListener('resize', onWindowResize);
    loadBtn.addEventListener('click', () => loadByDate(dateInput.value));
    playBtn.addEventListener('click', toggleTimelapse);


    // Language
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', (e) => {
            setLang(e.target.value);
            updatePageText3d();
        });
    }
    updatePageText3d();

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;

    // Load latest
    loadLatest();

    // Animation loop
    animate();
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 4000;
    const posArray = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 120;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const starsMaterial = new THREE.PointsMaterial({
        size: 0.08,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
    });

    stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (stars) {
        stars.rotation.y += 0.0001;
    }

    renderer.render(scene, camera);
}

async function loadLatest() {
    showTextureLoader(true);
    hideInfo();
    try {
        const response = await fetch(`${API_BASE}?api_key=${NASA_API_KEY}`);
        if (!response.ok) {
            throw new Error(t('httpError', { status: response.status }));
        }
        const data = await response.json();
        if (data.length === 0) {
            showInfo(t('noImages3d'));
            return;
        }
        currentImages = data;
        currentTextureIndex = 0;
        updateImageCounter();
        await loadAllTextures();

        const date = data[0].date.split(' ')[0];
        dateInput.value = date;
    } catch (error) {
        console.error('Error loading latest:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showTextureLoader(false);
    }
}

async function loadByDate(date) {
    if (!date) {
        showInfo(t('selectDateError'));
        return;
    }
    showTextureLoader(true);
    hideInfo();
    stopTimelapse();
    try {
        const response = await fetch(`${API_BASE}/date/${date}?api_key=${NASA_API_KEY}`);
        if (!response.ok) {
            throw new Error(t('httpError', { status: response.status }));
        }
        const data = await response.json();
        if (data.length === 0) {
            showInfo(t('noImages3d'));
            return;
        }
        currentImages = data;
        currentTextureIndex = 0;
        updateImageCounter();
        await loadAllTextures();
    } catch (error) {
        console.error('Error loading date:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showTextureLoader(false);
    }
}

function getImageUrl(date, imageName, type = 'png') {
    const [year, month, day] = date.split('-');
    const ext = type === 'thumbs' ? 'jpg' : type;
    return `${IMG_BASE}/${year}/${month}/${day}/${type}/${imageName}.${ext}`;
}

function getProxiedImageUrl(date, imageName, proxy) {
    const baseUrl = getImageUrl(date, imageName, 'png');
    if (proxy === '/proxy/') {
        return baseUrl.replace('https://epic.gsfc.nasa.gov/', '/proxy/');
    }
    return proxy + encodeURIComponent(baseUrl);
}

function loadTextureAsync(url) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Texture load timeout'));
        }, 15000);

        textureLoader.load(
            url,
            (texture) => {
                clearTimeout(timeoutId);
                resolve(texture);
            },
            undefined,
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
}

async function loadAllTextures() {
    if (currentImages.length === 0) return;

    const date = currentImages[0].date.split(' ')[0];

    // Try each proxy until one works for the whole batch
    let textures = null;
    for (const proxy of PROXY_URLS) {
        try {
            const urls = currentImages.map(item => getProxiedImageUrl(date, item.image, proxy));
            textures = await Promise.all(urls.map(url => loadTextureAsync(url)));
            break; // Success
        } catch (err) {
            console.warn(`Proxy ${proxy} failed for batch load, trying next...`);
        }
    }

    if (!textures) {
        showInfo(t('textureLoadError'));
        return;
    }

    const worldTexture = generateWorldTexture(textures, currentImages);
    worldTexture.colorSpace = THREE.SRGBColorSpace;
    earthMesh.material.map = worldTexture;
    earthMesh.material.needsUpdate = true;
}

function generateWorldTexture(textures, imagesData) {
    const W = 2048;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Deep ocean background
    ctx.fillStyle = '#000510';
    ctx.fillRect(0, 0, W, H);

    const maxRadius = H * 0.48;

    imagesData.forEach((item, i) => {
        const texture = textures[i];
        const img = texture?.image;
        if (!img) return;

        const lon = item.centroid_coordinates?.lon ?? 0;
        const lat = item.centroid_coordinates?.lat ?? 0;

        const cx = ((lon + 180) / 360) * W;
        const cy = ((-lat + 90) / 180) * H;

        const size = Math.round(maxRadius * 2);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tCtx = tempCanvas.getContext('2d');

        // Draw scaled image centered
        const scale = size / Math.max(img.width, img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        tCtx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

        // Make black background transparent
        try {
            const imageData = tCtx.getImageData(0, 0, size, size);
            const data = imageData.data;
            for (let j = 0; j < data.length; j += 4) {
                if (data[j] + data[j + 1] + data[j + 2] < 45) {
                    data[j + 3] = 0;
                }
            }
            tCtx.putImageData(imageData, 0, 0);
        } catch (e) {
            // Canvas may be tainted, skip transparency processing
        }

        // Radial mask to soften edges
        const r = size / 2;
        const gradient = tCtx.createRadialGradient(r, r, r * 0.3, r, r, r);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        tCtx.globalCompositeOperation = 'destination-in';
        tCtx.fillStyle = gradient;
        tCtx.fillRect(0, 0, size, size);
        tCtx.globalCompositeOperation = 'source-over';

        // Draw onto main canvas
        ctx.globalAlpha = 0.9;
        ctx.drawImage(tempCanvas, cx - r, cy - r);
        ctx.globalAlpha = 1.0;
    });

    return new THREE.CanvasTexture(canvas);
}

function toggleTimelapse() {
    if (isPlaying) {
        stopTimelapse();
    } else {
        startTimelapse();
    }
}

function startTimelapse() {
    isPlaying = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    playBtn.textContent = t('pauseTimelapse');
}

function stopTimelapse() {
    isPlaying = false;
    controls.autoRotate = false;
    playBtn.textContent = t('playTimelapse');
}

function updateImageCounter() {
    imageCounter.textContent = t('imageCount', {
        current: currentTextureIndex + 1,
        total: currentImages.length,
    });
}

function showTextureLoader(show) {
    textureLoaderEl.classList.toggle('hidden', !show);
}

function showInfo(msg) {
    infoDiv.textContent = msg;
    infoDiv.classList.remove('hidden');
}

function hideInfo() {
    infoDiv.classList.add('hidden');
}

function updatePageText3d() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        const text = t(key);
        if (text.includes('<')) el.innerHTML = text;
        else el.textContent = text;
    });
    document.title = t('title3d');
}

init();
