// js/utils.js
import { loaderOverlay as defaultModuleLoaderOverlay, loaderText as defaultModuleLoaderText } from './domElements.js';

/**
 * @typedef {object} RgbColor
 * @property {number} r
 * @property {number} g
 * @property {number} b
 */

/**
 * @param {string} s
 * @returns {boolean}
 */
export const hasRtl = (s) => {
    const rtlChars = '\u0590-\u05FF\u0600-\u06FF'; // Hebrew and Arabic character ranges
    const rtlRegex = new RegExp(`[${rtlChars}]`);
    return rtlRegex.test(s);
};

/**
 * @param {string} text
 * @param {HTMLElement | null} [loaderTextParam=defaultModuleLoaderText]
 * @param {HTMLElement | null} [loaderOverlayParam=defaultModuleLoaderOverlay]
 * @returns {void}
 */
export const showLoader = (
    text,
    loaderTextParam = defaultModuleLoaderText,
    loaderOverlayParam = defaultModuleLoaderOverlay
) => {
    if (loaderTextParam && loaderOverlayParam) {
        loaderTextParam.textContent = text;
        loaderOverlayParam.classList.remove('hidden');
    } else {
        console.error("Loader elements not found for showLoader. Ensure they are correctly passed or available in default DOM elements.");
    }
};

/**
 * @param {HTMLElement | null} [loaderOverlayParam=defaultModuleLoaderOverlay]
 * @returns {void}
 */
export const hideLoader = (
    loaderOverlayParam = defaultModuleLoaderOverlay
) => {
    if (loaderOverlayParam) {
        loaderOverlayParam.classList.add('hidden');
    } else {
        console.error("Loader overlay not found for hideLoader. Ensure it is correctly passed or available in default DOM elements.");
    }
};

/**
 * @param {Uint8Array} data
 * @param {string} fileName
 * @returns {void}
 */
export const downloadBlob = (data, fileName) => {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

/**
 * @param {string | null | undefined} hex
 * @returns {RgbColor | null}
 */
export const hexToRgb = (hex) => {
    if (!hex) return null;
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};
