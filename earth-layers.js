import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cachedFetch, cachedTextureLoad } from './cache-api.js';

const API_BASE = 'https://api.nasa.gov/EPIC/api/natural';
const IMG_BASE = 'https://epic.gsfc.nasa.gov/archive/natural';

const PROXY_URLS = [
    '/proxy/',
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

const BLUE_MARBLE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const dateInput = document.getElementById('date-input');
const loadBtn = document.getElementById('load-btn');
const playBtn = document.getElementById('play-btn');

const imageCounter = document.getElementById('image-counter');
const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const infoDiv = document.getElementById('info');

// State
let scene, camera, renderer, controls, baseMesh, cloudMesh, atmosphereMesh, stars;
let currentImages = [];
let currentTextureIndex = 0;
let isPlaying = false;
let cloudTextures = [];
let timelapseInterval = null;
let baseTexture = null;
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        45,
        canvasContainer.clientWidth / canvasContainer.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 3.5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;

    // Lighting (Google Earth style)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000510, 1.4);
    hemiLight.position.set(0, 5, 0);
    scene.add(hemiLight);

    // Base Earth Sphere (Blue Marble)
    const baseGeometry = new THREE.SphereGeometry(1, 128, 128);
    baseTexture = await loadTextureAsync(BLUE_MARBLE_URL);
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    const baseMaterial = new THREE.MeshStandardMaterial({
        map: baseTexture,
        roughness: 0.6,
        metalness: 0.05,
    });
    baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    scene.add(baseMesh);

    // Cloud Sphere (slightly larger, transparent)
    const cloudGeometry = new THREE.SphereGeometry(1.015, 128, 128);
    const cloudMaterial = new THREE.MeshStandardMaterial({
        map: null,
        transparent: true,
        opacity: 0.88,
        roughness: 1.0,
        metalness: 0.0,
        depthWrite: false,
    });
    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(cloudMesh);

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

    createStars();

    window.addEventListener('resize', onWindowResize);
    loadBtn.addEventListener('click', () => loadByDate(dateInput.value));
    playBtn.addEventListener('click', toggleTimelapse);

    renderer.domElement.addEventListener('wheel', (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const zoomSpeed = 0.05;
        const distance = camera.position.distanceTo(controls.target);
        const scale = event.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
        let newDistance = distance * scale;
        newDistance = Math.max(controls.minDistance, Math.min(controls.maxDistance, newDistance));
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        camera.position.copy(controls.target).add(direction.multiplyScalar(newDistance));
    }, { passive: false });

    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', (e) => {
            setLang(e.target.value);
            updatePageTextLayers();
        });
    }
    updatePageTextLayers();

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;

    loadLatest();
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
    if (stars) stars.rotation.y += 0.0001;
    renderer.render(scene, camera);
}

async function loadLatest() {
    showLoadingOverlay(true);
    hideInfo();
    try {
        const response = await cachedFetch(`${API_BASE}?api_key=${NASA_API_KEY}`);
        if (!response.ok) throw new Error(t('httpError', { status: response.status }));
        const data = await response.json();
        if (data.length === 0) {
            showInfo(t('noImages3d'));
            return;
        }
        currentImages = data.slice(0, 4);
        currentTextureIndex = 0;
        updateImageCounter();
        await loadAllCloudTextures();
        const date = data[0].date.split(' ')[0];
        dateInput.value = date;
    } catch (error) {
        console.error('Error loading latest:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showLoadingOverlay(false);
    }
}

async function loadByDate(date) {
    if (!date) {
        showInfo(t('selectDateError'));
        return;
    }
    showLoadingOverlay(true);
    hideInfo();
    stopTimelapse();
    try {
        const response = await cachedFetch(`${API_BASE}/date/${date}?api_key=${NASA_API_KEY}`);
        if (!response.ok) throw new Error(t('httpError', { status: response.status }));
        const data = await response.json();
        if (data.length === 0) {
            showInfo(t('noImages3d'));
            return;
        }
        currentImages = data.slice(0, 4);
        currentTextureIndex = 0;
        updateImageCounter();
        await loadAllCloudTextures();
    } catch (error) {
        console.error('Error loading date:', error);
        showInfo(error.message || t('fetchError'));
    } finally {
        showLoadingOverlay(false);
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
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Texture load timeout')), 15000);
    });
    return Promise.race([
        cachedTextureLoad(url, textureLoader),
        timeoutPromise,
    ]);
}

function detectEarthRadius(srcData, imgW, imgH, cx, cy) {
    const threshold = 45;
    let r = 0;
    for (let x = Math.round(cx); x < imgW; x++) {
        const idx = (Math.round(cy) * imgW + x) * 4;
        if (srcData[idx] + srcData[idx + 1] + srcData[idx + 2] > threshold) r = Math.max(r, x - cx);
        else break;
    }
    for (let x = Math.round(cx); x >= 0; x--) {
        const idx = (Math.round(cy) * imgW + x) * 4;
        if (srcData[idx] + srcData[idx + 1] + srcData[idx + 2] > threshold) r = Math.max(r, cx - x);
        else break;
    }
    for (let y = Math.round(cy); y < imgH; y++) {
        const idx = (y * imgW + Math.round(cx)) * 4;
        if (srcData[idx] + srcData[idx + 1] + srcData[idx + 2] > threshold) r = Math.max(r, y - cy);
        else break;
    }
    for (let y = Math.round(cy); y >= 0; y--) {
        const idx = (y * imgW + Math.round(cx)) * 4;
        if (srcData[idx] + srcData[idx + 1] + srcData[idx + 2] > threshold) r = Math.max(r, cy - y);
        else break;
    }
    return r;
}

/**
 * Projects EPIC image onto a transparent equirectangular canvas.
 * Space pixels are fully transparent; Earth pixels are opaque with soft edges.
 */
function generateCloudTexture(imageData, texture) {
    const W = 2048;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Transparent background
    ctx.clearRect(0, 0, W, H);

    const img = texture.image;
    const imgW = img.width;
    const imgH = img.height;

    const tmp = document.createElement('canvas');
    tmp.width = imgW;
    tmp.height = imgH;
    const tCtx = tmp.getContext('2d');
    let srcData;
    try {
        tCtx.drawImage(img, 0, 0);
        srcData = tCtx.getImageData(0, 0, imgW, imgH).data;
    } catch (e) {
        return new THREE.CanvasTexture(canvas);
    }

    // Detect Earth disc centre
    let sumX = 0, sumY = 0, count = 0;
    const sampleStep = 4;
    for (let y = 0; y < imgH; y += sampleStep) {
        for (let x = 0; x < imgW; x += sampleStep) {
            const idx = (y * imgW + x) * 4;
            if (srcData[idx] + srcData[idx + 1] + srcData[idx + 2] > 30) {
                sumX += x; sumY += y; count++;
            }
        }
    }
    const cx = count > 0 ? sumX / count : imgW / 2;
    const cy = count > 0 ? sumY / count : imgH / 2;
    const earthRadiusPx = detectEarthRadius(srcData, imgW, imgH, cx, cy) || (Math.min(imgW, imgH) * 0.38);

    // Camera frame from J2000 (Three.js Y-up)
    const dPos = imageData.dscovr_j2000_position;
    const dist = Math.sqrt(dPos.x * dPos.x + dPos.y * dPos.y + dPos.z * dPos.z);
    const R_earth_km = 6371;
    const sinAlpha = Math.min(1, R_earth_km / dist);

    const V = new THREE.Vector3(dPos.x, dPos.z, -dPos.y).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let Xcam = new THREE.Vector3().crossVectors(worldUp, V).normalize();
    if (Xcam.lengthSq() < 0.001) Xcam = new THREE.Vector3(1, 0, 0);
    const Ycam = new THREE.Vector3().crossVectors(V, Xcam).normalize();

    const scale = earthRadiusPx / sinAlpha;
    const sinAlphaSq = sinAlpha * sinAlpha;

    // Transparent output buffer
    const out = new Uint8ClampedArray(W * H * 4);

    const pixelStep = 2;
    for (let y = 0; y < imgH; y += pixelStep) {
        for (let x = 0; x < imgW; x += pixelStep) {
            const dx = (x - cx) / scale;
            const dy = (cy - y) / scale;
            const distPlaneSq = dx * dx + dy * dy;

            if (distPlaneSq > sinAlphaSq) continue; // space

            const dz = Math.sqrt(Math.max(0, 1 - distPlaneSq));

            const Px = dx * Xcam.x + dy * Ycam.x + dz * V.x;
            const Py = dx * Xcam.y + dy * Ycam.y + dz * V.y;
            const Pz = dx * Xcam.z + dy * Ycam.z + dz * V.z;

            const lat = Math.asin(Math.max(-1, Math.min(1, Py)));
            const lon = Math.atan2(Pz, Px);

            const u = Math.round((lon + Math.PI) / (2 * Math.PI) * (W - 1));
            const v = Math.round((0.5 - lat / Math.PI) * (H - 1));

            if (u < 0 || u >= W || v < 0 || v >= H) continue;

            const srcIdx = (y * imgW + x) * 4;
            const dstIdx = (v * W + u) * 4;

            // Skip very dark pixels (deep space shadows)
            const brightness = srcData[srcIdx] + srcData[srcIdx + 1] + srcData[srcIdx + 2];
            if (brightness < 20) continue;

            // Soft edge feather
            const limb = Math.sqrt(distPlaneSq) / sinAlpha;
            const edgeFactor = limb > 0.80 ? Math.max(0, 1 - (limb - 0.80) / 0.20) : 1;

            // Alpha blend: if pixel already has data, average it for smoothness
            const existingAlpha = out[dstIdx + 3];
            if (existingAlpha === 0) {
                out[dstIdx]     = srcData[srcIdx];
                out[dstIdx + 1] = srcData[srcIdx + 1];
                out[dstIdx + 2] = srcData[srcIdx + 2];
                out[dstIdx + 3] = Math.round(255 * edgeFactor);
            } else {
                const inv = 1 / 2;
                out[dstIdx]     = (out[dstIdx]     + srcData[srcIdx])     * inv;
                out[dstIdx + 1] = (out[dstIdx + 1] + srcData[srcIdx + 1]) * inv;
                out[dstIdx + 2] = (out[dstIdx + 2] + srcData[srcIdx + 2]) * inv;
                out[dstIdx + 3] = Math.max(out[dstIdx + 3], Math.round(255 * edgeFactor));
            }
        }
    }

    ctx.putImageData(new ImageData(out, W, H), 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

async function loadAllCloudTextures() {
    if (currentImages.length === 0) return;

    const date = currentImages[0].date.split(' ')[0];
    updateProgressBar(0, currentImages.length);

    cloudTextures = [];
    let completed = 0;

    for (const item of currentImages) {
        let texture = null;
        for (const proxy of PROXY_URLS) {
            try {
                const url = getProxiedImageUrl(date, item.image, proxy);
                texture = await loadTextureAsync(url);
                break;
            } catch (err) {
                // try next proxy
            }
        }
        if (texture) {
            const cloudTex = generateCloudTexture(item, texture);
            cloudTextures.push(cloudTex);
        }
        completed++;
        updateProgressBar(completed, currentImages.length);
    }

    if (cloudTextures.length === 0) {
        showInfo(t('textureLoadError'));
        return;
    }

    cloudTextures.forEach(t => t.colorSpace = THREE.SRGBColorSpace);
    cloudMesh.material.map = cloudTextures[0];
    cloudMesh.material.needsUpdate = true;
    currentTextureIndex = 0;
    updateImageCounter();

    // Rotate cloud sphere so EPIC's photographed hemisphere faces camera
    const dPos = currentImages[0].dscovr_j2000_position;
    const V = new THREE.Vector3(dPos.x, dPos.z, -dPos.y).normalize();
    cloudMesh.lookAt(cloudMesh.position.clone().add(V));
}

function toggleTimelapse() {
    if (isPlaying) stopTimelapse();
    else startTimelapse();
}

function startTimelapse() {
    isPlaying = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    playBtn.textContent = t('pauseTimelapse');

    if (cloudTextures.length > 1) {
        timelapseInterval = setInterval(() => {
            currentTextureIndex = (currentTextureIndex + 1) % cloudTextures.length;
            cloudMesh.material.map = cloudTextures[currentTextureIndex];
            cloudMesh.material.needsUpdate = true;
            updateImageCounter();
        }, 1200);
    }
}

function stopTimelapse() {
    isPlaying = false;
    controls.autoRotate = false;
    playBtn.textContent = t('playTimelapse');
    if (timelapseInterval) {
        clearInterval(timelapseInterval);
        timelapseInterval = null;
    }
}

function updateImageCounter() {
    imageCounter.textContent = t('imageCount', {
        current: currentTextureIndex + 1,
        total: currentImages.length,
    });
}

function showLoadingOverlay(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function updateProgressBar(current, total) {
    if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
    if (progressText) progressText.textContent = `${current} / ${total}`;
}

function showInfo(msg) {
    infoDiv.textContent = msg;
    infoDiv.classList.remove('hidden');
}

function hideInfo() {
    infoDiv.classList.add('hidden');
}

function updatePageTextLayers() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        const text = t(key);
        if (text.includes('<')) el.innerHTML = text;
        else el.textContent = text;
    });
    document.title = t('titleLayers');
}

init();
