declare const __NATIVE__: boolean | undefined;

/** True only in the iOS (Capacitor) bundle built with `vite build --mode ios`. */
export const IS_NATIVE_BUILD: boolean = typeof __NATIVE__ !== 'undefined' && __NATIVE__ === true;

/** Preview 3 isolation. Do not use the live root or preview2 prefixes. The iOS app has its own origin and prefix. */
export const STORAGE_PREFIX = IS_NATIVE_BUILD ? 'mb.' : 'mp3.';
export const CACHE_PREFIX = 'mp3-';
export const BUILD_NAME = IS_NATIVE_BUILD ? 'MERGE BLOOM' : 'MERGE BLOOM (Preview 3)';
