/**
 * Simple caching layer using the Cache API.
 * Stores NASA API responses and EPIC image blobs so they
 * don't get re-downloaded every time the user switches pages.
 */

const API_CACHE_NAME = 'nasa-epic-api-v1';
const IMG_CACHE_NAME = 'nasa-epic-images-v1';

/**
 * Fetch JSON from NASA API with caching.
 */
export async function cachedFetch(url) {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        let response = await cache.match(url);
        if (!response) {
            response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response.clone());
            }
        }
        return response;
    } catch (e) {
        // Fallback to regular fetch if Cache API fails
        return fetch(url);
    }
}

/**
 * Load a Three.js texture with image caching.
 * The image blob is stored in Cache API so subsequent loads are instant.
 */
export function cachedTextureLoad(url, textureLoader) {
    return new Promise(async (resolve, reject) => {
        try {
            const cache = await caches.open(IMG_CACHE_NAME);
            let response = await cache.match(url);
            if (!response) {
                response = await fetch(url, { mode: 'cors', credentials: 'omit' });
                if (response.ok) {
                    await cache.put(url, response.clone());
                }
            }
            if (!response || !response.ok) {
                reject(new Error(`Failed to fetch texture: ${url}`));
                return;
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            textureLoader.load(
                blobUrl,
                (texture) => {
                    URL.revokeObjectURL(blobUrl);
                    resolve(texture);
                },
                undefined,
                (err) => {
                    URL.revokeObjectURL(blobUrl);
                    reject(err);
                }
            );
        } catch (err) {
            reject(err);
        }
    });
}
