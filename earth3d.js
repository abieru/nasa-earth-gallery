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
let playInterval = null;
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

    // Earth Sphere with full-disc projection shader
    const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
    const earthMaterial = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: null },
        },
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            varying vec3 vNormal;

            void main() {
                vec3 n = normalize(vNormal);
                float viewDot = dot(n, vec3(0.0, 0.0, 1.0));

                if (viewDot > 0.0) {
                    // Orthographic disc projection: map hemisphere XY to UV [0,1]
                    vec2 uv = n.xy * 0.5 + 0.5;
                    vec4 texColor = texture2D(map, uv);

                    // Smooth terminator fade to night side
                    float terminator = smoothstep(0.0, 0.2, viewDot);
                    vec3 nightColor = vec3(0.0, 0.01, 0.03);
                    gl_FragColor = vec4(mix(nightColor, texColor.rgb, terminator), 1.0);
                } else {
                    // Dark night side
                    gl_FragColor = vec4(0.0, 0.01, 0.03, 1.0);
                }
            }
        `,
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
        await loadTexture(0);

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
        await loadTexture(0);
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

function loadTextureWithTimeout(url) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Texture load timeout'));
        }, 10000);

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

function loadTexture(index) {
    return new Promise((resolve, reject) => {
        if (!currentImages[index]) {
            resolve();
            return;
        }
        const item = currentImages[index];
        const date = item.date.split(' ')[0];

        const tryLoad = async (proxyIndex) => {
            if (proxyIndex >= PROXY_URLS.length) {
                showInfo(t('textureLoadError'));
                reject(new Error('All proxies failed'));
                return;
            }

            const proxy = PROXY_URLS[proxyIndex];
            const url = getProxiedImageUrl(date, item.image, proxy);

            try {
                const texture = await loadTextureWithTimeout(url);
                texture.colorSpace = THREE.SRGBColorSpace;
                earthMesh.material.uniforms.map.value = texture;
                currentTextureIndex = index;
                updateImageCounter();
                resolve();
            } catch (err) {
                console.warn(`Proxy ${proxy} failed for texture, trying next...`, err);
                tryLoad(proxyIndex + 1);
            }
        };

        tryLoad(0);
    });
}

function toggleTimelapse() {
    if (isPlaying) {
        stopTimelapse();
    } else {
        startTimelapse();
    }
}

function startTimelapse() {
    if (currentImages.length <= 1) return;
    isPlaying = true;
    controls.autoRotate = false;
    playBtn.textContent = t('pauseTimelapse');

    const interval = 800;

    playInterval = setInterval(async () => {
        let nextIndex = currentTextureIndex + 1;
        if (nextIndex >= currentImages.length) nextIndex = 0;
        await loadTexture(nextIndex);
    }, interval);
}

function stopTimelapse() {
    isPlaying = false;
    controls.autoRotate = true;
    playBtn.textContent = t('playTimelapse');
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
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
